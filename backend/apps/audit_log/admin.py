from django.contrib import admin
from .models import AuditEntry


@admin.register(AuditEntry)
class AuditEntryAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'user', 'hotel', 'action', 'model_name', 'object_repr', 'ip_address')
    list_filter = ('action', 'model_name', 'hotel')
    search_fields = ('object_repr', 'description', 'model_name')
    date_hierarchy = 'created_at'
    readonly_fields = [f.name for f in AuditEntry._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
