from rest_framework import serializers

from .models import AdminActionLog, SiteTextOverride


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
