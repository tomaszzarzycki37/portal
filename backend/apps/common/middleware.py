"""Request traffic logging middleware for owner monitoring."""
import time

from django.utils.deprecation import MiddlewareMixin

from .monitoring import (
    get_client_ip,
    is_bot_user_agent,
    should_skip_request_logging,
)


def _safe_int(value, default=0):
    try:
        parsed = int(value)
        return parsed if parsed >= 0 else default
    except (TypeError, ValueError):
        return default


def _response_byte_size(response):
    content_length = response.get('Content-Length')
    if content_length is not None:
        return _safe_int(content_length, 0)

    try:
        content = getattr(response, 'content', None)
        if content is not None:
            return len(content)
    except Exception:
        pass
    return 0


class SiteTrafficMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._traffic_started_at = time.monotonic()
        return None

    def process_response(self, request, response):
        try:
            path = request.path or '/'
            if should_skip_request_logging(path):
                return response

            started = getattr(request, '_traffic_started_at', None)
            duration_ms = None
            if started is not None:
                duration_ms = int((time.monotonic() - started) * 1000)

            user_agent = request.META.get('HTTP_USER_AGENT', '')[:400]
            user = getattr(request, 'user', None)
            user_id = user.id if getattr(user, 'is_authenticated', False) else None
            request_bytes = _safe_int(request.META.get('CONTENT_LENGTH'), 0)
            response_bytes = _response_byte_size(response)

            from .models import SiteRequestLog

            SiteRequestLog.objects.create(
                method=(request.method or 'GET')[:10],
                path=path[:300],
                status_code=getattr(response, 'status_code', 0) or 0,
                ip_address=get_client_ip(request),
                user_agent=user_agent,
                referer=(request.META.get('HTTP_REFERER') or '')[:400],
                is_bot=is_bot_user_agent(user_agent),
                response_ms=duration_ms,
                request_bytes=request_bytes,
                response_bytes=response_bytes,
                user_id=user_id,
            )
        except Exception:
            # Never break responses because of monitoring.
            pass
        return response
