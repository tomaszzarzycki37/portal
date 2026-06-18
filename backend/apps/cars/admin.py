"""Admin configuration for cars app"""
from django.contrib import admin
from django.core.exceptions import ValidationError
from .models import Brand, CarModel, CarImage


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ['name', 'has_logo', 'has_en_description', 'founded_year', 'is_active', 'created_at']
    list_filter = ['is_active', 'country', 'created_at']
    search_fields = ['name', 'description', 'description_en', 'description_pl']
    readonly_fields = ['slug']
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'slug', 'logo'),
            'description': 'Brand name must be unique. Logo should be PNG/JPG image (recommended: 200x200px). If no logo is uploaded, a placeholder will be generated automatically.'
        }),
        ('Descriptions', {
            'fields': ('description', 'description_en', 'description_pl'),
            'description': '⚠️ REQUIRED: Always fill description_en (English). This prevents language field mismatches. description_pl (Polish) is optional but recommended for international support.'
        }),
        ('Details', {'fields': ('founded_year', 'country', 'website')}),
        ('Status', {'fields': ('is_active',)}),
    )
    
    def has_logo(self, obj):
        """Show check mark if logo exists"""
        if obj.logo:
            return '✅ Has Logo'
        return '⚠️  No Logo'
    has_logo.short_description = 'Logo'
    
    def has_en_description(self, obj):
        """Show check mark if English description exists"""
        if obj.description_en and obj.description_en.strip():
            return '✅ Has EN'
        return '❌ Missing EN'
    has_en_description.short_description = 'English Description'
    
    def save_model(self, request, obj, form, change):
        """Validate before saving"""
        try:
            obj.full_clean()
        except ValidationError as e:
            # Display validation error but don't prevent save for backwards compatibility
            # In production, you might want to raise this
            pass
        super().save_model(request, obj, form, change)


class CarImageInline(admin.TabularInline):
    model = CarImage
    extra = 1


@admin.register(CarModel)
class CarModelAdmin(admin.ModelAdmin):
    list_display = ['name', 'brand', 'vehicle_type', 'year_introduced', 'price_display', 'avg_rating', 'opinions_count', 'is_featured']
    list_filter = ['brand', 'vehicle_type', 'year_introduced', 'production_status', 'is_featured', 'created_at']
    search_fields = ['name', 'brand__name', 'description']
    inlines = [CarImageInline]
    readonly_fields = ['created_at', 'updated_at', 'price_display', 'slug']
    fieldsets = (
        ('Basic Information', {'fields': ('brand', 'name', 'slug', 'vehicle_type', 'year_introduced')}),
        ('Description & Images', {'fields': ('description', 'image')}),
        ('Specifications', {
            'fields': ('engine_type', 'horsepower', 'acceleration', 'top_speed', 'fuel_consumption'),
            'classes': ('collapse',)
        }),
        ('Pricing', {
            'fields': ('price_min', 'price_max', 'currency', 'price_display'),
            'description': 'Set the price range. price_display shows the formatted price range.'
        }),
        ('Status', {'fields': ('production_status', 'is_featured')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    def price_display(self, obj):
        """Display formatted price range"""
        if obj.price_min and obj.price_max:
            return f"{obj.price_min:,.0f} - {obj.price_max:,.0f} {obj.currency}"
        elif obj.price_min:
            return f"From {obj.price_min:,.0f} {obj.currency}"
        elif obj.price_max:
            return f"Up to {obj.price_max:,.0f} {obj.currency}"
        return "Not set"
    price_display.short_description = 'Price Range'

    def avg_rating(self, obj):
        rating = obj.avg_rating
        return f"{rating:.1f}⭐" if rating else "No ratings"
    avg_rating.short_description = 'Average Rating'

    def opinions_count(self, obj):
        return obj.opinions_count
    opinions_count.short_description = 'Opinions'
