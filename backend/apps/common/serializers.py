from rest_framework import serializers

from .models import AdminActionLog, BlockedIP, SecurityEvent, SiteTextOverride


class SiteTextOverrideSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteTextOverride
        fields = ['id', 'key', 'lang', 'value', 'updated_at']
        extra_kwargs = {'value': {'allow_blank': True}}


class AdminActionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminActionLog
        fields = [
            'id',
            'actor',
            'actor_username',
            'action_type',
            'object_type',
            'object_id',
            'object_label',
            'metadata',
            'created_at',
        ]
        read_only_fields = fields


class SecurityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityEvent
        fields = [
            'id',
            'event_type',
            'username_attempted',
            'ip_address',
            'user_agent',
            'path',
            'metadata',
            'user',
            'created_at',
        ]
        read_only_fields = fields


class BlockedIPSerializer(serializers.ModelSerializer):
    created_by_username = serializers.SerializerMethodField()

    class Meta:
        model = BlockedIP
        fields = [
            'id',
            'ip_address',
            'reason',
            'is_active',
            'created_by',
            'created_by_username',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_created_by_username(self, obj):
        if not obj.created_by_id:
            return None
        return obj.created_by.username
