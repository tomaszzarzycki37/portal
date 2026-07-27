"""Traffic and security monitoring helpers."""
from __future__ import annotations

import re
from typing import Optional

BOT_UA_RE = re.compile(
    r'bot|crawler|spider|slurp|bingpreview|facebookexternalhit|curl|wget|python-requests|scrapy',
    re.IGNORECASE,
)

SKIP_PREFIXES = (
    '/static/',
    '/media/',
    '/favicon',
    '/api/schema',
    '/api/docs',
    '/api/redoc',
)


def get_client_ip(request) -> str:
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()[:64]
    return (request.META.get('REMOTE_ADDR') or '')[:64]


def is_bot_user_agent(user_agent: str) -> bool:
    return bool(BOT_UA_RE.search(user_agent or ''))


def should_skip_request_logging(path: str) -> bool:
    normalized = path or '/'
    return any(normalized.startswith(prefix) for prefix in SKIP_PREFIXES)


def log_security_event(
    *,
    event_type: str,
    username_attempted: str = '',
    ip_address: str = '',
    user_agent: str = '',
    path: str = '',
    metadata: Optional[dict] = None,
    user=None,
):
    from .models import SecurityEvent

    return SecurityEvent.objects.create(
        event_type=event_type,
        username_attempted=(username_attempted or '')[:150],
        ip_address=(ip_address or '')[:64],
        user_agent=(user_agent or '')[:400],
        path=(path or '')[:300],
        metadata=metadata or {},
        user=user if getattr(user, 'is_authenticated', False) else None,
    )


def is_ip_blocked(ip_address: str) -> bool:
    if not ip_address:
        return False
    from .models import BlockedIP

    return BlockedIP.objects.filter(ip_address=ip_address, is_active=True).exists()
