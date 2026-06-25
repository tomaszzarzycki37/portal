import os
import subprocess
import uuid
from django.conf import settings
from django.core.files.storage import default_storage
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .audit import log_admin_action
from .helpers import IsAdminOrReadOnly, IsAuthenticated
from .models import AdminActionLog, SiteTextOverride
from .pagination import StandardResultsSetPagination
from .serializers import AdminActionLogSerializer, SiteTextOverrideSerializer


class SiteTextOverrideViewSet(viewsets.ModelViewSet):
	serializer_class = SiteTextOverrideSerializer
	permission_classes = [IsAdminOrReadOnly]
	queryset = SiteTextOverride.objects.all()

	def get_queryset(self):
		queryset = SiteTextOverride.objects.all()
		lang = self.request.query_params.get('lang')
		key = self.request.query_params.get('key')

		if lang:
			queryset = queryset.filter(lang=lang)
		if key:
			queryset = queryset.filter(key=key)

		return queryset

	def _text_label(self, instance):
		return f"{instance.key} ({instance.lang})"

	def perform_create(self, serializer):
		instance = serializer.save()
		log_admin_action(
			self.request.user,
			AdminActionLog.ACTION_TEXT_CREATE,
			object_type='site_text',
			object_id=instance.id,
			object_label=self._text_label(instance),
			metadata={'key': instance.key, 'lang': instance.lang},
		)

	def perform_update(self, serializer):
		instance = serializer.save()
		log_admin_action(
			self.request.user,
			AdminActionLog.ACTION_TEXT_EDIT,
			object_type='site_text',
			object_id=instance.id,
			object_label=self._text_label(instance),
			metadata={'key': instance.key, 'lang': instance.lang},
		)

	def perform_destroy(self, instance):
		log_admin_action(
			self.request.user,
			AdminActionLog.ACTION_TEXT_DELETE,
			object_type='site_text',
			object_id=instance.id,
			object_label=self._text_label(instance),
			metadata={'key': instance.key, 'lang': instance.lang},
		)
		instance.delete()

	@action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
	def upload(self, request):
		"""Upload a file and return relative media path"""
		file = request.FILES.get('file')
		if not file:
			return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

		try:
			# Generate unique filename
			ext = os.path.splitext(file.name)[1]
			filename = f"portal/{uuid.uuid4().hex}{ext}"

			# Save file
			path = default_storage.save(filename, file)

			# Return relative URL for media
			media_url = f'/media/{path}'

			if request.user.is_staff:
				log_admin_action(
					request.user,
					AdminActionLog.ACTION_FILE_UPLOAD,
					object_type='file',
					object_label=file.name,
					metadata={'path': path, 'url': media_url},
				)

			return Response({'url': media_url}, status=status.HTTP_201_CREATED)
		except Exception as e:
			return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

	@action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
	def deploy(self, request):
		"""Pull latest code on the server, build frontend, restart services (admin only)."""
		if not request.user.is_staff:
			return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

		deploy_script = getattr(settings, 'DEPLOY_SCRIPT_PATH', os.path.join(settings.BASE_DIR.parent, 'scripts', 'deploy.sh'))
		if not os.path.isfile(deploy_script):
			return Response({'error': 'Deploy script not found'}, status=status.HTTP_501_NOT_IMPLEMENTED)

		try:
			command = ['bash', deploy_script]
			if getattr(settings, 'DEPLOY_RUN_AS_USER', ''):
				command = ['sudo', '-u', settings.DEPLOY_RUN_AS_USER, 'bash', deploy_script]

			result = subprocess.run(
				command,
				capture_output=True,
				text=True,
				timeout=600,
				cwd=os.path.dirname(deploy_script),
			)
		except subprocess.TimeoutExpired:
			return Response({'error': 'Deploy timed out'}, status=status.HTTP_504_GATEWAY_TIMEOUT)
		except Exception as exc:
			return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

		if result.returncode != 0:
			output = (result.stderr or result.stdout or 'Deploy failed').strip()
			return Response({'error': output[-2000:]}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

		return Response({
			'status': 'ok',
			'message': 'DEPLOY_OK',
			'output': (result.stdout or '').strip()[-2000:],
		})


class AdminActionLogViewSet(viewsets.ReadOnlyModelViewSet):
	"""Recent admin actions for the supervision panel."""
	queryset = AdminActionLog.objects.select_related('actor').all()
	serializer_class = AdminActionLogSerializer
	permission_classes = [IsAdminUser]
	pagination_class = StandardResultsSetPagination

	def get_queryset(self):
		queryset = AdminActionLog.objects.select_related('actor').all()
		action_type = self.request.query_params.get('action_type')
		if action_type:
			queryset = queryset.filter(action_type=action_type)
		return queryset
