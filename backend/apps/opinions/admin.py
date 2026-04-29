"""Admin configuration for opinions app"""
from django.contrib import admin
from .models import Opinion, Comment, Vote, PressReview


@admin.register(Opinion)
class OpinionAdmin(admin.ModelAdmin):
    list_display = ['title', 'car_model', 'author', 'rating', 'is_approved', 'helpful_count', 'created_at']
    list_filter = ['is_approved', 'rating', 'is_verified_owner', 'created_at']
    search_fields = ['title', 'content', 'author__username', 'car_model__name']
    readonly_fields = ['created_at', 'updated_at', 'helpful_count', 'unhelpful_count']
    fieldsets = (
        ('Content', {'fields': ('car_model', 'author', 'title', 'content', 'rating')}),
        ('Status', {'fields': ('is_approved', 'is_verified_owner')}),
        ('Engagement', {'fields': ('helpful_count', 'unhelpful_count')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    def has_add_permission(self, request):
        return False  # Opinions are created through API


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['opinion', 'author', 'is_approved', 'created_at']
    list_filter = ['is_approved', 'created_at']
    search_fields = ['content', 'author__username', 'opinion__title']
    readonly_fields = ['created_at', 'updated_at']

    def has_add_permission(self, request):
        return False


@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = ['opinion', 'user', 'vote_type', 'created_at']
    list_filter = ['vote_type', 'created_at']
    search_fields = ['user__username', 'opinion__title']
    readonly_fields = ['created_at']

    def has_add_permission(self, request):
        return False


@admin.register(PressReview)
class PressReviewAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'car_model', 'category', 'publication_name', 'published_at',
        'reading_time_minutes', 'is_pinned', 'is_featured', 'is_published'
    ]
    list_filter = ['is_published', 'is_featured', 'is_pinned', 'category', 'published_at', 'publication_name']
    search_fields = ['title', 'slug', 'summary', 'content', 'tags', 'publication_name', 'author_name', 'car_model__name']
    readonly_fields = ['created_at', 'updated_at']
    prepopulated_fields = {'slug': ('title',)}
    fieldsets = (
        ('Article', {'fields': ('car_model', 'title', 'slug', 'summary', 'content', 'category', 'tags')}),
        ('Publication', {'fields': ('publication_name', 'publication_url', 'author_name', 'published_at', 'reading_time_minutes')}),
        ('Status', {'fields': ('is_published', 'is_featured', 'is_pinned')}),
        ('Internal', {'fields': ('internal_notes',), 'classes': ('collapse',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
