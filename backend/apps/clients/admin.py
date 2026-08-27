from django.contrib import admin
from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'phone', 'email', 'nationality', 'id_type']
    search_fields = ['first_name', 'last_name', 'phone', 'email']
    list_filter = ['nationality', 'id_type']
