import datetime

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Room, RoomType, PricingRule
from .serializers import RoomSerializer, RoomTypeSerializer, PricingRuleSerializer
from .pricing import calculate_price
from apps.accounts.permissions import IsAdminOrManager
from apps.tenants.mixins import HotelScopeMixin


class RoomTypeViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    # NB: list/retrieve restent publics (AllowAny, vitrine du site) — pour un
    # visiteur anonyme (sans hotel), HotelScopeMixin ne filtre pas. Les actions
    # d'écriture restent réservées à IsAdminOrManager d'un hôtel authentifié,
    # qui lui est correctement cloisonné.
    queryset = RoomType.objects.all()
    serializer_class = RoomTypeSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAdminOrManager()]


class RoomPagination(PageNumberPagination):
    page_size = 10


class RoomViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    queryset = Room.objects.select_related('room_type').all()
    serializer_class = RoomSerializer
    pagination_class = RoomPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'floor', 'room_type']
    search_fields = ['number', 'room_type__name']
    ordering_fields = ['number', 'floor', 'price_override']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAdminOrManager()]


class PricingRuleViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    queryset = PricingRule.objects.select_related('room_type').all()
    serializer_class = PricingRuleSerializer
    permission_classes = [IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['rule_type', 'is_active', 'room_type']
    ordering_fields = ['priority', 'name', 'created_at']

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def calculate(self, request):
        """
        GET /api/rooms/pricing-rules/calculate/?room=<id>&check_in=YYYY-MM-DD&check_out=YYYY-MM-DD
        Returns computed price_per_night + applied rules.
        """
        room_id   = request.query_params.get('room')
        check_in  = request.query_params.get('check_in')
        check_out = request.query_params.get('check_out')

        if not all([room_id, check_in, check_out]):
            return Response({'detail': 'room, check_in et check_out sont requis.'}, status=400)

        hotel = self.get_hotel()
        rooms_qs = Room.objects.select_related('room_type')
        if hotel is not None:
            rooms_qs = rooms_qs.filter(hotel=hotel)
        try:
            room = rooms_qs.get(pk=room_id)
        except Room.DoesNotExist:
            return Response({'detail': 'Chambre introuvable.'}, status=404)

        try:
            ci = datetime.date.fromisoformat(check_in)
            co = datetime.date.fromisoformat(check_out)
        except ValueError:
            return Response({'detail': 'Format de date invalide (YYYY-MM-DD).'}, status=400)

        if co <= ci:
            return Response({'detail': 'check_out doit être après check_in.'}, status=400)

        nights = (co - ci).days
        result = calculate_price(room, ci, co)
        result['nights']      = nights
        result['total_price'] = round(result['price_per_night'] * nights, 2)
        return Response(result)
