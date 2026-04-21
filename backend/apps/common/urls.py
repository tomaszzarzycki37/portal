from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import SiteTextOverrideViewSet

router = DefaultRouter()
router.register('content', SiteTextOverrideViewSet, basename='content')

urlpatterns = [
    path('', include(router.urls)),
]
