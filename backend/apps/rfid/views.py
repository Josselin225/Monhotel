from datetime import datetime, time
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.accounts.permissions import IsAdminOrManager
from apps.tenants.mixins import HotelScopeMixin
from apps.bookings.models import Booking
from apps.rooms.models import Room
from .models import RfidCard
from .serializers import RfidCardSerializer


class RfidCardViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    """Cartes-clés RFID : émission liée à une réservation (ou carte personnel/passe),
    désactivation, déclaration de perte, et vérification d'accès (simulation lecteur)."""
    queryset = RfidCard.objects.select_related('booking', 'booking__client', 'room', 'issued_by').all()
    serializer_class = RfidCardSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'card_type', 'room']
    search_fields = ['uid', 'booking__reference', 'booking__client__first_name', 'booking__client__last_name']
    ordering_fields = ['created_at', 'valid_until']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAdminOrManager()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        self.check_related_hotel(serializer.validated_data.get('booking'), 'booking')
        self.check_related_hotel(serializer.validated_data.get('room'), 'room')
        serializer.save(hotel=self.get_hotel(), issued_by=self.request.user)

    def perform_update(self, serializer):
        self.check_related_hotel(serializer.validated_data.get('booking'), 'booking')
        self.check_related_hotel(serializer.validated_data.get('room'), 'room')
        serializer.save()

    @action(detail=False, methods=['post'])
    def issue(self, request):
        """Émet (ou réémet) une carte : {uid, booking? , room?, card_type?, valid_from?, valid_until?, notes?}.
        Toute autre carte active partageant le même UID dans l'hôtel est automatiquement désactivée
        (réattribution d'une carte physique réutilisée)."""
        uid = str(request.data.get('uid') or '').strip()
        if not uid:
            return Response({'detail': "L'identifiant de la carte est requis (scannez ou saisissez-le)."}, status=400)

        card_type = request.data.get('card_type') or RfidCard.CardType.GUEST
        booking_id = request.data.get('booking')
        room_id = request.data.get('room')
        notes = str(request.data.get('notes') or '').strip()
        hotel = self.get_hotel()

        booking = None
        room = None
        valid_from = request.data.get('valid_from')
        valid_until = request.data.get('valid_until')

        with transaction.atomic():
            if booking_id:
                qs = Booking.objects.all()
                if hotel is not None:
                    qs = qs.filter(hotel=hotel)
                try:
                    booking = qs.select_related('room', 'client').get(pk=booking_id)
                except Booking.DoesNotExist:
                    return Response({'detail': 'Réservation introuvable.'}, status=404)
                room = booking.room
                if not valid_from:
                    valid_from = timezone.now()
                if not valid_until:
                    valid_until = timezone.make_aware(datetime.combine(booking.check_out, time.min))
            elif room_id:
                qs = Room.objects.all()
                if hotel is not None:
                    qs = qs.filter(hotel=hotel)
                try:
                    room = qs.get(pk=room_id)
                except Room.DoesNotExist:
                    return Response({'detail': 'Chambre introuvable.'}, status=404)

            # Désactive toute autre carte active portant le même UID dans cet hôtel.
            # Sauvegarde individuellement (pas de .update() en masse) pour que le
            # journal d'audit capture chaque désactivation.
            existing = RfidCard.objects.select_for_update().filter(uid=uid, status=RfidCard.Status.ACTIVE)
            if hotel is not None:
                existing = existing.filter(hotel=hotel)
            for old_card in existing:
                old_card.status = RfidCard.Status.INACTIVE
                old_card.save(update_fields=['status', 'updated_at'])

            card = RfidCard.objects.create(
                hotel=hotel, uid=uid, card_type=card_type, status=RfidCard.Status.ACTIVE,
                booking=booking, room=room, valid_from=valid_from, valid_until=valid_until,
                issued_by=request.user, notes=notes,
            )
        return Response(RfidCardSerializer(card).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        card = self.get_object()
        card.status = RfidCard.Status.INACTIVE
        card.save(update_fields=['status', 'updated_at'])
        return Response(RfidCardSerializer(card).data)

    @action(detail=True, methods=['post'])
    def mark_lost(self, request, pk=None):
        card = self.get_object()
        card.status = RfidCard.Status.LOST
        card.save(update_fields=['status', 'updated_at'])
        return Response(RfidCardSerializer(card).data)

    @action(detail=False, methods=['post'])
    def check_access(self, request):
        """Simule l'interrogation d'un lecteur de porte : {uid, room?} -> autorisé ou non, avec motif."""
        uid = str(request.data.get('uid') or '').strip()
        room_id = request.data.get('room')
        hotel = self.get_hotel()

        if not uid:
            return Response({'authorized': False, 'reason': "Aucun identifiant scanné."})

        qs = RfidCard.objects.filter(uid=uid, status=RfidCard.Status.ACTIVE).select_related('room', 'booking', 'booking__client')
        if hotel is not None:
            qs = qs.filter(hotel=hotel)
        card = qs.order_by('-created_at').first()

        if not card:
            return Response({'authorized': False, 'reason': 'Carte inconnue ou inactive.', 'card': None})

        now = timezone.now()
        if card.valid_from and now < card.valid_from:
            return Response({'authorized': False, 'reason': "Carte pas encore valide.", 'card': RfidCardSerializer(card).data})
        if card.valid_until and now > card.valid_until:
            return Response({'authorized': False, 'reason': 'Carte expirée.', 'card': RfidCardSerializer(card).data})
        if room_id and card.room_id and str(card.room_id) != str(room_id):
            return Response({'authorized': False, 'reason': "Cette carte n'est pas valide pour cette chambre.", 'card': RfidCardSerializer(card).data})

        return Response({'authorized': True, 'reason': 'Accès autorisé.', 'card': RfidCardSerializer(card).data})
