from django.contrib import admin
from .models import MaintenanceTicket, Technician


@admin.register(Technician)
class TechnicianAdmin(admin.ModelAdmin):
    list_display = ['name', 'specialty', 'company', 'phone', 'is_active', 'hotel']
    list_filter = ['specialty', 'is_active', 'hotel']
    search_fields = ['name', 'company', 'phone', 'email']


@admin.register(MaintenanceTicket)
class MaintenanceTicketAdmin(admin.ModelAdmin):
    list_display = ['reference', 'title', 'room', 'category', 'priority', 'status', 'technician', 'hotel']
    list_filter = ['status', 'priority', 'category', 'hotel']
    search_fields = ['reference', 'title', 'description', 'room__number']
