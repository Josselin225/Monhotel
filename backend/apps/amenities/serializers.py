from django.utils import timezone
from rest_framework import serializers
from .models import AmenityReservation, MenuItem


class AmenityReservationSerializer(serializers.ModelSerializer):
    amenity_display   = serializers.CharField(source='get_amenity_display', read_only=True)
    status_display    = serializers.CharField(source='get_status_display', read_only=True)
    source_display    = serializers.CharField(source='get_source_display', read_only=True)
    client_full_name  = serializers.CharField(source='client.full_name', read_only=True, default=None)
    can_delete        = serializers.SerializerMethodField()

    class Meta:
        model = AmenityReservation
        fields = [
            'id', 'amenity', 'amenity_display', 'client', 'client_full_name', 'client_name', 'client_phone',
            'date', 'start_time', 'end_time', 'party_size', 'detail', 'price',
            'status', 'status_display', 'source', 'source_display', 'notes', 'can_delete',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'source', 'created_by', 'created_at', 'updated_at']

    def get_can_delete(self, obj):
        # Une réservation confirmée et pas encore passée doit d'abord être
        # annulée avant de pouvoir être supprimée (même règle côté vue).
        return not (obj.status == AmenityReservation.Status.CONFIRMED and obj.date >= timezone.now().date())

    def validate_client_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Le nom du client est requis.')
        return value

    def validate(self, attrs):
        start = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        end   = attrs.get('end_time', getattr(self.instance, 'end_time', None))
        if start is not None and end is not None and end <= start:
            raise serializers.ValidationError("L'heure de fin doit être après l'heure de début.")
        return attrs


class MenuItemSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = MenuItem
        fields = ['id', 'name', 'description', 'category', 'category_display', 'price', 'is_available', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Le nom du plat est requis.')
        return value
