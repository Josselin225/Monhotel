from django.contrib import admin
from .models import CleaningTask


@admin.register(CleaningTask)
class CleaningTaskAdmin(admin.ModelAdmin):
    list_display = ['room', 'status', 'priority', 'assigned_to', 'scheduled_for', 'hotel']
    list_filter = ['status', 'priority', 'hotel']
    search_fields = ['room__number', 'notes']
