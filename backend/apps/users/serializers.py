"""Serializers for users app"""
from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils import timezone
from .models import UserProfile, PasswordChangeAudit


class UserProfileSerializer(serializers.ModelSerializer):
    password_changed_by_username = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'bio',
            'avatar',
            'location',
            'phone',
            'email_verified',
            'is_car_owner',
            'force_password_reset',
            'password_changed_at',
            'password_changed_by_username',
            'created_at',
        ]

    def get_password_changed_by_username(self, obj):
        if not obj.password_changed_by:
            return None
        return obj.password_changed_by.username


class PasswordChangeAuditSerializer(serializers.ModelSerializer):
    changed_by_username = serializers.SerializerMethodField()

    class Meta:
        model = PasswordChangeAudit
        fields = ['id', 'changed_at', 'reason', 'is_temporary', 'force_reset_required', 'changed_by_username']

    def get_changed_by_username(self, obj):
        if not obj.changed_by:
            return None
        return obj.changed_by.username


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'is_active',
            'is_staff',
            'is_superuser',
            'date_joined',
            'last_login',
            'profile',
        ]


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'first_name', 'last_name']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User(**validated_data)
        password = validated_data.pop('password')
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    new_password = serializers.CharField(write_only=True, required=False, min_length=8)
    profile_phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    profile_location = serializers.CharField(required=False, allow_blank=True, max_length=100)
    profile_bio = serializers.CharField(required=False, allow_blank=True)
    force_password_reset = serializers.BooleanField(required=False)

    class Meta:
        model = User
        fields = [
            'username',
            'email',
            'first_name',
            'last_name',
            'is_active',
            'is_staff',
            'new_password',
            'profile_phone',
            'profile_location',
            'profile_bio',
            'force_password_reset',
        ]

    def update(self, instance, validated_data):
        changed_by = validated_data.pop('changed_by', None)
        new_password = validated_data.pop('new_password', None)
        profile_phone = validated_data.pop('profile_phone', None)
        profile_location = validated_data.pop('profile_location', None)
        profile_bio = validated_data.pop('profile_bio', None)
        force_password_reset = validated_data.pop('force_password_reset', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if new_password:
            instance.set_password(new_password)

        instance.save()

        profile = getattr(instance, 'profile', None)
        if profile is None:
            profile = UserProfile.objects.create(user=instance)

        if profile_phone is not None:
            profile.phone = profile_phone
        if profile_location is not None:
            profile.location = profile_location
        if profile_bio is not None:
            profile.bio = profile_bio

        if force_password_reset is not None:
            profile.force_password_reset = bool(force_password_reset)

        if new_password:
            profile.password_changed_at = timezone.now()
            profile.password_changed_by = changed_by

        profile.save()

        if new_password:
            PasswordChangeAudit.objects.create(
                target_user=instance,
                changed_by=changed_by,
                reason='admin_password_update',
                is_temporary=False,
                force_reset_required=bool(profile.force_password_reset),
            )

        return instance


class UserPasswordResetSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'Passwords do not match.'})
        return attrs
