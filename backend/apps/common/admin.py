from django.contrib import admin

from .models import SiteTextOverride


@admin.register(SiteTextOverride)
class SiteTextOverrideAdmin(admin.ModelAdmin):
    list_display = ('key', 'lang', 'updated_at')
    list_filter = ('lang',)
    search_fields = ('key', 'value')
