"""Models for opinions app"""
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.cars.models import CarModel


class Opinion(models.Model):
    """User opinion/review about a car"""
    car_model = models.ForeignKey(CarModel, on_delete=models.CASCADE, related_name='opinions')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='opinions')
    title = models.CharField(max_length=200)
    content = models.TextField()
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text='Rating from 1 to 5'
    )
    
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
