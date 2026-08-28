from django.contrib import admin
from .models import Shift, Employee


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ['name', 'position', 'phone', 'is_active', 'user', 'hotel']
    list_filter = ['position', 'is_active', 'hotel']
    search_fields = ['name', 'phone', 'email']


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['employee', 'date', 'start_time', 'end_time', 'position']
    list_filter = ['position', 'date']
    search_fields = ['employee__name']
    date_hierarchy = 'date'
