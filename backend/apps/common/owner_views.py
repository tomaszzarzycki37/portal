"""Owner-only monitoring and god-mode APIs."""
from datetime import timedelta
import os
import shutil

from django.contrib.auth.models import User
from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncDate, TruncHour
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cars.models import Brand, CarModel
from apps.opinions.models import Opinion, PressReview
from apps.common.helpers import IsPortalOwner
from apps.common.models import (
    AdminActionLog,
    BlockedIP,
    SecurityEvent,
    SiteRequestLog,
    SiteSetting,
)
from apps.common.monitoring import get_client_ip, log_security_event
from apps.common.owner import is_portal_owner
from apps.common.serializers import BlockedIPSerializer, SecurityEventSerializer


MAINTENANCE_KEY = 'maintenance_mode'
FEATURE_FLAGS_KEY = 'feature_flags_json'
FORCE_LOGOUT_KEY = 'force_logout_before'


def _parse_days(request, default=7, maximum=90):
    raw = request.query_params.get('days', str(default))
    try:
        days = int(raw)
    except (TypeError, ValueError):
        days = default
    return max(1, min(days, maximum))


class OwnerOverviewView(APIView):
    permission_classes = [IsPortalOwner]

    def get(self, request):
        now = timezone.now()
        day_ago = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)

        traffic_qs = SiteRequestLog.objects.filter(created_at__gte=week_ago, is_bot=False)
        security_qs = SecurityEvent.objects.filter(created_at__gte=week_ago)
        failed_24h = SecurityEvent.objects.filter(
            created_at__gte=day_ago,
            event_type=SecurityEvent.EVENT_FAILED_LOGIN,
        ).count()

        return Response({
            'traffic_7d': traffic_qs.count(),
            'unique_ips_7d': traffic_qs.exclude(ip_address='').values('ip_address').distinct().count(),
            'failed_logins_24h': failed_24h,
            'security_events_7d': security_qs.count(),
            'active_blocked_ips': BlockedIP.objects.filter(is_active=True).count(),
            'pending_users': User.objects.filter(
                is_active=True,
                is_staff=False,
                profile__is_approved=False,
            ).exclude(username__iexact='toza').count(),
            'maintenance_mode': SiteSetting.get_value(MAINTENANCE_KEY, '0') in ('1', 'true', 'True'),
            'cars_total': CarModel.objects.count(),
            'opinions_total': Opinion.objects.count(),
            'reviews_total': PressReview.objects.count(),
            'users_total': User.objects.exclude(username__iexact='toza').count(),
        })


class OwnerTrafficView(APIView):
    permission_classes = [IsPortalOwner]

    def get(self, request):
        days = _parse_days(request, default=14)
        since = timezone.now() - timedelta(days=days)
        include_bots = request.query_params.get('include_bots') == '1'
        qs = SiteRequestLog.objects.filter(created_at__gte=since)
        if not include_bots:
            qs = qs.filter(is_bot=False)

        by_day = list(
            qs.annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(hits=Count('id'), unique_ips=Count('ip_address', distinct=True))
            .order_by('day')
        )
        for row in by_day:
            row['day'] = row['day'].isoformat() if row['day'] else None

        top_paths = list(
            qs.values('path')
            .annotate(hits=Count('id'))
            .order_by('-hits')[:20]
        )
        top_referers = list(
            qs.exclude(referer='')
            .values('referer')
            .annotate(hits=Count('id'))
            .order_by('-hits')[:15]
        )
        status_breakdown = list(
            qs.values('status_code')
            .annotate(hits=Count('id'))
            .order_by('-hits')[:12]
        )

        last_24h = timezone.now() - timedelta(hours=24)
        by_hour = list(
            qs.filter(created_at__gte=last_24h)
            .annotate(hour=TruncHour('created_at'))
            .values('hour')
            .annotate(hits=Count('id'))
            .order_by('hour')
        )
        for row in by_hour:
            row['hour'] = row['hour'].isoformat() if row['hour'] else None

        avg_ms = qs.exclude(response_ms__isnull=True).aggregate(avg=Avg('response_ms'))['avg']
        bot_share = SiteRequestLog.objects.filter(created_at__gte=since).aggregate(
            total=Count('id'),
            bots=Count('id', filter=Q(is_bot=True)),
        )

        return Response({
            'days': days,
            'total_hits': qs.count(),
            'unique_ips': qs.exclude(ip_address='').values('ip_address').distinct().count(),
            'avg_response_ms': round(avg_ms or 0, 1),
            'bot_hits': bot_share['bots'] or 0,
            'all_hits_including_bots': bot_share['total'] or 0,
            'by_day': by_day,
            'by_hour_24h': by_hour,
            'top_paths': top_paths,
            'top_referers': top_referers,
            'status_breakdown': status_breakdown,
        })


class OwnerSecurityView(APIView):
    permission_classes = [IsPortalOwner]

    def get(self, request):
        days = _parse_days(request, default=7)
        since = timezone.now() - timedelta(days=days)
        events = SecurityEvent.objects.filter(created_at__gte=since)

        by_type = list(
            events.values('event_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        top_fail_ips = list(
            events.filter(event_type=SecurityEvent.EVENT_FAILED_LOGIN)
            .exclude(ip_address='')
            .values('ip_address')
            .annotate(count=Count('id'))
            .order_by('-count')[:20]
        )
        recent = SecurityEventSerializer(events[:50], many=True).data
        blocked = BlockedIPSerializer(
            BlockedIP.objects.filter(is_active=True).order_by('-created_at')[:50],
            many=True,
        ).data

        return Response({
            'days': days,
            'by_type': by_type,
            'top_failed_ips': top_fail_ips,
            'recent_events': recent,
            'blocked_ips': blocked,
        })


class OwnerBlockedIPViewSet(viewsets.ViewSet):
    permission_classes = [IsPortalOwner]

    def list(self, request):
        rows = BlockedIP.objects.all().order_by('-created_at')[:200]
        return Response(BlockedIPSerializer(rows, many=True).data)

    def create(self, request):
        ip_address = str(request.data.get('ip_address') or '').strip()
        reason = str(request.data.get('reason') or '').strip()[:255]
        if not ip_address:
            return Response({'detail': 'ip_address required'}, status=status.HTTP_400_BAD_REQUEST)

        row, created = BlockedIP.objects.get_or_create(
            ip_address=ip_address,
            defaults={'reason': reason, 'created_by': request.user, 'is_active': True},
        )
        if not created:
            row.is_active = True
            row.reason = reason or row.reason
            row.created_by = request.user
            row.save(update_fields=['is_active', 'reason', 'created_by', 'updated_at'])

        log_security_event(
            event_type=SecurityEvent.EVENT_IP_BLOCKED,
            ip_address=ip_address,
            user=request.user,
            path='/api/common/owner/blocked-ips/',
            metadata={'reason': reason},
        )
        return Response(BlockedIPSerializer(row).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        try:
            row = BlockedIP.objects.get(pk=pk)
        except BlockedIP.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        row.is_active = False
        row.save(update_fields=['is_active', 'updated_at'])
        log_security_event(
            event_type=SecurityEvent.EVENT_IP_UNBLOCKED,
            ip_address=row.ip_address,
            user=request.user,
            path='/api/common/owner/blocked-ips/',
        )
        return Response({'ok': True})


class OwnerHealthView(APIView):
    permission_classes = [IsPortalOwner]

    def get(self, request):
        now = timezone.now()
        day_ago = now - timedelta(days=1)
        media_root = getattr(settings_module(), 'MEDIA_ROOT', None)
        disk = None
        if media_root:
            try:
                usage = shutil.disk_usage(str(media_root))
                disk = {
                    'total_gb': round(usage.total / (1024 ** 3), 2),
                    'used_gb': round(usage.used / (1024 ** 3), 2),
                    'free_gb': round(usage.free / (1024 ** 3), 2),
                    'used_percent': round((usage.used / usage.total) * 100, 1) if usage.total else 0,
                }
            except Exception:
                disk = None

        errors_24h = SiteRequestLog.objects.filter(
            created_at__gte=day_ago,
            status_code__gte=500,
        ).count()
        client_errors_24h = SiteRequestLog.objects.filter(
            created_at__gte=day_ago,
            status_code__gte=400,
            status_code__lt=500,
        ).count()
        avg_ms = SiteRequestLog.objects.filter(
            created_at__gte=day_ago,
            response_ms__isnull=False,
        ).aggregate(avg=Avg('response_ms'))['avg']

        return Response({
            'server_time': now.isoformat(),
            'database_ok': True,
            'errors_5xx_24h': errors_24h,
            'errors_4xx_24h': client_errors_24h,
            'avg_response_ms_24h': round(avg_ms or 0, 1),
            'disk': disk,
            'media_root_exists': bool(media_root and os.path.isdir(str(media_root))),
            'request_logs_total': SiteRequestLog.objects.count(),
            'security_events_total': SecurityEvent.objects.count(),
        })


def settings_module():
    from django.conf import settings
    return settings


class OwnerContentIntelView(APIView):
    permission_classes = [IsPortalOwner]

    def get(self, request):
        days = _parse_days(request, default=14)
        since = timezone.now() - timedelta(days=days)

        top_car_paths = list(
            SiteRequestLog.objects.filter(created_at__gte=since, is_bot=False, path__startswith='/api/cars/')
            .values('path')
            .annotate(hits=Count('id'))
            .order_by('-hits')[:15]
        )

        cars_without_opinions = (
            CarModel.objects.annotate(opinions_total=Count('opinions'))
            .filter(opinions_total=0)
            .select_related('brand')
            .order_by('brand__name', 'name')[:30]
        )
        weak_rated = []
        for car in (
            CarModel.objects.annotate(opinions_total=Count('opinions'))
            .filter(opinions_total__gt=0)
            .select_related('brand')
            .order_by('name')[:200]
        ):
            rating = float(car.avg_rating or 0)
            if 0 < rating < 3.5:
                weak_rated.append({
                    'id': car.id,
                    'name': car.name,
                    'brand': car.brand.name if car.brand_id else '',
                    'avg_rating': rating,
                    'opinions_count': car.opinions_total,
                })
            if len(weak_rated) >= 20:
                break
        weak_rated.sort(key=lambda item: item['avg_rating'])

        registrations = list(
            User.objects.filter(date_joined__gte=since)
            .exclude(username__iexact='toza')
            .annotate(day=TruncDate('date_joined'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )
        for row in registrations:
            row['day'] = row['day'].isoformat() if row['day'] else None

        pending = User.objects.filter(
            is_active=True,
            is_staff=False,
            profile__is_approved=False,
        ).exclude(username__iexact='toza').count()

        return Response({
            'days': days,
            'top_api_car_paths': top_car_paths,
            'cars_without_opinions': [
                {
                    'id': car.id,
                    'name': car.name,
                    'brand': car.brand.name if car.brand_id else '',
                }
                for car in cars_without_opinions
            ],
            'weak_rated_cars': weak_rated,
            'registrations_by_day': registrations,
            'pending_approvals': pending,
            'brands_total': Brand.objects.count(),
            'models_total': CarModel.objects.count(),
            'opinions_total': Opinion.objects.count(),
            'reviews_total': PressReview.objects.count(),
        })


class OwnerAdminActivityView(APIView):
    permission_classes = [IsPortalOwner]

    def get(self, request):
        days = _parse_days(request, default=14)
        since = timezone.now() - timedelta(days=days)
        actions = AdminActionLog.objects.filter(created_at__gte=since).select_related('actor')[:100]
        by_actor = list(
            AdminActionLog.objects.filter(created_at__gte=since)
            .values('actor_username')
            .annotate(count=Count('id'))
            .order_by('-count')[:20]
        )
        online_admins = (
            User.objects.filter(
                is_staff=True,
                is_active=True,
                profile__last_seen__gte=timezone.now() - timedelta(minutes=15),
            )
            .select_related('profile')
            .order_by('-profile__last_seen')
        )
        return Response({
            'days': days,
            'by_actor': by_actor,
            'recent_actions': [
                {
                    'id': row.id,
                    'actor_username': row.actor_username,
                    'action_type': row.action_type,
                    'object_label': row.object_label,
                    'created_at': row.created_at,
                }
                for row in actions
            ],
            'online_admins': [
                {
                    'id': user.id,
                    'username': user.username,
                    'last_seen': user.profile.last_seen if hasattr(user, 'profile') else None,
                    'is_owner': is_portal_owner(user),
                }
                for user in online_admins
            ],
        })


class OwnerGodModeView(APIView):
    permission_classes = [IsPortalOwner]

    def get(self, request):
        return Response({
            'maintenance_mode': SiteSetting.get_value(MAINTENANCE_KEY, '0') in ('1', 'true', 'True'),
            'force_logout_before': SiteSetting.get_value(FORCE_LOGOUT_KEY, ''),
            'feature_flags': SiteSetting.get_value(FEATURE_FLAGS_KEY, '{}'),
        })

    def post(self, request):
        action_name = str(request.data.get('action') or '').strip()
        if action_name == 'maintenance_on':
            SiteSetting.set_value(MAINTENANCE_KEY, '1', user=request.user)
            log_security_event(
                event_type=SecurityEvent.EVENT_MAINTENANCE_ON,
                user=request.user,
                ip_address=get_client_ip(request),
                path='/api/common/owner/god-mode/',
            )
            return Response({'ok': True, 'maintenance_mode': True})

        if action_name == 'maintenance_off':
            SiteSetting.set_value(MAINTENANCE_KEY, '0', user=request.user)
            log_security_event(
                event_type=SecurityEvent.EVENT_MAINTENANCE_OFF,
                user=request.user,
                ip_address=get_client_ip(request),
                path='/api/common/owner/god-mode/',
            )
            return Response({'ok': True, 'maintenance_mode': False})

        if action_name == 'force_logout_all':
            stamp = timezone.now().isoformat()
            SiteSetting.set_value(FORCE_LOGOUT_KEY, stamp, user=request.user)
            log_security_event(
                event_type=SecurityEvent.EVENT_FORCE_LOGOUT,
                user=request.user,
                ip_address=get_client_ip(request),
                path='/api/common/owner/god-mode/',
                metadata={'force_logout_before': stamp},
            )
            return Response({'ok': True, 'force_logout_before': stamp})

        if action_name == 'set_feature_flags':
            flags = request.data.get('feature_flags', '{}')
            if not isinstance(flags, str):
                import json
                flags = json.dumps(flags)
            SiteSetting.set_value(FEATURE_FLAGS_KEY, flags, user=request.user)
            return Response({'ok': True, 'feature_flags': flags})

        return Response({'detail': 'Unknown action'}, status=status.HTTP_400_BAD_REQUEST)
