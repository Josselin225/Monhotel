import csv
from django.http import HttpResponse
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from apps.accounts.permissions import IsAdmin, IsAdminOrManager
from mon_hotel_backend.csv_utils import sanitize_csv_cell
from .models import AuditEntry
from .serializers import AuditEntrySerializer


class AuditEntryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditEntry.objects.select_related('user').all()
    serializer_class = AuditEntrySerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action', 'model_name', 'user']
    search_fields    = ['object_repr', 'description', 'model_name']
    ordering_fields  = ['created_at']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action == 'clear':
            return [IsAuthenticated(), IsAdmin()]
        if self.action == 'log_view':
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        hotel = getattr(self.request.user, 'hotel', None)
        if hotel is not None:
            qs = qs.filter(hotel=hotel)
        date_from = self.request.query_params.get('date_from')
        date_to   = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export CSV du journal filtré (mêmes filtres que la liste), plafonné pour rester raisonnable."""
        qs = self.filter_queryset(self.get_queryset())[:5000]

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="journal_audit.csv"'
        response.write('﻿')  # BOM pour un affichage correct des accents dans Excel
        writer = csv.writer(response)
        writer.writerow(['Date', 'Utilisateur', 'Action', 'Module', 'Objet', 'ID', 'IP', 'Détails'])
        for e in qs:
            username = (e.user.get_full_name() or e.user.email or e.user.username) if e.user else 'Système'
            details = '; '.join(f"{k}: {v[0]!r} → {v[1]!r}" for k, v in e.changes.items()) if isinstance(e.changes, dict) else ''
            # Les valeurs ci-dessous (object_repr, details/description) peuvent contenir
            # des champs saisis par un visiteur public (ex: nom via la réservation en
            # ligne) — on les passe par sanitize_csv_cell pour bloquer toute injection
            # de formule Excel/LibreOffice à l'ouverture de l'export.
            writer.writerow([
                e.created_at.strftime('%d/%m/%Y %H:%M:%S'),
                sanitize_csv_cell(username),
                e.get_action_display(),
                e.model_name,
                sanitize_csv_cell(e.object_repr),
                e.object_id,
                e.ip_address or '',
                sanitize_csv_cell(details or e.description),
            ])
        return response

    @action(detail=False, methods=['post'], url_path='log-view')
    def log_view(self, request):
        """Consigne la consultation d'une page de l'app par l'utilisateur connecté
        (traçabilité des accès en lecture, ex: qui a consulté la fiche des clients)."""
        label = str(request.data.get('label') or '').strip()[:255]
        path = str(request.data.get('path') or '').strip()[:255]
        if not label:
            return Response({'detail': 'label requis.'}, status=400)
        AuditEntry.objects.create(
            user=request.user,
            hotel=getattr(request.user, 'hotel', None),
            action='view',
            model_name=f"Page : {label}",
            object_repr=label,
            description=path,
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response(status=204)

    @action(detail=False, methods=['post'])
    def clear(self, request):
        """Vide le journal d'audit de l'hôtel (administrateur uniquement). L'action
        elle-même est journalisée pour conserver une trace de qui l'a fait et quand."""
        hotel = getattr(request.user, 'hotel', None)
        qs = AuditEntry.objects.filter(hotel=hotel) if hotel is not None else AuditEntry.objects.all()
        count = qs.count()
        qs.delete()
        AuditEntry.objects.create(
            user=request.user,
            hotel=hotel,
            action='other',
            model_name="Journal d'audit",
            object_repr=f"Journal vidé ({count} entrée{'s' if count > 1 else ''} supprimée{'s' if count > 1 else ''})",
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response({'deleted': count})
