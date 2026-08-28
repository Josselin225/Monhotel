from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.utils import timezone

from apps.accounts.permissions import IsAdminOrManager
from apps.tenants.mixins import HotelScopeMixin
from .models import AmenityReservation, MenuItem
from .serializers import AmenityReservationSerializer, MenuItemSerializer


def _is_protected(reservation):
    """Une réservation confirmée dont la date n'est pas encore passée ne doit
    pas pouvoir être supprimée directement (il faut d'abord l'annuler)."""
    return reservation.status == AmenityReservation.Status.CONFIRMED and reservation.date >= timezone.now().date()


class AmenityReservationViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    """Réservations pour les services de l'hôtel (restaurant, conférence, piscine, spa) —
    un seul endpoint, filtré par `amenity` côté frontend selon la page de gestion ouverte."""
    queryset = AmenityReservation.objects.select_related('client', 'created_by').all()
    serializer_class = AmenityReservationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['amenity', 'status', 'date']
    search_fields = ['client_name', 'client_phone', 'detail']
    ordering_fields = ['date', 'start_time', 'created_at']
    ordering = ['-date', '-start_time']

    def get_permissions(self):
        if self.action in ('destroy', 'bulk_delete'):
            return [IsAdminOrManager()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        date_from = self.request.query_params.get('date_from')
        date_to   = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        serializer.save(hotel=self.get_hotel(), created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if _is_protected(instance):
            return Response(
                {'detail': "Cette réservation est confirmée et à venir : annulez-la d'abord avant de la supprimer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Supprime plusieurs réservations d'un coup, en ignorant celles protégées
        (confirmées et à venir) plutôt que d'échouer sur l'ensemble de la sélection."""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'ids requis.'}, status=status.HTTP_400_BAD_REQUEST)
        qs = self.get_queryset().filter(pk__in=ids)
        protected_ids = [r.id for r in qs if _is_protected(r)]
        deletable = qs.exclude(id__in=protected_ids)
        count, _ = deletable.delete()
        return Response({'count': count, 'skipped': protected_ids})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Compteurs par statut pour le service/la période filtrée — alimente les KPI cards."""
        qs = self.get_queryset()
        amenity = request.query_params.get('amenity')
        if amenity:
            qs = qs.filter(amenity=amenity)
        today = timezone.now().date()
        return Response({
            'total':     qs.count(),
            'today':     qs.filter(date=today).count(),
            'pending':   qs.filter(status=AmenityReservation.Status.PENDING).count(),
            'confirmed': qs.filter(status=AmenityReservation.Status.CONFIRMED).count(),
        })


class MenuItemViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    """Menu du restaurant, géré par le personnel. `is_available` détermine ce qui
    figure au menu du jour affiché aux clients pendant la réservation en ligne."""
    queryset = MenuItem.objects.all()
    serializer_class = MenuItemSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['category', 'is_available']
    ordering_fields = ['category', 'name']
    ordering = ['category', 'name']

    def get_permissions(self):
        if self.action == 'public':
            return [AllowAny()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminOrManager()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(hotel=self.get_hotel())

    @action(detail=False, methods=['get'])
    def public(self, request):
        """Menu du jour public — utilisé par la page de réservation en ligne (sans authentification)."""
        items = MenuItem.objects.filter(is_available=True)
        return Response(MenuItemSerializer(items, many=True).data)
