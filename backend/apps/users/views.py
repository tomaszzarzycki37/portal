"""Views for users app"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth.models import User
from .models import UserProfile
from .serializers import UserSerializer, UserRegistrationSerializer, UserUpdateSerializer, UserProfileSerializer


class PublicTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]
    authentication_classes = []


class PublicTokenRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]
    authentication_classes = []


class UserViewSet(viewsets.ModelViewSet):
    """User API endpoint"""
    queryset = User.objects.all()
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserRegistrationSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action == 'create':
            permission_classes = [AllowAny]
        elif self.action in ['me', 'update_profile', 'opinions']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]

    def _ensure_superuser_guard(self, target_user):
        if target_user.is_superuser and not self.request.user.is_superuser:
            raise PermissionDenied('Only superusers can manage superuser accounts.')

    def perform_update(self, serializer):
        target_user = self.get_object()
        self._ensure_superuser_guard(target_user)
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_superuser_guard(instance)
        if instance == self.request.user:
            raise PermissionDenied('You cannot delete your own account.')
        instance.delete()

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Get current user profile"""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def update_profile(self, request):
        """Update user profile information"""
        profile = request.user.profile
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def opinions(self, request, pk=None):
        """Get all opinions by a user"""
        from apps.opinions.models import Opinion
        from apps.opinions.serializers import OpinionListSerializer
        
        if not request.user.is_staff and str(request.user.id) != str(pk):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        user = self.get_object()
        opinions = Opinion.objects.filter(author=user, is_approved=True)
        serializer = OpinionListSerializer(opinions, many=True)
        return Response(serializer.data)
