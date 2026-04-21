import os
import uuid
from django.conf import settings
from django.core.files.storage import default_storage
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .helpers import IsAdminOrReadOnly
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

	@action(detail=False, methods=['post'], permission_classes=[IsAdminOrReadOnly])
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
