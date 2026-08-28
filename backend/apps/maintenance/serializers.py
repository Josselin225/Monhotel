from rest_framework import serializers
from .models import MaintenanceTicket, Technician


class TechnicianSerializer(serializers.ModelSerializer):
    specialty_display = serializers.CharField(source='get_specialty_display', read_only=True)
    # Alimenté par l'annotation Count('tickets') du queryset (évite un N+1 par technicien) ;
    # `default=0` couvre l'instance fraîchement créée (hors queryset annoté).
    tickets_count     = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model  = Technician
        fields = '__all__'
        read_only_fields = ['created_at']


class MaintenanceTicketSerializer(serializers.ModelSerializer):
    priority_display   = serializers.CharField(source='get_priority_display', read_only=True)
    status_display     = serializers.CharField(source='get_status_display', read_only=True)
    category_display   = serializers.CharField(source='get_category_display', read_only=True)
    reported_by_name   = serializers.SerializerMethodField()
    assigned_to_name   = serializers.SerializerMethodField()
    room_number        = serializers.SerializerMethodField()
    technician_name    = serializers.SerializerMethodField()
    technician_phone   = serializers.SerializerMethodField()
    technician_specialty = serializers.SerializerMethodField()

    class Meta:
        model  = MaintenanceTicket
        fields = '__all__'
        read_only_fields = ['reference', 'created_at', 'updated_at']

    def get_reported_by_name(self, obj):
        return obj.reported_by.get_full_name() or obj.reported_by.email if obj.reported_by else None

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.get_full_name() or obj.assigned_to.email if obj.assigned_to else None

    def get_room_number(self, obj):
        return obj.room.number if obj.room else None

    def get_technician_name(self, obj):
        return obj.technician.name if obj.technician else None

    def get_technician_phone(self, obj):
        return obj.technician.phone if obj.technician else None

    def get_technician_specialty(self, obj):
        return obj.technician.get_specialty_display() if obj.technician else None
