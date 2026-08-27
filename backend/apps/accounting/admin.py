from django.contrib import admin
from .models import Transaction


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display  = ['reference', 'type', 'category', 'date', 'description', 'amount', 'payment_method']
    list_filter   = ['type', 'category', 'payment_method', 'date']
    search_fields = ['reference', 'description', 'notes']
    ordering      = ['-date']
    date_hierarchy = 'date'
