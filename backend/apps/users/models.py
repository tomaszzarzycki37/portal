"""Models for users app"""
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    """Extended user profile"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    location = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email_verified = models.BooleanField(default=False)
    is_car_owner = models.BooleanField(default=False)
    force_password_reset = models.BooleanField(default=False)
    password_changed_at = models.DateTimeField(blank=True, null=True)
    password_changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='password_changes_made',
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        return f"{self.user.username} Profile"


class PasswordChangeAudit(models.Model):
    """Audit log for password changes triggered by user or admin actions."""

    target_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_audit_entries')
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='password_audit_actor_entries',
        blank=True,
        null=True,
    )
    changed_at = models.DateTimeField(auto_now_add=True)
    reason = models.CharField(max_length=120, blank=True)
    is_temporary = models.BooleanField(default=False)
    force_reset_required = models.BooleanField(default=False)

    class Meta:
        ordering = ['-changed_at']

    def __str__(self):
        return f"Password audit for {self.target_user.username} at {self.changed_at.isoformat()}"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Create a user profile when a new user is created"""
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Save the user profile when the user is saved"""
    if hasattr(instance, 'profile'):
        instance.profile.save()
