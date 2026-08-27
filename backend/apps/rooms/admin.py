from django.contrib import admin
from .models import Room, RoomType, PricingRule


@admin.register(RoomType)
class RoomTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'base_price', 'capacity']


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['number', 'room_type', 'floor', 'status', 'price']
    list_filter = ['status', 'floor', 'room_type']
    search_fields = ['number']


@admin.register(PricingRule)
class PricingRuleAdmin(admin.ModelAdmin):
    list_display = ['name', 'rule_type', 'room_type', 'percent_change', 'is_active', 'priority']
    list_filter  = ['rule_type', 'is_active', 'room_type']
    search_fields = ['name']
