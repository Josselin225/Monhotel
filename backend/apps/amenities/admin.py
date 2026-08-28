from django.contrib import admin
from .models import AmenityReservation, MenuItem


@admin.register(AmenityReservation)
class AmenityReservationAdmin(admin.ModelAdmin):
    list_display = ['amenity', 'client_name', 'date', 'start_time', 'party_size', 'status', 'source', 'hotel']
    list_filter = ['amenity', 'status', 'source', 'date', 'hotel']
    search_fields = ['client_name', 'client_phone', 'detail']
    date_hierarchy = 'date'


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'price', 'is_available', 'hotel']
    list_filter = ['category', 'is_available', 'hotel']
    search_fields = ['name', 'description']
