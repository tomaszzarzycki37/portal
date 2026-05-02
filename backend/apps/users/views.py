"""Views for users app"""
import secrets
import string
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from django.db import transaction
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User
from .models import UserProfile, PasswordChangeAudit
from .serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    UserUpdateSerializer,
    UserProfileSerializer,
    PasswordChangeAuditSerializer,
    UserPasswordResetSerializer,
)


class PublicTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        profile = getattr(self.user, 'profile', None)
        data['force_password_reset'] = bool(getattr(profile, 'force_password_reset', False))
        return data


class PublicTokenObtainPairView(TokenObtainPairView):
    serializer_class = PublicTokenObtainPairSerializer
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
        elif self.action in ['me', 'update_profile', 'opinions', 'change_password']:
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
        serializer.save(changed_by=self.request.user)

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

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        serializer = UserPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        current_password = serializer.validated_data['current_password']
        new_password = serializer.validated_data['new_password']

        if not user.check_password(current_password):
            return Response({'current_password': ['Current password is incorrect.']}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        profile = user.profile
        profile.force_password_reset = False
        profile.password_changed_at = timezone.now()
        profile.password_changed_by = user
        profile.save()

        PasswordChangeAudit.objects.create(
            target_user=user,
            changed_by=user,
            reason='self_password_reset',
            is_temporary=False,
            force_reset_required=False,
        )

        return Response({'detail': 'Password changed successfully.'})

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def password_audit(self, request, pk=None):
        user = self.get_object()
        self._ensure_superuser_guard(user)
        entries = PasswordChangeAudit.objects.filter(target_user=user)[:30]
        return Response(PasswordChangeAuditSerializer(entries, many=True).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def generate_temporary_password(self, request, pk=None):
        user = self.get_object()
        self._ensure_superuser_guard(user)

        if user == request.user:
            raise PermissionDenied('You cannot generate a temporary password for your own account here.')

        alphabet = string.ascii_letters + string.digits + '!@#$%^&*()-_=+'
        temp_password = ''.join(secrets.choice(alphabet) for _ in range(14))

        with transaction.atomic():
            user.set_password(temp_password)
            user.save()

            profile = user.profile
            profile.force_password_reset = True
            profile.password_changed_at = timezone.now()
            profile.password_changed_by = request.user
            profile.save()

            PasswordChangeAudit.objects.create(
                target_user=user,
                changed_by=request.user,
                reason='temporary_password_generated',
                is_temporary=True,
                force_reset_required=True,
            )

        return Response({
            'temporary_password': temp_password,
            'force_password_reset': True,
        })

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
