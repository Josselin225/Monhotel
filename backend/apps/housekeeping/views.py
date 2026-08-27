from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Count, Q
from .models import CleaningTask
from .serializers import CleaningTaskSerializer
from apps.accounts.permissions import IsAdminOrManager
from apps.tenants.mixins import HotelScopeMixin


class CleaningTaskViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    serializer_class = CleaningTaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'assigned_to', 'room']
    search_fields = ['room__number', 'notes']
    ordering_fields = ['created_at', 'scheduled_for', 'priority']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = CleaningTask.objects.select_related(
            'room', 'room__room_type', 'assigned_to', 'booking'
        ).all()
        hotel = self.get_hotel()
        if hotel is not None:
            qs = qs.filter(hotel=hotel)
        return qs

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        task = self.get_object()
        if task.status != CleaningTask.Status.PENDING:
            return Response({'detail': 'La tâche doit être en statut "À nettoyer".'}, status=status.HTTP_400_BAD_REQUEST)
        task.status = CleaningTask.Status.IN_PROGRESS
        task.started_at = timezone.now()
        task.save()
        return Response(CleaningTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = self.get_object()
        if task.status not in [CleaningTask.Status.PENDING, CleaningTask.Status.IN_PROGRESS]:
            return Response({'detail': 'La tâche est déjà terminée ou inspectée.'}, status=status.HTTP_400_BAD_REQUEST)
        task.status = CleaningTask.Status.DONE
        task.completed_at = timezone.now()
        task.room.status = 'available'
        task.room.save()
        task.save()
        return Response(CleaningTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def inspect(self, request, pk=None):
        """Marquer comme inspecté (par le manager)."""
        task = self.get_object()
        if task.status != CleaningTask.Status.DONE:
            return Response({'detail': 'La tâche doit être terminée pour être inspectée.'}, status=status.HTTP_400_BAD_REQUEST)
        task.status = CleaningTask.Status.INSPECTED
        task.save()
        return Response(CleaningTaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assigner la tâche à un utilisateur."""
        task = self.get_object()
        user_id = request.data.get('user_id')
        if user_id:
            from apps.accounts.models import User
            hotel = self.get_hotel()
            users_qs = User.objects.all()
            if hotel is not None:
                users_qs = users_qs.filter(hotel=hotel)
            try:
                task.assigned_to = users_qs.get(pk=user_id)
                task.save()
            except User.DoesNotExist:
                return Response({'detail': 'Utilisateur introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            task.assigned_to = None
            task.save()
        return Response(CleaningTaskSerializer(task).data)

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """Génère des tâches pour toutes les chambres en nettoyage/maintenance sans tâche active."""
        from apps.rooms.models import Room
        from apps.housekeeping.signals import _ensure_task

        hotel = self.get_hotel()
        rooms_qs = Room.objects.all()
        if hotel is not None:
            rooms_qs = rooms_qs.filter(hotel=hotel)
        rooms_cleaning    = rooms_qs.filter(status='cleaning')
        rooms_maintenance = rooms_qs.filter(status='maintenance')

        created = 0
        for room in rooms_cleaning:
            before = CleaningTask.objects.filter(room=room, status__in=['pending', 'in_progress']).count()
            _ensure_task(room, priority='normal')
            after = CleaningTask.objects.filter(room=room, status__in=['pending', 'in_progress']).count()
            if after > before:
                created += 1

        for room in rooms_maintenance:
            before = CleaningTask.objects.filter(room=room, status__in=['pending', 'in_progress']).count()
            _ensure_task(room, priority='urgent')
            after = CleaningTask.objects.filter(room=room, status__in=['pending', 'in_progress']).count()
            if after > before:
                created += 1

        return Response({'created': created, 'detail': f'{created} tâche(s) créée(s).'})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        data = qs.aggregate(
            pending=Count('id', filter=Q(status=CleaningTask.Status.PENDING)),
            in_progress=Count('id', filter=Q(status=CleaningTask.Status.IN_PROGRESS)),
            done=Count('id', filter=Q(status=CleaningTask.Status.DONE)),
            inspected=Count('id', filter=Q(status=CleaningTask.Status.INSPECTED)),
        )
        return Response(data)
