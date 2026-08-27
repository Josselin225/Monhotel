from rest_framework import serializers
from .models import Booking, ExtraService
from apps.clients.serializers import ClientSerializer
from apps.rooms.serializers import RoomSerializer


class ExtraServiceSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model  = ExtraService
        fields = ['id', 'booking', 'category', 'category_display', 'description', 'amount', 'quantity', 'total', 'date', 'created_at']
        read_only_fields = ['id', 'created_at']


class BookingSerializer(serializers.ModelSerializer):
    client_detail = ClientSerializer(source='client', read_only=True)
    room_detail = RoomSerializer(source='room', read_only=True)
    nights          = serializers.IntegerField(read_only=True)
    duration_label  = serializers.CharField(read_only=True)
    billing_type_display = serializers.CharField(source='get_billing_type_display', read_only=True)
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    source_display  = serializers.CharField(source='get_source_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)

    deposit_paid  = serializers.SerializerMethodField()
    extras        = ExtraServiceSerializer(many=True, read_only=True)
    extras_total  = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ['reference', 'total_price', 'deposit_paid_at']

    def get_deposit_paid(self, obj):
        return bool(obj.deposit_paid_at)

    def validate(self, data):
        check_in = data.get('check_in')
        check_out = data.get('check_out')
        room = data.get('room')

        billing_type = data.get('billing_type', 'nightly')
        if check_in and check_out:
            if billing_type == 'nightly' and check_in >= check_out:
                raise serializers.ValidationError(
                    {"check_out": "La date de départ doit être après la date d'arrivée."}
                )
            elif billing_type == 'hourly' and check_in > check_out:
                raise serializers.ValidationError(
                    {"check_out": "La date de départ ne peut pas être avant la date d'arrivée."}
                )

        # Validation de la capacité
        adults   = data.get('adults', 1)
        children = data.get('children', 0)
        if room and (adults + children) > room.room_type.capacity:
            raise serializers.ValidationError({
                "adults": (
                    f"La chambre {room.number} ({room.room_type.name}) "
                    f"a une capacité maximale de {room.room_type.capacity} personne(s). "
                    f"Vous avez indiqué {adults + children} occupant(s)."
                )
            })

        # Prévention du double-booking (ignoré pour les réservations horaires même jour)
        if check_in and check_out and room and billing_type == 'nightly':
            qs = Booking.objects.filter(
                room=room,
                status__in=['pending', 'confirmed', 'checked_in'],
                billing_type='nightly',
                check_in__lt=check_out,
                check_out__gt=check_in,
            )
            # Exclure la réservation en cours de modification
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                conflict = qs.first()
                raise serializers.ValidationError({
                    "room": (
                        f"Cette chambre est déjà réservée du {conflict.check_in} au {conflict.check_out} "
                        f"(réf. {conflict.reference})."
                    )
                })

        return data
