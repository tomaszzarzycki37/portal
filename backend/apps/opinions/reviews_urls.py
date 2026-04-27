"""URL configuration for press reviews API."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PressReviewViewSet

router = DefaultRouter()
router.register('', PressReviewViewSet, basename='press-review')

urlpatterns = [
    path('', include(router.urls)),
]
