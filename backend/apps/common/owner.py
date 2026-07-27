"""Portal owner privileges (secret tier above superuser)."""
from django.conf import settings


def get_owner_usernames():
    configured = getattr(settings, 'PORTAL_OWNER_USERNAMES', ('toza',))
    if isinstance(configured, str):
        values = [item.strip() for item in configured.split(',')]
    else:
        values = list(configured)
    return {value.lower() for value in values if value}


def is_portal_owner(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    username = str(getattr(user, 'username', '') or '').strip().lower()
    return username in get_owner_usernames()


def is_owner_username(username):
    return str(username or '').strip().lower() in get_owner_usernames()
