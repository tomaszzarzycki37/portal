"""Admin configuration for users app"""
from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import UserProfile, PasswordChangeAudit


class UserProfileInline(admin.TabularInline):
    model = UserProfile
    extra = 0


class UserAdmin(BaseUserAdmin):
    inlines = [UserProfileInline]


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'location', 'email_verified', 'is_car_owner', 'force_password_reset', 'password_changed_at', 'created_at']
    list_filter = ['email_verified', 'is_car_owner', 'force_password_reset', 'created_at']
    search_fields = ['user__username', 'user__email', 'location']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(PasswordChangeAudit)
class PasswordChangeAuditAdmin(admin.ModelAdmin):
    list_display = ['target_user', 'changed_by', 'changed_at', 'is_temporary', 'force_reset_required', 'reason']
    list_filter = ['is_temporary', 'force_reset_required', 'changed_at']
    search_fields = ['target_user__username', 'changed_by__username', 'reason']
    readonly_fields = ['target_user', 'changed_by', 'changed_at', 'reason', 'is_temporary', 'force_reset_required']
