"""Admin configuration for cars app"""
from django.contrib import admin
from .models import Brand, CarModel, CarImage


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ['name', 'founded_year', 'is_active', 'created_at']
    list_filter = ['is_active', 'country', 'created_at']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    fieldsets = (
        ('Basic Information', {'fields': ('name', 'slug', 'logo')}),
        ('Details', {'fields': ('description', 'founded_year', 'country', 'website')}),
        ('Status', {'fields': ('is_active',)}),
    )


class CarImageInline(admin.TabularInline):
    model = CarImage
    extra = 1


@admin.register(CarModel)
class CarModelAdmin(admin.ModelAdmin):
    list_display = ['name', 'brand', 'vehicle_type', 'year_introduced', 'avg_rating', 'opinions_count', 'is_featured']
    list_filter = ['brand', 'vehicle_type', 'year_introduced', 'production_status', 'is_featured', 'created_at']
    search_fields = ['name', 'brand__name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    inlines = [CarImageInline]
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Basic Information', {'fields': ('brand', 'name', 'slug', 'vehicle_type', 'year_introduced')}),
        ('Description & Images', {'fields': ('description', 'image')}),
        ('Specifications', {
            'fields': ('engine_type', 'horsepower', 'acceleration', 'top_speed', 'fuel_consumption', 'price_range'),
            'classes': ('collapse',)
        }),
        ('Status', {'fields': ('production_status', 'is_featured')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    def avg_rating(self, obj):
        rating = obj.avg_rating
        return f"{rating:.1f}⭐" if rating else "No ratings"
    avg_rating.short_description = 'Average Rating'

    def opinions_count(self, obj):
        return obj.opinions_count
    opinions_count.short_description = 'Opinions'
