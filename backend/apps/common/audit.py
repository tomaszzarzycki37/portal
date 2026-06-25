"""Helpers for recording admin activity in the portal."""

from .models import AdminActionLog


def log_admin_action(user, action_type, *, object_type='', object_id='', object_label='', metadata=None):
    """Persist an admin action when the actor is an authenticated staff user."""
    if not user or not getattr(user, 'is_authenticated', False) or not user.is_staff:
        return None

    return AdminActionLog.objects.create(
        actor=user,
        actor_username=user.username,
        action_type=action_type,
        object_type=object_type or '',
        object_id=str(object_id) if object_id not in (None, '') else '',
        object_label=(object_label or '')[:255],
        metadata=metadata or {},
    )
