from rest_framework import serializers
from .models import InventoryCategory, InventoryItem, InventoryMovement


class InventoryCategorySerializer(serializers.ModelSerializer):
    items_count = serializers.IntegerField(source='items.count', read_only=True)

    class Meta:
        model = InventoryCategory
        fields = ['id', 'name', 'icon', 'items_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_name(self, value):
        return value.strip()


class InventoryItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    category_icon = serializers.CharField(source='category.icon', read_only=True, default=None)
    unit_display  = serializers.CharField(source='get_unit_display', read_only=True)
    is_low_stock  = serializers.BooleanField(read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'category', 'category_name', 'category_icon', 'unit', 'unit_display',
            'quantity_on_hand', 'reorder_threshold', 'unit_cost', 'notes',
            'is_active', 'is_low_stock', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'quantity_on_hand', 'created_at', 'updated_at']
        extra_kwargs = {'category': {'required': True}}


class InventoryMovementSerializer(serializers.ModelSerializer):
    movement_type_display = serializers.CharField(source='get_movement_type_display', read_only=True)
    item_name             = serializers.CharField(source='item.name', read_only=True)
    item_unit             = serializers.CharField(source='item.unit', read_only=True)
    room_number           = serializers.CharField(source='room.number', read_only=True, default=None)
    created_by_name       = serializers.SerializerMethodField()

    class Meta:
        model = InventoryMovement
        fields = [
            'id', 'reference', 'item', 'item_name', 'item_unit', 'movement_type', 'movement_type_display',
            'quantity', 'room', 'room_number', 'reason', 'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'reference', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def validate(self, attrs):
        item = attrs.get('item') or getattr(self.instance, 'item', None)
        movement_type = attrs.get('movement_type')
        quantity = attrs.get('quantity')
        if movement_type in (InventoryMovement.MovementType.OUT, InventoryMovement.MovementType.LOSS):
            if item and quantity is not None and quantity > item.quantity_on_hand:
                raise serializers.ValidationError({
                    'quantity': f'Stock insuffisant (disponible : {item.quantity_on_hand} {item.get_unit_display()}).',
                })
        return attrs
