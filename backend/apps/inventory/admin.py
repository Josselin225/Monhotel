from django.contrib import admin
from .models import InventoryCategory, InventoryItem, InventoryMovement


@admin.register(InventoryCategory)
class InventoryCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'icon']
    search_fields = ['name']


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'quantity_on_hand', 'unit', 'reorder_threshold', 'is_active']
    list_filter = ['category', 'is_active']
    search_fields = ['name']


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ['reference', 'item', 'movement_type', 'quantity', 'room', 'created_at']
    list_filter = ['movement_type']
    search_fields = ['reference', 'item__name']
