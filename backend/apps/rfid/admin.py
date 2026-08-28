from django.contrib import admin
from .models import RfidCard


@admin.register(RfidCard)
class RfidCardAdmin(admin.ModelAdmin):
    list_display = ['uid', 'card_type', 'status', 'room', 'booking', 'valid_from', 'valid_until', 'hotel']
    list_filter = ['status', 'card_type', 'hotel']
    search_fields = ['uid', 'booking__reference']
