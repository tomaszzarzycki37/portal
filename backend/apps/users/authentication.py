"""Custom authentication classes for users app."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import UserProfile


def mark_user_active(user, *, update_login=False):
    """Update profile.last_seen and optionally Django last_login."""
    if not user or not user.is_authenticated:
        return

    now = timezone.now()
    profile = getattr(user, 'profile', None)
    if profile is None:
        profile, _ = UserProfile.objects.get_or_create(user=user)

    if update_login:
        User.objects.filter(pk=user.pk).update(last_login=now)

    if profile.last_seen and (now - profile.last_seen) < ActivityJWTAuthentication.ACTIVITY_WRITE_INTERVAL:
        return

    UserProfile.objects.filter(pk=profile.pk).update(last_seen=now)


class ActivityJWTAuthentication(JWTAuthentication):
    """JWT authentication that updates user activity timestamp."""

    ACTIVITY_WRITE_INTERVAL = timedelta(minutes=1)

    def authenticate(self, request):
        authenticated = super().authenticate(request)
        if not authenticated:
            return authenticated

        user, token = authenticated
        if user and user.is_authenticated:
            mark_user_active(user)
        return (user, token)
