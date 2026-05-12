"""Models for cars app"""
from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from uuid import uuid4


def _build_unique_slug(model_cls, base_value, instance_id=None):
    base_slug = slugify(base_value or '')
    if not base_slug:
        base_slug = f"item-{uuid4().hex[:8]}"

    candidate = base_slug
    suffix = 2
    while True:
        qs = model_cls.objects.filter(slug=candidate)
        if instance_id is not None:
            qs = qs.exclude(pk=instance_id)
        if not qs.exists():
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


class Brand(models.Model):
    """Chinese car brand model"""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    description_en = models.TextField(blank=True, help_text="English description (required)")
    description_pl = models.TextField(blank=True, help_text="Polish description (optional but recommended)")
    brand_anecdote_en = models.TextField(blank=True, default='', help_text="Brand story/anecdote in English")
    brand_anecdote_pl = models.TextField(blank=True, default='', help_text="Brand story/anecdote in Polish")
    logo = models.ImageField(upload_to='brands/', blank=True, null=True)
    founded_year = models.IntegerField(null=True, blank=True)
    country = models.CharField(max_length=100, default='China')
    website = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Brands'

    def __str__(self):
        return self.name

    def clean(self):
        """Validate that English description is populated"""
        errors = {}
        
        if not self.description_en or self.description_en.strip() == '':
            errors['description_en'] = (
                'English description is required. This prevents language field mismatches '
                'where Polish text might appear in the English view.'
            )
        
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = _build_unique_slug(Brand, self.name, self.pk)
        super().save(*args, **kwargs)


class CarModel(models.Model):
    """Car model/series"""
    VEHICLE_TYPE_CHOICES = [
        ('sedan', 'Sedan'),
        ('suv', 'SUV'),
        ('crossover', 'Crossover'),
        ('hatchback', 'Hatchback'),
        ('coupe', 'Coupe'),
        ('van', 'Van'),
        ('truck', 'Truck'),
        ('other', 'Other'),
    ]

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='models')
    name = models.CharField(max_length=150)
    slug = models.SlugField()
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_TYPE_CHOICES)
    year_introduced = models.IntegerField()
    description = models.TextField()
    image = models.ImageField(upload_to='cars/', blank=True, null=True)
    
    # Specifications
    engine_type = models.CharField(max_length=100, blank=True)
    horsepower = models.IntegerField(null=True, blank=True)
    acceleration = models.CharField(max_length=50, blank=True, help_text='0-100 km/h in seconds')
    top_speed = models.IntegerField(null=True, blank=True, help_text='km/h')
    fuel_consumption = models.CharField(max_length=50, blank=True, help_text='L/100km')
    price_range = models.CharField(max_length=100, blank=True)
    
    # Status
    production_status = models.CharField(
        max_length=20,
        choices=[('active', 'Active'), ('discontinued', 'Discontinued'), ('upcoming', 'Upcoming')],
        default='active'
    )
    is_featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year_introduced', 'name']
        unique_together = ('brand', 'name', 'year_introduced')

    def __str__(self):
        return f"{self.brand.name} {self.name} ({self.year_introduced})"

    @property
    def avg_rating(self):
        """Calculate average rating from opinions"""
        from apps.opinions.models import Opinion
        opinions = Opinion.objects.filter(car_model=self)
        if opinions.exists():
            return opinions.aggregate(models.Avg('rating'))['rating__avg']
        return 0

    @property
    def opinions_count(self):
        """Get total opinions count"""
        from apps.opinions.models import Opinion
        return Opinion.objects.filter(car_model=self).count()

    def save(self, *args, **kwargs):
        if not self.slug:
            source_name = f"{self.brand.name} {self.name}" if self.brand_id else self.name
            self.slug = _build_unique_slug(CarModel, source_name, self.pk)
        super().save(*args, **kwargs)


class CarImage(models.Model):
    """Additional images for a car model"""
    car_model = models.ForeignKey(CarModel, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='cars/')
    caption = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.car_model.name}"
