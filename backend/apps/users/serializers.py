"""Serializers for users app"""
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['bio', 'avatar', 'location', 'phone', 'email_verified', 'is_car_owner', 'created_at']


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
        ]

    def update(self, instance, validated_data):
        new_password = validated_data.pop('new_password', None)
        profile_phone = validated_data.pop('profile_phone', None)
        profile_location = validated_data.pop('profile_location', None)
        profile_bio = validated_data.pop('profile_bio', None)

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
        profile.save()

        return instance
