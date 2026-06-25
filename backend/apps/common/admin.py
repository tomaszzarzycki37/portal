from django.contrib import admin

from .models import AdminActionLog, SiteTextOverride


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
