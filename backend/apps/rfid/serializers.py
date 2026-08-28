from rest_framework import serializers
from .models import RfidCard


class RfidCardSerializer(serializers.ModelSerializer):
    card_type_display = serializers.CharField(source='get_card_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_valid_now = serializers.BooleanField(read_only=True)

    room_number = serializers.CharField(source='room.number', read_only=True, default=None)
    booking_reference = serializers.CharField(source='booking.reference', read_only=True, default=None)
    guest_name = serializers.SerializerMethodField()
    issued_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RfidCard
        fields = [
            'id', 'uid', 'card_type', 'card_type_display', 'status', 'status_display', 'is_valid_now',
            'booking', 'booking_reference', 'room', 'room_number', 'guest_name',
            'valid_from', 'valid_until', 'issued_by', 'issued_by_name', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'issued_by', 'created_at', 'updated_at']

    def get_guest_name(self, obj):
        if obj.booking_id and obj.booking.client_id:
            return obj.booking.client.full_name
        return None

    def get_issued_by_name(self, obj):
        if obj.issued_by_id:
            return obj.issued_by.get_full_name() or obj.issued_by.username
        return None

    def validate_uid(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("L'identifiant de la carte est requis.")
        return value
