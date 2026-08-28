from decimal import Decimal
from django.db import transaction
from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrManager
from apps.tenants.mixins import HotelScopeMixin
from .models import InventoryCategory, InventoryItem, InventoryMovement
from .serializers import InventoryCategorySerializer, InventoryItemSerializer, InventoryMovementSerializer


class InventoryCategoryViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    queryset = InventoryCategory.objects.all()
    serializer_class = InventoryCategorySerializer
    filter_backends = [filters.OrderingFilter]
    ordering = ['name']
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        return super().get_queryset().annotate(items_count=Count('items'))

    def get_permissions(self):
        if self.action in ('create', 'destroy'):
            return [IsAdminOrManager()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(hotel=self.get_hotel())

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        if category.items.exists():
            return Response(
                {'detail': "Impossible de supprimer une catégorie utilisée par des articles."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class InventoryItemViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    queryset = InventoryItem.objects.select_related('category').all()
    serializer_class = InventoryItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['name', 'notes']
    ordering_fields = ['name', 'category', 'quantity_on_hand', 'created_at']
    ordering = ['category__name', 'name']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminOrManager()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        qs = self.get_queryset().filter(is_active=True)
        low = [i for i in qs if i.is_low_stock]
        return Response(InventoryItemSerializer(low, many=True).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset().filter(is_active=True)
        total_value = sum((i.quantity_on_hand * i.unit_cost for i in qs), Decimal('0'))
        low_count = sum(1 for i in qs if i.is_low_stock)
        return Response({
            'total_items': qs.count(),
            'low_stock_count': low_count,
            'total_value': float(total_value),
        })


class InventoryMovementViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    queryset = InventoryMovement.objects.select_related('item', 'room', 'created_by').all()
    serializer_class = InventoryMovementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['item', 'movement_type', 'room']
    search_fields = ['reference', 'reason', 'item__name']
    ordering_fields = ['created_at', 'quantity']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'head', 'options']  # mouvements immuables (pas d'update/delete)

    def perform_create(self, serializer):
        item = serializer.validated_data['item']
        hotel = self.get_hotel()
        if hotel is not None and item.hotel_id != hotel.id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'item': 'Article introuvable.'})

        with transaction.atomic():
            movement = serializer.save(hotel=hotel, created_by=self.request.user)
            locked_item = InventoryItem.objects.select_for_update().get(pk=item.pk)
            if movement.movement_type == InventoryMovement.MovementType.IN:
                locked_item.quantity_on_hand += movement.quantity
            elif movement.movement_type in (InventoryMovement.MovementType.OUT, InventoryMovement.MovementType.LOSS):
                locked_item.quantity_on_hand -= movement.quantity
            elif movement.movement_type == InventoryMovement.MovementType.ADJUSTMENT:
                locked_item.quantity_on_hand = movement.quantity
            locked_item.save(update_fields=['quantity_on_hand', 'updated_at'])
