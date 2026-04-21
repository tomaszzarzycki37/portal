"""Models for cars app"""
from django.db import models
from django.contrib.auth.models import User


class Brand(models.Model):
    """Chinese car brand model"""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    description_pl = models.TextField(blank=True)
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


class CarImage(models.Model):
    """Additional images for a car model"""
    car_model = models.ForeignKey(CarModel, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='cars/')
    caption = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.car_model.name}"
