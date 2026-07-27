from django.contrib import admin

from .models import AdminActionLog, BlockedIP, SecurityEvent, SiteRequestLog, SiteSetting, SiteTextOverride


@admin.register(SiteTextOverride)
class SiteTextOverrideAdmin(admin.ModelAdmin):
    list_display = ('key', 'lang', 'updated_at')
    list_filter = ('lang',)
    search_fields = ('key', 'value')


@admin.register(AdminActionLog)
class AdminActionLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'actor_username', 'action_type', 'object_label')
    list_filter = ('action_type', 'object_type', 'created_at')
    search_fields = ('actor_username', 'object_label', 'object_id')
    readonly_fields = (
        'actor',
        'actor_username',
        'action_type',
        'object_type',
        'object_id',
        'object_label',
        'metadata',
        'created_at',
    )


@admin.register(SiteRequestLog)
class SiteRequestLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'method', 'path', 'status_code', 'ip_address', 'is_bot', 'response_ms')
    list_filter = ('method', 'status_code', 'is_bot')
    search_fields = ('path', 'ip_address', 'user_agent')
    readonly_fields = [field.name for field in SiteRequestLog._meta.fields]


@admin.register(SecurityEvent)
class SecurityEventAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'event_type', 'username_attempted', 'ip_address')
    list_filter = ('event_type',)
    search_fields = ('username_attempted', 'ip_address', 'path')
    readonly_fields = [field.name for field in SecurityEvent._meta.fields]


@admin.register(BlockedIP)
class BlockedIPAdmin(admin.ModelAdmin):
    list_display = ('ip_address', 'is_active', 'reason', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('ip_address', 'reason')


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = ('key', 'updated_at', 'updated_by')
    search_fields = ('key', 'value')
