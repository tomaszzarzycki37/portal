"""Custom authentication classes for users app."""

from datetime import timedelta

from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import UserProfile


class ActivityJWTAuthentication(JWTAuthentication):
    """JWT authentication that updates user activity timestamp."""

    ACTIVITY_WRITE_INTERVAL = timedelta(minutes=1)

    def authenticate(self, request):
        authenticated = super().authenticate(request)
        if not authenticated:
            return authenticated

        user, token = authenticated
        if user and user.is_authenticated:
            self._update_last_seen(user)
        return (user, token)

    def _update_last_seen(self, user):
        now = timezone.now()
        profile = getattr(user, 'profile', None)
        if profile is None:
            profile, _ = UserProfile.objects.get_or_create(user=user)

        if profile.last_seen and (now - profile.last_seen) < self.ACTIVITY_WRITE_INTERVAL:
            return

        UserProfile.objects.filter(pk=profile.pk).update(last_seen=now)
