"""Views for cars app"""
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend
from .models import Brand, CarModel
from .serializers import BrandSerializer, CarModelListSerializer, CarModelDetailSerializer
from apps.common.helpers import IsAdminOrReadOnly


class BrandViewSet(viewsets.ModelViewSet):
    """Brand API endpoint"""
    queryset = Brand.objects.filter(is_active=True).annotate(model_count=Count('models__name', distinct=True))
    serializer_class = BrandSerializer
    lookup_field = 'slug'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'founded_year', 'created_at']
    permission_classes = [IsAdminOrReadOnly]


class CarModelViewSet(viewsets.ModelViewSet):
    """Car Model API endpoint"""
    queryset = CarModel.objects.select_related('brand').prefetch_related('images')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['brand', 'vehicle_type', 'year_introduced', 'production_status', 'is_featured']
    search_fields = ['name', 'brand__name', 'description', 'engine_type']
    ordering_fields = ['name', 'year_introduced', 'created_at']
    ordering = ['-year_introduced', 'name']
    permission_classes = [IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return CarModelDetailSerializer
        return CarModelListSerializer

    @action(detail=True, methods=['get'])
    def opinions(self, request, pk=None):
        """Get opinions for a specific car"""
        from apps.opinions.models import Opinion
        from apps.opinions.serializers import OpinionSerializer
        
        car = self.get_object()
        opinions = Opinion.objects.filter(car_model=car).select_related('author')
        serializer = OpinionSerializer(opinions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured cars"""
        cars = CarModel.objects.filter(is_featured=True)
        serializer = self.get_serializer(cars, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest cars"""
        cars = CarModel.objects.all()[:10]
        serializer = self.get_serializer(cars, many=True)
        return Response(serializer.data)
