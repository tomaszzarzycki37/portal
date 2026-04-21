"""URL configuration for cars app"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BrandViewSet, CarModelViewSet

router = DefaultRouter()
router.register('brands', BrandViewSet, basename='brand')
router.register('', CarModelViewSet, basename='car')

urlpatterns = [
    path('', include(router.urls)),
]
