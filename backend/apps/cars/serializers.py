"""Serializers for cars app"""
from rest_framework import serializers
from .models import Brand, CarModel, CarImage


class BrandSerializer(serializers.ModelSerializer):
    model_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Brand
        fields = ['id', 'name', 'slug', 'description', 'description_en', 'description_pl', 'logo', 'founded_year', 'website', 'model_count', 'created_at']


class CarImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CarImage
        fields = ['id', 'image', 'caption', 'uploaded_at']


class CarModelListSerializer(serializers.ModelSerializer):
    brand_id = serializers.IntegerField(source='brand.id', read_only=True)
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    avg_rating = serializers.SerializerMethodField()
    opinions_count = serializers.SerializerMethodField()

    class Meta:
        model = CarModel
        fields = ['id', 'brand_id', 'brand_name', 'name', 'slug', 'vehicle_type', 'year_introduced',
                  'description', 'engine_type', 'production_status', 'image', 'price_range',
                  'avg_rating', 'opinions_count', 'is_featured']

    def get_avg_rating(self, obj):
        return round(obj.avg_rating, 1) if obj.avg_rating else 0

    def get_opinions_count(self, obj):
        return obj.opinions_count


class CarModelDetailSerializer(serializers.ModelSerializer):
    brand = BrandSerializer(read_only=True)
    brand_id = serializers.PrimaryKeyRelatedField(source='brand', queryset=Brand.objects.all(), write_only=True, required=False)
    images = CarImageSerializer(many=True, read_only=True)
    avg_rating = serializers.SerializerMethodField()
    opinions_count = serializers.SerializerMethodField()

    class Meta:
        model = CarModel
        fields = ['id', 'brand', 'brand_id', 'name', 'slug', 'vehicle_type', 'year_introduced', 
                  'description', 'image', 'images', 'engine_type', 'horsepower', 
                  'acceleration', 'top_speed', 'fuel_consumption', 'price_range',
                  'production_status', 'is_featured', 'avg_rating', 'opinions_count',
                  'created_at', 'updated_at']

    def get_avg_rating(self, obj):
        return round(obj.avg_rating, 1) if obj.avg_rating else 0

    def get_opinions_count(self, obj):
        return obj.opinions_count
