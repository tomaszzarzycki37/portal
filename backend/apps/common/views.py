import os
import subprocess
import uuid
from django.conf import settings
from django.core.files.storage import default_storage
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .helpers import IsAdminOrReadOnly, IsAuthenticated
from .models import SiteTextOverride
from .serializers import SiteTextOverrideSerializer


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
