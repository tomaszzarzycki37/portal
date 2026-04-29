"""Views for opinions app"""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from django_filters.rest_framework import DjangoFilterBackend
from apps.common.helpers import IsOwnerOrAdminOrReadOnly, IsAdminOrReadOnly
from .models import Opinion, Comment, Vote, PressReview
from .serializers import (
    OpinionListSerializer, OpinionDetailSerializer, OpinionCreateUpdateSerializer,
    CommentSerializer, CommentCreateSerializer, VoteCreateSerializer,
    PressReviewListSerializer, PressReviewDetailSerializer, PressReviewWriteSerializer
)


class OpinionViewSet(viewsets.ModelViewSet):
    """Opinion/Review API endpoint"""
    queryset = Opinion.objects.filter(is_approved=True).select_related('author', 'car_model', 'car_model__brand')
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['car_model', 'author', 'rating']
    search_fields = ['title', 'content', 'author__username']
    ordering_fields = ['rating', 'helpful_count', 'created_at']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            permission_classes = [IsOwnerOrAdminOrReadOnly]
        elif self.action in ['create', 'vote', 'add_comment']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAuthenticatedOrReadOnly]
        return [permission() for permission in permission_classes]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return OpinionDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return OpinionCreateUpdateSerializer
        return OpinionListSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def add_comment(self, request, pk=None):
        """Add a comment to an opinion"""
        opinion = self.get_object()
        serializer = CommentCreateSerializer(
            data={'opinion': opinion.id, 'content': request.data.get('content')},
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def vote(self, request, pk=None):
        """Vote on an opinion (helpful/unhelpful)"""
        opinion = self.get_object()
        vote_type = request.data.get('vote_type')
        
        if vote_type not in ['helpful', 'unhelpful']:
            return Response({'error': 'Invalid vote type'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = VoteCreateSerializer(
            data={'opinion': opinion.id, 'vote_type': vote_type},
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            # Update helpful/unhelpful counts
            opinion.helpful_count = opinion.votes.filter(vote_type='helpful').count()
            opinion.unhelpful_count = opinion.votes.filter(vote_type='unhelpful').count()
            opinion.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def top_rated(self, request):
        """Get top-rated opinions"""
        opinions = self.get_queryset().order_by('-rating')[:10]
        serializer = self.get_serializer(opinions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def most_helpful(self, request):
        """Get most helpful opinions"""
        opinions = self.get_queryset().order_by('-helpful_count')[:10]
        serializer = self.get_serializer(opinions, many=True)
        return Response(serializer.data)


class CommentViewSet(viewsets.ModelViewSet):
    """Comment API endpoint"""
    queryset = Comment.objects.filter(is_approved=True).select_related('author', 'opinion')
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filterset_fields = ['opinion']
    search_fields = ['content', 'author__username']
    ordering_fields = ['created_at']
    ordering = ['created_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CommentCreateSerializer
        return CommentSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class PressReviewViewSet(viewsets.ModelViewSet):
    """Press/editorial review articles API endpoint."""
    queryset = PressReview.objects.select_related('car_model', 'car_model__brand')
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['car_model', 'is_featured', 'is_pinned', 'category']
    search_fields = ['title', 'summary', 'content', 'publication_name', 'author_name', 'tags', 'slug', 'car_model__name']
    ordering_fields = ['is_pinned', 'published_at', 'created_at', 'reading_time_minutes']
    ordering = ['-is_pinned', '-published_at', '-created_at']

    def get_queryset(self):
        queryset = PressReview.objects.select_related('car_model', 'car_model__brand')
        if self.request.user and self.request.user.is_authenticated and self.request.user.is_staff:
            return queryset
        return queryset.filter(is_published=True)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PressReviewWriteSerializer
        if self.action == 'retrieve':
            return PressReviewDetailSerializer
        return PressReviewListSerializer

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticatedOrReadOnly])
    def featured(self, request):
        """Get featured press reviews for homepage widgets."""
        limit = request.query_params.get('limit', '6')
        try:
            parsed_limit = max(1, min(int(limit), 20))
        except (TypeError, ValueError):
            parsed_limit = 6

        featured_qs = self.get_queryset().filter(is_featured=True).order_by('-is_pinned', '-published_at', '-created_at')
        serializer = PressReviewListSerializer(featured_qs[:parsed_limit], many=True, context={'request': request})
        return Response(serializer.data)
