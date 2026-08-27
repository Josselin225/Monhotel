import csv
import io
from mon_hotel_backend.csv_utils import sanitize_csv_cell
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated, AllowAny
from mon_hotel_backend.throttles import PublicBookingThrottle
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count, Sum
from django.db import transaction
from django.utils import timezone
from django.http import HttpResponse
from datetime import date, timedelta
from .models import Booking, ExtraService
from apps.rooms.models import Room
from .serializers import BookingSerializer, ExtraServiceSerializer
from apps.accounts.permissions import IsAdminOrManager
from apps.tenants.mixins import HotelScopeMixin
from .filters import BookingFilter


class BookingViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    queryset = Booking.objects.select_related('client', 'room', 'room__room_type').all()
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = BookingFilter
    search_fields = ['reference', 'client__first_name', 'client__last_name', 'room__number']
    ordering_fields = ['check_in', 'check_out', 'created_at', 'total_price']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ('destroy',):
            return [IsAdminOrManager()]
        return super().get_permissions()

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from django.core.cache import cache
        hotel = self.get_hotel()
        cache_key = f'booking_stats_{hotel.pk if hotel else "none"}_{timezone.now().date()}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        today = timezone.now().date()
        qs = self.get_queryset()
        from django.db.models import Count
        counts = qs.aggregate(
            total=Count('id'),
            pending=Count('id', filter=Q(status=Booking.Status.PENDING)),
            confirmed=Count('id', filter=Q(status=Booking.Status.CONFIRMED)),
            checked_in=Count('id', filter=Q(status=Booking.Status.CHECKED_IN)),
            arrivals_today=Count('id', filter=Q(check_in=today, status=Booking.Status.CONFIRMED)),
            departures_today=Count('id', filter=Q(check_out=today, status=Booking.Status.CHECKED_IN)),
        )
        revenue = qs.filter(
            status=Booking.Status.CHECKED_OUT,
            check_out__month=today.month,
            check_out__year=today.year,
        ).aggregate(total=Sum('total_price'))['total'] or 0
        data = {**counts, 'revenue_month': revenue}
        cache.set(cache_key, data, timeout=300)
        return Response(data)

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """
        Retourne les réservations actives sur une plage de dates.
        ?start=YYYY-MM-DD&end=YYYY-MM-DD
        Chaque entrée : { room_id, room_number, room_type, bookings: [...] }
        """
        start_str = request.query_params.get('start')
        end_str = request.query_params.get('end')
        try:
            start = date.fromisoformat(start_str) if start_str else date.today()
            end = date.fromisoformat(end_str) if end_str else start + timedelta(days=29)
        except ValueError:
            start = date.today()
            end = start + timedelta(days=29)

        active_statuses = [
            Booking.Status.CONFIRMED,
            Booking.Status.CHECKED_IN,
            Booking.Status.PENDING,
        ]
        bookings = (
            self.get_queryset()
            .filter(
                check_in__lte=end,
                check_out__gt=start,
                status__in=active_statuses,
            )
            .order_by('room__number', 'check_in')
        )

        hotel = self.get_hotel()
        rooms = Room.objects.select_related('room_type').order_by('number')
        if hotel is not None:
            rooms = rooms.filter(hotel=hotel)

        room_map = {r.id: {
            'room_id': r.id,
            'room_number': r.number,
            'room_type': r.room_type.name,
            'floor': r.floor,
            'status': r.status,
            'bookings': [],
        } for r in rooms}

        for b in bookings:
            if b.room_id in room_map:
                room_map[b.room_id]['bookings'].append({
                    'id': b.id,
                    'reference': b.reference,
                    'client': b.client.full_name,
                    'check_in': b.check_in.isoformat(),
                    'check_out': b.check_out.isoformat(),
                    'status': b.status,
                    'nights': b.nights,
                })

        return Response({
            'start': start.isoformat(),
            'end': end.isoformat(),
            'rooms': list(room_map.values()),
        })

    @action(detail=False, methods=['get'])
    def notifications(self, request):
        """Arrivées et départs du jour."""
        today = timezone.now().date()
        arrivals = self.get_queryset().filter(
            check_in=today,
            status=Booking.Status.CONFIRMED,
        )
        departures = self.get_queryset().filter(
            check_out=today,
            status=Booking.Status.CHECKED_IN,
        )

        def fmt(b):
            return {
                'id': b.id,
                'reference': b.reference,
                'client': b.client.full_name,
                'room': b.room.number,
                'status': b.status,
            }

        return Response({
            'arrivals': [fmt(b) for b in arrivals],
            'departures': [fmt(b) for b in departures],
            'count': arrivals.count() + departures.count(),
        })

    @action(detail=False, methods=['get'])
    def daily_report(self, request):
        """Rapport du jour : arrivées, départs, occupations, revenus. ?date=YYYY-MM-DD"""
        from apps.rooms.models import Room
        from apps.billing.models import Invoice

        date_str = request.query_params.get('date')
        try:
            report_date = date.fromisoformat(date_str) if date_str else date.today()
        except ValueError:
            report_date = date.today()

        hotel = self.get_hotel()
        base_qs = self.get_queryset()

        arrivals_exp = base_qs.filter(
            check_in=report_date, status=Booking.Status.CONFIRMED,
        )

        arrivals_done = base_qs.filter(
            check_in=report_date, status=Booking.Status.CHECKED_IN,
        )

        departures_exp = base_qs.filter(
            check_out=report_date, status=Booking.Status.CHECKED_IN,
        )

        departures_done = base_qs.filter(
            check_out=report_date, status=Booking.Status.CHECKED_OUT,
        )

        occupied = base_qs.filter(
            check_in__lte=report_date, check_out__gt=report_date,
            status=Booking.Status.CHECKED_IN,
        )

        rooms_qs = Room.objects.filter(status__in=['available', 'occupied', 'cleaning'])
        invoices_qs = Invoice.objects.filter(status=Invoice.Status.PAID, paid_at__date=report_date)
        if hotel is not None:
            rooms_qs = rooms_qs.filter(hotel=hotel)
            invoices_qs = invoices_qs.filter(hotel=hotel)
        total_rooms = rooms_qs.count() or 1
        occ_count = occupied.count()

        daily_revenue = invoices_qs.aggregate(total=Sum('total'))['total'] or 0

        def fmt(b):
            return {
                'id': b.id,
                'reference': b.reference,
                'client': b.client.full_name,
                'room_number': b.room.number,
                'room_type': b.room.room_type.name,
                'check_in': b.check_in.isoformat(),
                'check_out': b.check_out.isoformat(),
                'nights': b.nights,
                'status': b.status,
            }

        return Response({
            'date': report_date.isoformat(),
            'arrivals_expected':   [fmt(b) for b in arrivals_exp],
            'arrivals_done':       [fmt(b) for b in arrivals_done],
            'departures_expected': [fmt(b) for b in departures_exp],
            'departures_done':     [fmt(b) for b in departures_done],
            'occupied':            [fmt(b) for b in occupied],
            'total_rooms':         total_rooms,
            'occupied_count':      occ_count,
            'occupancy_rate':      round(occ_count / total_rooms * 100, 1),
            'daily_revenue':       float(daily_revenue),
        })

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """
        Métriques avancées : taux d'occupation, ADR, RevPAR, comparaison N-1.
        ?year=YYYY&month=MM (défaut : mois courant)
        """
        from django.core.cache import cache
        from apps.rooms.models import Room
        from dateutil.relativedelta import relativedelta
        import datetime

        today = timezone.now().date()
        year  = int(request.query_params.get('year',  today.year))
        month = int(request.query_params.get('month', today.month))
        target = datetime.date(year, month, 1)
        target_end = (target + relativedelta(months=1)) - datetime.timedelta(days=1)

        # Même mois N-1
        prev = target - relativedelta(months=1)
        prev_end = target_end - relativedelta(months=1)

        hotel = self.get_hotel()
        cache_key = f'analytics_{hotel.pk if hotel else "none"}_{year}_{month}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        rooms_qs = Room.objects.filter(status__in=['available', 'occupied', 'cleaning'])
        if hotel is not None:
            rooms_qs = rooms_qs.filter(hotel=hotel)
        total_rooms = rooms_qs.count() or 1
        days_in_month = (target_end - target).days + 1
        room_nights = total_rooms * days_in_month

        def get_metrics(date_start, date_end):
            # Requête volontairement sans select_related (incompatible avec le
            # .only() ci-dessous) : on ne réutilise pas self.get_queryset().
            base = Booking.objects.filter(hotel=hotel) if hotel is not None else Booking.objects.all()
            qs = base.filter(
                status__in=[Booking.Status.CHECKED_OUT, Booking.Status.CHECKED_IN],
                check_in__lte=date_end,
                check_out__gt=date_start,
            )
            revenue = qs.aggregate(rev=Sum('total_price'))['rev'] or 0
            nights_sold = sum(
                min((b.check_out - b.check_in).days,
                    (date_end - date_start).days + 1)
                for b in qs.only('check_in', 'check_out', 'total_price')
            )
            adr    = float(revenue) / nights_sold if nights_sold else 0
            occ    = (nights_sold / room_nights * 100) if room_nights else 0
            revpar = adr * (occ / 100)
            return {
                'revenue':      float(revenue),
                'nights_sold':  nights_sold,
                'adr':          round(adr, 2),
                'occupancy':    round(occ, 2),
                'revpar':       round(revpar, 2),
                'bookings':     qs.count(),
            }

        current = get_metrics(target, target_end)
        previous = get_metrics(prev, prev_end)

        # Revenus sur 12 mois glissants
        monthly = []
        MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
        for i in range(11, -1, -1):
            d = today.replace(day=1) - relativedelta(months=i)
            d_end = (d + relativedelta(months=1)) - datetime.timedelta(days=1)
            m = get_metrics(d, d_end)
            monthly.append({
                'month': MONTHS_FR[d.month - 1],
                'year':  d.year,
                'label': f"{MONTHS_FR[d.month - 1]} {str(d.year)[2:]}",
                **m,
            })

        # Répartition par source
        source_stats = []
        for src, label in [('direct', 'Direct'), ('phone', 'Téléphone'), ('online', 'En ligne'), ('agency', 'Agence')]:
            cnt = self.get_queryset().filter(source=src, check_in__gte=target, check_in__lte=target_end).count()
            source_stats.append({'source': src, 'label': label, 'count': cnt})

        data = {
            'current':  current,
            'previous': previous,
            'monthly':  monthly,
            'sources':  source_stats,
            'total_rooms': total_rooms,
        }
        cache.set(cache_key, data, timeout=300)
        return Response(data)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrManager])
    def export_csv(self, request):
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="reservations.csv"'
        response.write('﻿')  # BOM UTF-8 pour Excel
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['Référence', 'Client', 'Chambre', 'Type', 'Arrivée', 'Départ', 'Nuits',
                         'Adultes', 'Enfants', 'Statut', 'Source', 'Prix/nuit', 'Total', 'Acompte',
                         'Demandes spéciales', 'Créée le'])
        qs = self.get_queryset().select_related('client', 'room', 'room__room_type')
        for b in qs:
            writer.writerow([
                b.reference, sanitize_csv_cell(b.client.full_name),
                b.room.number, b.room.room_type.name,
                b.check_in, b.check_out, b.nights,
                b.adults, b.children,
                b.get_status_display(), b.get_source_display(),
                b.price_per_night, b.total_price, b.deposit,
                sanitize_csv_cell(b.special_requests),
                b.created_at.strftime('%d/%m/%Y %H:%M'),
            ])
        return response

    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrManager])
    def export_xlsx(self, request):
        from openpyxl import Workbook
        from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        wb = Workbook()
        ws = wb.active
        ws.title = 'Réservations'

        HDR_FILL = PatternFill('solid', fgColor='C9973A')
        HDR_FONT = Font(bold=True, color='FFFFFF', size=11)
        ALT_FILL = PatternFill('solid', fgColor='FFF8EC')
        BORDER   = Border(
            left=Side(style='thin', color='E5E7EB'),
            right=Side(style='thin', color='E5E7EB'),
            top=Side(style='thin', color='E5E7EB'),
            bottom=Side(style='thin', color='E5E7EB'),
        )
        headers = ['Référence', 'Client', 'Chambre', 'Type', 'Arrivée', 'Départ', 'Nuits',
                   'Adultes', 'Enfants', 'Statut', 'Source', 'Prix/nuit', 'Total', 'Acompte',
                   'Demandes spéciales', 'Créée le']
        ws.append(headers)
        for col_i, _ in enumerate(headers, 1):
            cell = ws.cell(1, col_i)
            cell.fill = HDR_FILL; cell.font = HDR_FONT
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = BORDER
        ws.row_dimensions[1].height = 22

        qs = self.get_queryset().select_related('client', 'room', 'room__room_type')
        for row_i, b in enumerate(qs, 2):
            row = [
                b.reference, sanitize_csv_cell(b.client.full_name),
                b.room.number, b.room.room_type.name,
                b.check_in, b.check_out, b.nights,
                b.adults, b.children,
                b.get_status_display(), b.get_source_display(),
                float(b.price_per_night), float(b.total_price), float(b.deposit),
                sanitize_csv_cell(b.special_requests or ''), b.created_at.strftime('%d/%m/%Y %H:%M'),
            ]
            ws.append(row)
            fill = ALT_FILL if row_i % 2 == 0 else None
            for col_i in range(1, len(row) + 1):
                cell = ws.cell(row_i, col_i)
                if fill: cell.fill = fill
                cell.border = BORDER
                cell.alignment = Alignment(vertical='center')

        col_widths = [16, 26, 10, 18, 12, 12, 8, 8, 8, 14, 12, 12, 14, 12, 28, 18]
        for i, w in enumerate(col_widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
        ws.freeze_panes = 'A2'

        buf = io.BytesIO()
        wb.save(buf); buf.seek(0)
        resp = HttpResponse(
            buf.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        resp['Content-Disposition'] = 'attachment; filename="reservations.xlsx"'
        return resp

    def _room_queryset_for_update(self):
        hotel = self.get_hotel()
        qs = Room.objects.select_for_update()
        if hotel is not None:
            qs = qs.filter(hotel=hotel)
        return qs

    def perform_create(self, serializer):
        with transaction.atomic():
            data = serializer.validated_data
            try:
                self._room_queryset_for_update().filter(pk=data['room'].pk).get()
            except Room.DoesNotExist:
                raise ValidationError({'room': 'Chambre introuvable.'})
            serializer.save(hotel=self.get_hotel())

    def perform_update(self, serializer):
        with transaction.atomic():
            data = serializer.validated_data
            if 'room' in data:
                try:
                    self._room_queryset_for_update().filter(pk=data['room'].pk).get()
                except Room.DoesNotExist:
                    raise ValidationError({'room': 'Chambre introuvable.'})
            serializer.save()

    @action(detail=True, methods=['post'])
    def pay_deposit(self, request, pk=None):
        """Enregistre l'encaissement de l'acompte."""
        with transaction.atomic():
            try:
                booking = self.get_queryset().select_for_update().get(pk=pk)
            except Booking.DoesNotExist:
                return Response({'detail': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)
            if booking.deposit_paid_at:
                return Response({'detail': 'L\'acompte a déjà été encaissé.'}, status=status.HTTP_400_BAD_REQUEST)
            if not float(booking.deposit):
                return Response({'detail': 'Aucun acompte défini sur cette réservation.'}, status=status.HTTP_400_BAD_REQUEST)
            booking.deposit_paid_at = timezone.now()
            booking.save(update_fields=['deposit_paid_at', 'updated_at'])
        return Response(BookingSerializer(booking).data)

    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        with transaction.atomic():
            try:
                booking = self.get_queryset().select_for_update().get(pk=pk)
            except Booking.DoesNotExist:
                return Response({'detail': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)
            if booking.status != Booking.Status.CONFIRMED:
                return Response({'detail': 'La réservation doit être confirmée pour effectuer un check-in.'}, status=status.HTTP_400_BAD_REQUEST)
            booking.status = Booking.Status.CHECKED_IN
            booking.room.status = 'occupied'
            booking.room.save()
            booking.save()
        return Response(BookingSerializer(booking).data)

    @action(detail=True, methods=['post'])
    def check_out(self, request, pk=None):
        with transaction.atomic():
            try:
                booking = self.get_queryset().select_for_update().get(pk=pk)
            except Booking.DoesNotExist:
                return Response({'detail': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)
            if booking.status != Booking.Status.CHECKED_IN:
                return Response({'detail': 'La réservation doit être en cours pour effectuer un check-out.'}, status=status.HTTP_400_BAD_REQUEST)
            booking.status = Booking.Status.CHECKED_OUT
            # La chambre passe en nettoyage — sera remise en available après la tâche
            booking.room.status = 'cleaning'
            booking.room.save()
            booking.save()
            # Créer automatiquement une tâche de nettoyage
            try:
                from apps.housekeeping.models import CleaningTask
                CleaningTask.objects.create(
                    room=booking.room,
                    booking=booking,
                    scheduled_for=timezone.now().date(),
                    priority=CleaningTask.Priority.URGENT,
                    notes=f"Check-out de {booking.client.full_name} — réf. {booking.reference}",
                )
            except Exception:
                pass
            # Créer et envoyer le questionnaire de satisfaction
            try:
                from apps.satisfaction.models import SatisfactionSurvey
                from apps.notifications.emails import send_satisfaction_survey
                survey, _ = SatisfactionSurvey.objects.get_or_create(booking=booking)
                send_satisfaction_survey(survey)
            except Exception:
                pass
        return Response(BookingSerializer(booking).data)

    # ── Extras & services ──────────────────────────────────────────
    @action(detail=True, methods=['get'])
    def extras(self, request, pk=None):
        booking = self.get_object()
        return Response(ExtraServiceSerializer(booking.extras.all(), many=True).data)

    @action(detail=True, methods=['post'])
    def add_extra(self, request, pk=None):
        booking = self.get_object()
        data = {**request.data, 'booking': booking.id}
        serializer = ExtraServiceSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='extras/(?P<extra_id>[^/.]+)')
    def delete_extra(self, request, pk=None, extra_id=None):
        booking = self.get_object()
        extra = ExtraService.objects.filter(pk=extra_id, booking=booking).first()
        if not extra:
            return Response({'detail': 'Non trouvé.'}, status=status.HTTP_404_NOT_FOUND)
        extra.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Actions en masse ───────────────────────────────────────────
    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrManager])
    def bulk_action(self, request):
        ids         = request.data.get('ids', [])
        bulk_action = request.data.get('action')
        if not ids or not bulk_action:
            return Response({'detail': 'ids et action requis.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = self.get_queryset().filter(pk__in=ids)

        if bulk_action == 'delete':
            count, _ = qs.delete()
        elif bulk_action in ('confirm', 'cancel'):
            new_status = 'confirmed' if bulk_action == 'confirm' else 'cancelled'
            count = qs.exclude(status__in=['checked_out', 'checked_in']).update(status=new_status)
        elif bulk_action == 'export':
            return _export_bookings_csv(qs)
        else:
            return Response({'detail': 'Action inconnue.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'count': count})


    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def availability(self, request):
        """
        Vérifie la disponibilité des chambres.
        GET /api/bookings/availability/?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD&adults=2
        """
        from apps.rooms.models import Room
        from apps.rooms.serializers import RoomSerializer
        check_in_str  = request.query_params.get('check_in')
        check_out_str = request.query_params.get('check_out')
        adults = int(request.query_params.get('adults', 1))

        if not check_in_str or not check_out_str:
            return Response({'detail': 'check_in et check_out sont requis.'}, status=400)
        try:
            ci = date.fromisoformat(check_in_str)
            co = date.fromisoformat(check_out_str)
        except ValueError:
            return Response({'detail': 'Format de date invalide (YYYY-MM-DD).'}, status=400)

        if co <= ci:
            return Response({'detail': 'La date de départ doit être après l\'arrivée.'}, status=400)
        if ci < date.today():
            return Response({'detail': 'La date d\'arrivée ne peut pas être dans le passé.'}, status=400)

        # Chambres occupées sur cette période
        busy_rooms = Booking.objects.filter(
            check_in__lt=co,
            check_out__gt=ci,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.CHECKED_IN],
        ).values_list('room_id', flat=True)

        available = Room.objects.select_related('room_type').filter(
            status='available',
        ).exclude(id__in=busy_rooms)

        nights = (co - ci).days
        rooms_data = []
        for room in available:
            from apps.rooms.pricing import calculate_price
            price_info = calculate_price(room, ci, co)
            rooms_data.append({
                'id': room.id,
                'number': room.number,
                'room_type': room.room_type.name,
                'floor': room.floor,
                'floor_display': room.floor_display,
                'price_per_night': price_info['price_per_night'],
                'total_price': round(price_info['price_per_night'] * nights, 2),
                'nights': nights,
            })

        return Response({'rooms': rooms_data, 'check_in': check_in_str, 'check_out': check_out_str, 'nights': nights})

    @action(detail=False, methods=['post'], permission_classes=[AllowAny], throttle_classes=[PublicBookingThrottle])
    def request_booking(self, request):
        """
        Crée une demande de réservation publique (statut pending, source online).
        POST /api/bookings/request_booking/
        Body: { first_name, last_name, email, phone, room_id, check_in, check_out, adults, children, special_requests }
        """
        from apps.clients.models import Client
        from apps.rooms.models import Room
        from apps.rooms.pricing import calculate_price

        data = request.data
        required = ['first_name', 'last_name', 'email', 'room_id', 'check_in', 'check_out']
        missing = [f for f in required if not data.get(f)]
        if missing:
            return Response({'detail': f'Champs requis: {", ".join(missing)}'}, status=400)

        try:
            ci = date.fromisoformat(data['check_in'])
            co = date.fromisoformat(data['check_out'])
        except ValueError:
            return Response({'detail': 'Format de date invalide.'}, status=400)

        if co <= ci or ci < date.today():
            return Response({'detail': 'Dates invalides.'}, status=400)

        # Vérifier la chambre
        try:
            room = Room.objects.select_related('room_type').get(pk=data['room_id'], status='available')
        except Room.DoesNotExist:
            return Response({'detail': 'Chambre non disponible.'}, status=400)

        # Vérifier disponibilité
        conflict = Booking.objects.filter(
            room=room, check_in__lt=co, check_out__gt=ci,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.CHECKED_IN],
        ).exists()
        if conflict:
            return Response({'detail': 'Cette chambre n\'est plus disponible pour ces dates.'}, status=400)

        # Trouver ou créer le client. On ne rattache à une fiche existante que
        # si le nom correspond (pas de preuve de possession de l'email/OTP ici).
        first_name = data['first_name'].strip()
        last_name  = data['last_name'].strip()
        email_norm = data['email'].lower().strip()
        existing = Client.objects.filter(email=email_norm, hotel=room.hotel).first()
        if existing and existing.first_name.strip().lower() == first_name.lower() \
                and existing.last_name.strip().lower() == last_name.lower():
            client = existing
        else:
            client = Client.objects.create(
                hotel=room.hotel,
                email=email_norm,
                first_name=first_name,
                last_name=last_name,
                phone=data.get('phone', ''),
            )

        price_info = calculate_price(room, ci, co)
        nights = (co - ci).days

        with transaction.atomic():
            booking = Booking.objects.create(
                client=client,
                room=room,
                check_in=ci,
                check_out=co,
                adults=int(data.get('adults', 1)),
                children=int(data.get('children', 0)),
                status=Booking.Status.PENDING,
                source=Booking.Source.ONLINE,
                price_per_night=price_info['price_per_night'],
                total_price=round(price_info['price_per_night'] * nights, 2),
                special_requests=data.get('special_requests', ''),
            )

        return Response({
            'reference': booking.reference,
            'total_price': booking.total_price,
            'detail': f'Votre demande de réservation {booking.reference} a été enregistrée. Nous vous contacterons sous 24h.',
        }, status=status.HTTP_201_CREATED)


def _export_bookings_csv(qs):
    response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
    response['Content-Disposition'] = 'attachment; filename="reservations_selection.csv"'
    writer = csv.writer(response, delimiter=';')
    writer.writerow(['Référence', 'Client', 'Chambre', 'Arrivée', 'Départ', 'Nuits', 'Total', 'Statut'])
    for b in qs.select_related('client', 'room'):
        writer.writerow([
            b.reference, sanitize_csv_cell(b.client.full_name), b.room.number,
            b.check_in, b.check_out, b.nights,
            b.total_price, b.get_status_display(),
        ])
    return response
