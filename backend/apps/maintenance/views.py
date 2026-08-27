from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from django.utils import timezone
from .models import MaintenanceTicket, Technician
from .serializers import MaintenanceTicketSerializer, TechnicianSerializer
from apps.tenants.mixins import HotelScopeMixin


class TechnicianViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    queryset = Technician.objects.all()
    serializer_class = TechnicianSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'company', 'phone', 'email']
    ordering_fields = ['name', 'specialty', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        qs = super().get_queryset()
        active = self.request.query_params.get('active')
        if active == 'true':
            qs = qs.filter(is_active=True)
        specialty = self.request.query_params.get('specialty')
        if specialty:
            qs = qs.filter(specialty=specialty)
        return qs


class MaintenanceTicketViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    queryset = MaintenanceTicket.objects.select_related('room', 'reported_by', 'assigned_to', 'technician').all()
    serializer_class = MaintenanceTicketSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'category', 'room', 'assigned_to']
    search_fields = ['reference', 'title', 'description', 'room__number']
    ordering_fields = ['created_at', 'updated_at', 'priority', 'status']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user, hotel=self.get_hotel())

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        ticket = self.get_object()
        notes = request.data.get('resolution_notes', '')
        cost  = request.data.get('cost')
        ticket.status = MaintenanceTicket.Status.RESOLVED
        ticket.resolved_at = timezone.now()
        ticket.resolution_notes = notes
        if cost is not None:
            ticket.cost = cost
        ticket.save(update_fields=['status', 'resolved_at', 'resolution_notes', 'cost', 'updated_at'])
        return Response(MaintenanceTicketSerializer(ticket).data)

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        ticket = self.get_object()
        user_id = request.data.get('user_id')
        if user_id:
            from apps.accounts.models import User
            hotel = self.get_hotel()
            users_qs = User.objects.filter(pk=user_id)
            if hotel is not None:
                users_qs = users_qs.filter(hotel=hotel)
            user = users_qs.first()
            ticket.assigned_to = user
            ticket.status = MaintenanceTicket.Status.IN_PROGRESS
            ticket.save(update_fields=['assigned_to', 'status', 'updated_at'])
        return Response(MaintenanceTicketSerializer(ticket).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        counts = qs.aggregate(
            total=Count('id'),
            open=Count('id', filter=Q(status='open')),
            in_progress=Count('id', filter=Q(status='in_progress')),
            resolved=Count('id', filter=Q(status='resolved')),
            urgent=Count('id', filter=Q(priority='urgent', status__in=['open', 'in_progress'])),
        )
        return Response(counts)
