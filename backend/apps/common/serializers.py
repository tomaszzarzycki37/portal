from rest_framework import serializers

from .models import SiteTextOverride


class SiteTextOverrideSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteTextOverride
        fields = ['id', 'key', 'lang', 'value', 'updated_at']
        extra_kwargs = {'value': {'allow_blank': True}}
