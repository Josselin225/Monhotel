from django.contrib import admin
from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['reference', 'client', 'room', 'check_in', 'check_out', 'status', 'total_price']
    list_filter = ['status', 'source', 'check_in']
    search_fields = ['reference', 'client__first_name', 'client__last_name', 'room__number']
    date_hierarchy = 'check_in'
