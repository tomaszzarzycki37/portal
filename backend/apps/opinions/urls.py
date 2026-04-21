"""URL configuration for opinions app"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OpinionViewSet, CommentViewSet

router = DefaultRouter()
router.register('', OpinionViewSet, basename='opinion')
router.register('comments', CommentViewSet, basename='comment')

urlpatterns = [
    path('', include(router.urls)),
]
