"""Serializers for opinions app"""
from rest_framework import serializers
from .models import Opinion, Comment, Vote, PressReview
from django.contrib.auth.models import User


class UserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name']


class CommentSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'author', 'content', 'created_at', 'updated_at']


class VoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vote
        fields = ['id', 'vote_type', 'created_at']


class OpinionListSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)
    car_id = serializers.IntegerField(source='car_model.id', read_only=True)
    car_name = serializers.CharField(source='car_model.name', read_only=True)
    car_brand_name = serializers.CharField(source='car_model.brand.name', read_only=True)
    content = serializers.CharField(read_only=True)
    comments_count = serializers.SerializerMethodField()

    class Meta:
        model = Opinion
        fields = ['id', 'car_id', 'car_name', 'car_brand_name', 'title', 'content', 'rating', 'author', 
                  'helpful_count', 'unhelpful_count', 'comments_count', 'is_verified_owner', 'created_at']

    def get_comments_count(self, obj):
        return obj.comments.count()


class OpinionDetailSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)
    car_name = serializers.CharField(source='car_model.name', read_only=True)
    car_id = serializers.IntegerField(source='car_model.id', read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = Opinion
        fields = ['id', 'car_id', 'car_name', 'title', 'content', 'rating', 'author', 
                  'helpful_count', 'unhelpful_count', 'comments', 'user_vote',
                  'is_verified_owner', 'is_approved', 'created_at', 'updated_at']

    def get_user_vote(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            vote = Vote.objects.filter(opinion=obj, user=request.user).first()
            return VoteSerializer(vote).data if vote else None
        return None


class OpinionCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Opinion
        fields = ['car_model', 'title', 'content', 'rating']

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ['opinion', 'content']

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)


class VoteCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vote
        fields = ['opinion', 'vote_type']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        vote, created = Vote.objects.update_or_create(
            opinion=validated_data['opinion'],
            user=self.context['request'].user,
            defaults={'vote_type': validated_data['vote_type']}
        )
        return vote


class PressReviewListSerializer(serializers.ModelSerializer):
    car_id = serializers.IntegerField(source='car_model.id', read_only=True)
    car_name = serializers.CharField(source='car_model.name', read_only=True)
    car_brand_name = serializers.CharField(source='car_model.brand.name', read_only=True)
    author_id = serializers.IntegerField(source='author.id', read_only=True)
    author_username = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = PressReview
        fields = [
            'id', 'car_id', 'car_name', 'car_brand_name', 'title', 'summary', 'content',
            'slug', 'category', 'tags', 'reading_time_minutes',
            'publication_name', 'publication_url', 'author_name', 'published_at',
            'is_featured', 'is_pinned', 'author_id', 'author_username', 'created_at'
        ]


class PressReviewDetailSerializer(serializers.ModelSerializer):
    car_id = serializers.IntegerField(source='car_model.id', read_only=True)
    car_name = serializers.CharField(source='car_model.name', read_only=True)
    car_brand_name = serializers.CharField(source='car_model.brand.name', read_only=True)
    author_id = serializers.IntegerField(source='author.id', read_only=True)
    author_username = serializers.CharField(source='author.username', read_only=True)
    internal_notes = serializers.SerializerMethodField()

    class Meta:
        model = PressReview
        fields = [
            'id', 'car_id', 'car_name', 'car_brand_name', 'title', 'summary', 'content',
            'slug', 'category', 'tags', 'reading_time_minutes', 'internal_notes',
            'publication_name', 'publication_url', 'author_name', 'published_at',
            'is_featured', 'is_pinned', 'is_published', 'author_id', 'author_username', 'created_at', 'updated_at'
        ]

    def get_internal_notes(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return ''
        if request.user.is_staff or obj.author_id == request.user.id:
            return obj.internal_notes
        return ''


class PressReviewWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PressReview
        fields = [
            'car_model', 'title', 'slug', 'summary', 'content',
            'category', 'tags', 'reading_time_minutes', 'internal_notes',
            'publication_name', 'publication_url', 'author_name', 'published_at',
            'is_featured', 'is_pinned', 'is_published'
        ]

    def _sanitize_privileged_flags(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated and request.user.is_staff:
            return validated_data
        validated_data['is_featured'] = False
        validated_data['is_pinned'] = False
        return validated_data

    def create(self, validated_data):
        return super().create(self._sanitize_privileged_flags(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._sanitize_privileged_flags(validated_data))
