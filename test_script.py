from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.common.views import SiteTextOverrideViewSet
from django.core.files.uploadedfile import SimpleUploadedFile

# Get admin user
admin = User.objects.filter(is_staff=True).first()

# Create factory and request
factory = APIRequestFactory()
file = SimpleUploadedFile("test.png", b"fake png content", content_type="image/png")
request = factory.post('/common/content/upload/', {'file': file}, format='multipart')
force_authenticate(request, user=admin)

# Create view
view = SiteTextOverrideViewSet.as_view({'post': 'upload'})
response = view(request)

print(f"Status: {response.status_code}")
print(f"Data: {response.data if hasattr(response, 'data') else 'No data'}")
