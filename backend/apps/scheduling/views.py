from django.db.models import Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrManager
from apps.tenants.mixins import HotelScopeMixin
from .models import Shift
from .serializers import ShiftSerializer


class ShiftViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    """Planning du personnel — consultable par tous, modifiable par admin/manager."""
    queryset = Shift.objects.select_related('user', 'created_by').all()
    serializer_class = ShiftSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['user', 'position', 'date']
    ordering_fields = ['date', 'start_time']
    ordering = ['date', 'start_time']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
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

    @action(detail=False, methods=['get'])
    def mine(self, request):
        """Mes créneaux à venir."""
        from django.utils import timezone
        qs = self.get_queryset().filter(user=request.user, date__gte=timezone.now().date())[:20]
        return Response(ShiftSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Total d'heures planifiées par personne sur la période filtrée (date_from/date_to)."""
        qs = self.get_queryset()
        totals = {}
        for shift in qs.select_related('user'):
            key = shift.user_id
            if key not in totals:
                totals[key] = {'user': key, 'user_name': shift.user.get_full_name() or shift.user.username, 'hours': 0}
            totals[key]['hours'] += shift.hours
        return Response(sorted(totals.values(), key=lambda x: -x['hours']))

    @action(detail=False, methods=['get'])
    def pdf(self, request):
        """PDF vectoriel du planning de la semaine (date_from/date_to), en substitut de l'impression navigateur."""
        from datetime import date
        from apps.accounts.models import User
        from .pdf import generate_schedule_pdf_response

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if not date_from or not date_to:
            return Response({'detail': 'date_from et date_to sont requis.'}, status=400)
        week_start = date.fromisoformat(date_from)
        week_end = date.fromisoformat(date_to)

        shifts = list(self.get_queryset().select_related('user'))
        hotel = self.get_hotel()
        users = User.objects.filter(hotel=hotel).order_by('first_name', 'last_name') if hotel else User.objects.none()

        return generate_schedule_pdf_response(week_start, week_end, users, shifts)
