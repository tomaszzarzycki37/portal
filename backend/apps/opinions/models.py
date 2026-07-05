"""Models for opinions app"""
from decimal import Decimal

from django.db import models
from django.utils.text import slugify
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.cars.models import CarModel

from .rating_schema import (
    flatten_detailed_ratings,
    migrate_legacy_to_detailed,
    sync_legacy_ratings_from_detailed,
)


class Opinion(models.Model):
    """User opinion/review about a car"""
    car_model = models.ForeignKey(CarModel, on_delete=models.CASCADE, related_name='opinions')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='opinions')
    title = models.CharField(max_length=200)
    content = models.TextField()
    
    # Category-based ratings (1-5 each)
    rating_quality = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        help_text='Quality rating (1-5)'
    )
    rating_workmanship = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        help_text='Workmanship rating (1-5)'
    )
    rating_economy = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        help_text='Economy rating (1-5)'
    )
    rating_safety = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        help_text='Safety rating (1-5)'
    )
    rating_comfort = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        help_text='Comfort rating (1-5)'
    )
    rating_performance = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        help_text='Performance rating (1-5)'
    )
    rating_design = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        help_text='Design rating (1-5)'
    )
    rating_reliability = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        help_text='Reliability rating (1-5)'
    )

    detailed_ratings = models.JSONField(default=dict, blank=True)
    fuel_consumption_min = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    fuel_consumption_max = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    # Metadata
    is_verified_owner = models.BooleanField(default=False)
    helpful_count = models.IntegerField(default=0)
    unhelpful_count = models.IntegerField(default=0)
    
    # Status
    is_approved = models.BooleanField(default=True)  # Moderation flag
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('car_model', 'author')  # One opinion per user per car

    def __str__(self):
        return f"{self.title} - {self.author.username}"

    @property
    def uses_detailed_ratings(self):
        return bool(self.detailed_ratings)

    @property
    def fuel_consumption_avg(self):
        if self.fuel_consumption_min is None or self.fuel_consumption_max is None:
            return None
        return round((self.fuel_consumption_min + self.fuel_consumption_max) / Decimal('2'), 2)

    def ensure_detailed_ratings(self):
        if not self.detailed_ratings:
            self.detailed_ratings = migrate_legacy_to_detailed(self)
        return self.detailed_ratings

    def apply_detailed_ratings(self, detailed_ratings):
        self.detailed_ratings = detailed_ratings
        legacy = sync_legacy_ratings_from_detailed(detailed_ratings)
        for field, value in legacy.items():
            setattr(self, field, value)
    
    @property
    def rating(self):
        """Calculate average rating from detailed or legacy categories."""
        if self.detailed_ratings:
            values = flatten_detailed_ratings(self.detailed_ratings)
            if values:
                return round(sum(values) / len(values), 1)
        ratings = [
            self.rating_quality, self.rating_workmanship, self.rating_economy,
            self.rating_safety, self.rating_comfort, self.rating_performance,
            self.rating_design, self.rating_reliability
        ]
        return round(sum(ratings) / len(ratings), 1) if ratings else 0


class Comment(models.Model):
    """Comment on an opinion"""
    opinion = models.ForeignKey(Opinion, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='opinion_comments')
    content = models.TextField()
    is_approved = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author.username} on {self.opinion.title}"


class Vote(models.Model):
    """Voting system for opinions (for future expansion)"""
    VOTE_CHOICES = [
        ('helpful', 'Helpful'),
        ('unhelpful', 'Unhelpful'),
    ]

    opinion = models.ForeignKey(Opinion, on_delete=models.CASCADE, related_name='votes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='opinion_votes')
    vote_type = models.CharField(max_length=10, choices=VOTE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('opinion', 'user')  # One vote per user per opinion

    def __str__(self):
        return f"{self.user.username} - {self.vote_type} - {self.opinion.title}"


class PressReview(models.Model):
    """Editorial/press review article about a car model."""
    CATEGORY_CHOICES = [
        ('test', 'Test'),
        ('news', 'News'),
        ('guide', 'Guide'),
        ('opinion', 'Opinion'),
    ]

    car_model = models.ForeignKey(CarModel, on_delete=models.CASCADE, related_name='press_reviews')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='press_reviews_authored')
    title = models.CharField(max_length=220)
    slug = models.SlugField(max_length=240, blank=True, db_index=True, editable=False)
    summary = models.TextField(blank=True)
    content = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='test')
    tags = models.CharField(max_length=300, blank=True, help_text='Comma-separated tags')
    reading_time_minutes = models.PositiveSmallIntegerField(default=0)
    internal_notes = models.TextField(blank=True)
    publication_name = models.CharField(max_length=180, blank=True, default='')
    publication_url = models.URLField(blank=True)
    author_name = models.CharField(max_length=120, blank=True)
    published_at = models.DateField()
    is_featured = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-published_at', '-created_at']

    def __str__(self):
        return self.title if not self.publication_name else f"{self.title} ({self.publication_name})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title)[:220] or 'article'
            candidate = base_slug
            suffix = 2
            while PressReview.objects.exclude(pk=self.pk).filter(slug=candidate).exists():
                candidate = f"{base_slug[:210]}-{suffix}"
                suffix += 1
            self.slug = candidate
        super().save(*args, **kwargs)
