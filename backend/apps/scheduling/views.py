from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsAdminOrManager
from apps.accounts.serializers import UserCreateSerializer
from apps.tenants.mixins import HotelScopeMixin
from .models import Shift, Employee
from .serializers import ShiftSerializer, EmployeeSerializer


class EmployeeViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    """Registre du personnel planifiable — indépendant des comptes de connexion."""
    queryset = Employee.objects.select_related('user').all()
    serializer_class = EmployeeSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['position', 'is_active']
    search_fields = ['name', 'phone', 'email']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        return super().get_queryset().annotate(shifts_count=Count('shifts'))

    def get_permissions(self):
        if self.action == 'create_account':
            return [IsAdmin()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminOrManager()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(hotel=self.get_hotel())

    @action(detail=True, methods=['post'])
    def create_account(self, request, pk=None):
        """Crée un compte de connexion pour un employé déjà enregistré et le relie
        à sa fiche — évite de ressaisir ses informations dans Administration › Utilisateurs."""
        employee = self.get_object()
        if employee.user_id:
            return Response({'detail': 'Cet employé a déjà un compte utilisateur lié.'}, status=400)
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save(hotel=employee.hotel)
        employee.user = user
        employee.save(update_fields=['user'])
        return Response(EmployeeSerializer(employee).data, status=201)


class ShiftViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    """Planning du personnel — consultable par tous, modifiable par admin/manager."""
    queryset = Shift.objects.select_related('employee', 'created_by').all()
    serializer_class = ShiftSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['employee', 'position', 'date']
    ordering_fields = ['date', 'start_time']
    ordering = ['date', 'start_time']

    def get_hotel(self):
        # HotelScopeMixin filtre par `hotel=` sur le queryset ; Shift n'a pas de
        # lien direct vers l'hôtel de l'utilisateur connecté autrement que via
        # employee/user, donc on garde le comportement par défaut (request.user.hotel).
        return getattr(self.request.user, 'hotel', None)

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
        self.check_related_hotel(serializer.validated_data.get('employee'), 'employee')
        serializer.save(hotel=self.get_hotel(), created_by=self.request.user)

    def perform_update(self, serializer):
        self.check_related_hotel(serializer.validated_data.get('employee'), 'employee')
        serializer.save()

    @action(detail=False, methods=['get'])
    def mine(self, request):
        """Mes créneaux à venir (nécessite que mon compte soit relié à une fiche employé)."""
        from django.utils import timezone
        employee = getattr(request.user, 'employee_profile', None)
        if not employee:
            return Response([])
        qs = self.get_queryset().filter(employee=employee, date__gte=timezone.now().date())[:20]
        return Response(ShiftSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Total d'heures planifiées par personne sur la période filtrée (date_from/date_to)."""
        qs = self.get_queryset()
        totals = {}
        for shift in qs.select_related('employee'):
            key = shift.employee_id
            if key not in totals:
                totals[key] = {'employee': key, 'employee_name': shift.employee.name, 'hours': 0}
            totals[key]['hours'] += shift.hours
        return Response(sorted(totals.values(), key=lambda x: -x['hours']))

    @action(detail=False, methods=['get'])
    def pdf(self, request):
        """PDF vectoriel du planning de la semaine (date_from/date_to), en substitut de l'impression navigateur."""
        from datetime import date
        from .pdf import generate_schedule_pdf_response

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if not date_from or not date_to:
            return Response({'detail': 'date_from et date_to sont requis.'}, status=400)
        week_start = date.fromisoformat(date_from)
        week_end = date.fromisoformat(date_to)

        shifts = list(self.get_queryset().select_related('employee'))
        hotel = self.get_hotel()
        employees = Employee.objects.filter(hotel=hotel, is_active=True).order_by('name') if hotel else Employee.objects.none()

        return generate_schedule_pdf_response(week_start, week_end, employees, shifts)
