from rest_framework import serializers
from .models import CleaningTask


class CleaningTaskSerializer(serializers.ModelSerializer):
    status_display   = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    room_number      = serializers.CharField(source='room.number', read_only=True)
    room_type        = serializers.CharField(source='room.room_type.name', read_only=True)
    floor            = serializers.IntegerField(source='room.floor', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    booking_ref      = serializers.CharField(source='booking.reference', read_only=True, default=None)

    class Meta:
        model = CleaningTask
        fields = '__all__'

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None
