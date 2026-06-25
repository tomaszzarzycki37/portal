from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AdminActionLogViewSet, SiteTextOverrideViewSet

router = DefaultRouter()
router.register('content', SiteTextOverrideViewSet, basename='content')
router.register('admin-actions', AdminActionLogViewSet, basename='admin-actions')

urlpatterns = [
    path('', include(router.urls)),
]
