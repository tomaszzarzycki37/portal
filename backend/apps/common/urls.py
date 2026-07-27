from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AdminActionLogViewSet, SiteTextOverrideViewSet, SiteStatusView
from .owner_views import (
    OwnerAdminActivityView,
    OwnerBlockedIPViewSet,
    OwnerContentIntelView,
    OwnerGodModeView,
    OwnerHealthView,
    OwnerOverviewView,
    OwnerSecurityView,
    OwnerTrafficLiveView,
    OwnerTrafficView,
)

router = DefaultRouter()
router.register('content', SiteTextOverrideViewSet, basename='content')
router.register('admin-actions', AdminActionLogViewSet, basename='admin-actions')
router.register('owner/blocked-ips', OwnerBlockedIPViewSet, basename='owner-blocked-ips')

urlpatterns = [
    path('site-status/', SiteStatusView.as_view(), name='site-status'),
    path('owner/overview/', OwnerOverviewView.as_view(), name='owner-overview'),
    path('owner/traffic/', OwnerTrafficView.as_view(), name='owner-traffic'),
    path('owner/traffic/live/', OwnerTrafficLiveView.as_view(), name='owner-traffic-live'),
    path('owner/security/', OwnerSecurityView.as_view(), name='owner-security'),
    path('owner/health/', OwnerHealthView.as_view(), name='owner-health'),
    path('owner/content-intel/', OwnerContentIntelView.as_view(), name='owner-content-intel'),
    path('owner/admin-activity/', OwnerAdminActivityView.as_view(), name='owner-admin-activity'),
    path('owner/god-mode/', OwnerGodModeView.as_view(), name='owner-god-mode'),
    path('', include(router.urls)),
]
