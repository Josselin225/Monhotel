from django.contrib import admin
from .models import Shift


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['user', 'date', 'start_time', 'end_time', 'position']
    list_filter = ['position', 'date']
    search_fields = ['user__username', 'user__first_name', 'user__last_name']
    date_hierarchy = 'date'
