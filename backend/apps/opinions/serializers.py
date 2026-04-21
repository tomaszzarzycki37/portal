"""Serializers for opinions app"""
from rest_framework import serializers
from .models import Opinion, Comment, Vote
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
    car_name = serializers.CharField(source='car_model.name', read_only=True)
    comments_count = serializers.SerializerMethodField()

    class Meta:
        model = Opinion
        fields = ['id', 'car_name', 'title', 'rating', 'author', 'helpful_count', 
                  'unhelpful_count', 'comments_count', 'is_verified_owner', 'created_at']

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
