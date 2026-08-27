from django.contrib import admin
from .models import Invoice


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['number', 'booking', 'status', 'total', 'payment_method', 'paid_at']
    list_filter = ['status', 'payment_method']
    search_fields = ['number', 'booking__reference']
