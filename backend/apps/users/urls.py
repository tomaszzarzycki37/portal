"""URL configuration for users app"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, PublicTokenObtainPairView, PublicTokenRefreshView

router = DefaultRouter()
router.register('', UserViewSet, basename='user')

urlpatterns = [
    path('token/', PublicTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', PublicTokenRefreshView.as_view(), name='token_refresh'),
    path('', include(router.urls)),
]
