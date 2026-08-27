import datetime
import calendar
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.db.models import Sum, Avg, Count, Max, Q
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from apps.accounts.permissions import IsAdminOrManager

from apps.rooms.models import Room
from apps.bookings.models import Booking
from apps.clients.models import Client
from apps.accounting.models import Transaction, Budget
from apps.satisfaction.models import SatisfactionSurvey
from apps.maintenance.models import MaintenanceTicket
from apps.housekeeping.models import CleaningTask

try:
    from apps.billing.models import Invoice
    HAS_INVOICE = True
except Exception:
    HAS_INVOICE = False

MONTHS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

CATEGORY_LABELS = {
    'room_revenue':  'Hébergement',
    'deposit':       'Acomptes',
    'extra':         'Services extras',
    'other_income':  'Autres revenus',
    'staff':         'Personnel',
    'maintenance':   'Maintenance',
    'supplies':      'Fournitures',
    'utilities':     'Charges',
    'marketing':     'Marketing',
    'taxes':         'Taxes',
    'other_expense': 'Autres dépenses',
}

INCOME_CATEGORIES  = ['room_revenue', 'deposit', 'extra', 'other_income']
EXPENSE_CATEGORIES = ['staff', 'maintenance', 'supplies', 'utilities', 'marketing', 'taxes', 'other_expense']

PRIORITY_LABELS = {'low': 'Faible', 'medium': 'Moyen', 'high': 'Élevé', 'urgent': 'Urgent'}
CATEGORY_MAINT  = {
    'plumbing': 'Plomberie', 'electrical': 'Électricité', 'hvac': 'Climatisation',
    'furniture': 'Mobilier', 'cleaning': 'Nettoyage', 'painting': 'Peinture',
    'it': 'Informatique', 'security': 'Sécurité', 'other': 'Autre',
}
PAYMENT_LABELS = {
    'cash': 'Espèces', 'card': 'Carte bancaire',
    'mobile': 'Mobile money', 'transfer': 'Virement', 'other': 'Autre',
}

FLOOR_LABELS = {0: 'RDC', 1: '1er', 2: '2ème', 3: '3ème', 4: '4ème'}

STATUS_LABELS = {
    'available':   'Disponible',
    'occupied':    'Occupée',
    'maintenance': 'Maintenance',
    'cleaning':    'Nettoyage',
    'out_of_order': 'Hors service',
}

SOURCE_LABELS = {
    'direct': 'Direct', 'phone': 'Téléphone',
    'online': 'En ligne', 'agency': 'Agence',
}


def _period(year, month):
    start = datetime.date(year, month, 1)
    end   = (start + relativedelta(months=1)) - datetime.timedelta(days=1)
    return start, end


# ─────────────────────────────────────────────────────────────────────────────
class MonthlyReportView(APIView):
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        today = timezone.now().date()
        year  = int(request.query_params.get('year',  today.year))
        month = int(request.query_params.get('month', today.month))
        start, end = _period(year, month)
        hotel = getattr(request.user, 'hotel', None)

        def scoped(qs):
            return qs.filter(hotel=hotel) if hotel is not None else qs

        # ── Réservations ──────────────────────────────────────────────────────
        all_bk = scoped(Booking.objects.filter(check_in__gte=start, check_in__lte=end))
        active_bk = scoped(Booking.objects.filter(
            status__in=[Booking.Status.CHECKED_OUT, Booking.Status.CHECKED_IN],
            check_in__lte=end,
            check_out__gt=start,
        ))

        total_rooms   = scoped(Room.objects.filter(status__in=['available', 'occupied', 'cleaning'])).count() or 1
        days_in_month = (end - start).days + 1
        room_nights   = total_rooms * days_in_month

        revenue     = active_bk.aggregate(s=Sum('total_price'))['s'] or Decimal('0')
        nights_sold = sum(
            min((b.check_out - b.check_in).days, days_in_month)
            for b in active_bk.only('check_in', 'check_out')
        )
        adr    = float(revenue) / nights_sold if nights_sold else 0
        occ    = nights_sold / room_nights * 100 if room_nights else 0
        revpar = adr * (occ / 100)

        sources = [
            {'source': src, 'label': lbl, 'count': all_bk.filter(source=src).count()}
            for src, lbl in [('direct', 'Direct'), ('phone', 'Téléphone'), ('online', 'En ligne'), ('agency', 'Agence')]
        ]

        bookings_data = {
            'total':       all_bk.count(),
            'confirmed':   all_bk.filter(status=Booking.Status.CONFIRMED).count(),
            'checked_in':  all_bk.filter(status=Booking.Status.CHECKED_IN).count(),
            'checked_out': all_bk.filter(status=Booking.Status.CHECKED_OUT).count(),
            'cancelled':   all_bk.filter(status=Booking.Status.CANCELLED).count(),
            'no_show':     all_bk.filter(status=Booking.Status.NO_SHOW).count(),
            'revenue':     float(revenue),
            'nights_sold': nights_sold,
            'adr':         round(adr, 2),
            'occupancy':   round(occ, 2),
            'revpar':      round(revpar, 2),
            'total_rooms': total_rooms,
            'sources':     sources,
        }

        # ── Finances ──────────────────────────────────────────────────────────
        txs     = scoped(Transaction.objects.filter(date__gte=start, date__lte=end))
        income  = txs.filter(type='income').aggregate(s=Sum('amount'))['s'] or Decimal('0')
        expense = txs.filter(type='expense').aggregate(s=Sum('amount'))['s'] or Decimal('0')

        by_cat = {}
        for cat, lbl in CATEGORY_LABELS.items():
            ci = txs.filter(type='income',  category=cat).aggregate(s=Sum('amount'))['s'] or Decimal('0')
            ce = txs.filter(type='expense', category=cat).aggregate(s=Sum('amount'))['s'] or Decimal('0')
            if ci or ce:
                by_cat[cat] = {'label': lbl, 'income': float(ci), 'expense': float(ce)}

        finances_data = {
            'income':      float(income),
            'expense':     float(expense),
            'net':         float(income - expense),
            'by_category': by_cat,
        }

        # ── Satisfaction ──────────────────────────────────────────────────────
        surveys = scoped(SatisfactionSurvey.objects.filter(
            submitted_at__date__gte=start,
            submitted_at__date__lte=end,
            submitted_at__isnull=False,
        ))
        s_count = surveys.count()
        s_agg = surveys.aggregate(
            avg_overall=     Avg('score_overall'),
            avg_cleanliness= Avg('score_cleanliness'),
            avg_service=     Avg('score_service'),
            avg_comfort=     Avg('score_comfort'),
            avg_value=       Avg('score_value'),
        )
        would_return = surveys.filter(would_return=True).count()

        def r1(v):
            return round(float(v), 1) if v is not None else None

        satisfaction_data = {
            'count':            s_count,
            'avg_overall':      r1(s_agg['avg_overall']),
            'avg_cleanliness':  r1(s_agg['avg_cleanliness']),
            'avg_service':      r1(s_agg['avg_service']),
            'avg_comfort':      r1(s_agg['avg_comfort']),
            'avg_value':        r1(s_agg['avg_value']),
            'would_return_pct': round(would_return / s_count * 100, 1) if s_count else 0,
        }

        # ── Maintenance ───────────────────────────────────────────────────────
        tickets = scoped(MaintenanceTicket.objects.filter(
            created_at__date__gte=start, created_at__date__lte=end
        ))
        t_cost = tickets.aggregate(s=Sum('cost'))['s'] or Decimal('0')

        maintenance_data = {
            'total':    tickets.count(),
            'open':     tickets.filter(status__in=['open', 'in_progress']).count(),
            'resolved': tickets.filter(status__in=['resolved', 'closed']).count(),
            'cost':     float(t_cost),
            'by_priority': [
                {'key': p, 'label': lbl, 'count': tickets.filter(priority=p).count()}
                for p, lbl in PRIORITY_LABELS.items()
            ],
            'by_category': [
                {'key': c, 'label': lbl, 'count': tickets.filter(category=c).count()}
                for c, lbl in CATEGORY_MAINT.items()
                if tickets.filter(category=c).exists()
            ],
        }

        # ── Housekeeping ──────────────────────────────────────────────────────
        tasks   = scoped(CleaningTask.objects.filter(scheduled_for__gte=start, scheduled_for__lte=end))
        t_total = tasks.count()
        t_done  = tasks.filter(status__in=['done', 'inspected']).count()

        housekeeping_data = {
            'total':           t_total,
            'done':            t_done,
            'pending':         tasks.filter(status__in=['pending', 'in_progress']).count(),
            'completion_rate': round(t_done / t_total * 100, 1) if t_total else 0,
        }

        return Response({
            'period':       {'year': year, 'month': month, 'label': f"{MONTHS_FR[month - 1]} {year}"},
            'bookings':     bookings_data,
            'finances':     finances_data,
            'satisfaction': satisfaction_data,
            'maintenance':  maintenance_data,
            'housekeeping': housekeeping_data,
        })


# ─────────────────────────────────────────────────────────────────────────────
class FullReportView(APIView):
    """Rapport complet : chambres, réservations conclues, VIP, finances détaillées."""
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        try:
            return self._build(request)
        except Exception as exc:
            import traceback as _tb
            return Response(
                {'error': str(exc), 'traceback': _tb.format_exc()},
                status=500,
            )

    def _build(self, request):
        today = timezone.now().date()
        year  = int(request.query_params.get('year',  today.year))
        month = int(request.query_params.get('month', today.month))
        start, end = _period(year, month)
        days_in_month = (end - start).days + 1
        hotel = getattr(request.user, 'hotel', None)

        def scoped(qs):
            return qs.filter(hotel=hotel) if hotel is not None else qs

        # ── 1. État des chambres ──────────────────────────────────────────────
        all_rooms = scoped(Room.objects.select_related('room_type')).order_by('floor', 'number')

        # Current checked-in bookings for guest names
        active_guests = {
            b.room_id: b
            for b in scoped(Booking.objects.filter(
                status=Booking.Status.CHECKED_IN,
                check_in__lte=today,
                check_out__gt=today,
            )).select_related('client')
        }

        # Group by floor
        floors_map = {}
        rooms_list = []
        for room in all_rooms:
            st = room.status
            entry = {
                'id':         room.id,
                'number':     room.number,
                'type':       room.room_type.name if room.room_type else '',
                'floor':      room.floor,
                'floor_label': FLOOR_LABELS.get(room.floor, f"Étage {room.floor}"),
                'status':     st,
                'status_label': STATUS_LABELS.get(st, st),
                'base_price': float(room.price_override or room.room_type.base_price if room.room_type else 0),
            }
            if st == 'occupied' and room.id in active_guests:
                bk = active_guests[room.id]
                entry['current_guest'] = f"{bk.client.first_name} {bk.client.last_name}"
                entry['check_out']     = str(bk.check_out)
            rooms_list.append(entry)

            fl = room.floor
            if fl not in floors_map:
                floors_map[fl] = {'floor': fl, 'label': FLOOR_LABELS.get(fl, f"Étage {fl}"),
                                   'total': 0, 'available': 0, 'occupied': 0, 'maintenance': 0, 'cleaning': 0, 'other': 0}
            floors_map[fl]['total'] += 1
            key = st if st in ('available', 'occupied', 'maintenance', 'cleaning') else 'other'
            floors_map[fl][key] += 1

        total_rooms = all_rooms.count()
        rooms_data = {
            'total':       total_rooms,
            'available':   all_rooms.filter(status='available').count(),
            'occupied':    all_rooms.filter(status='occupied').count(),
            'maintenance': all_rooms.filter(status='maintenance').count(),
            'cleaning':    all_rooms.filter(status='cleaning').count(),
            'occupancy_pct': round(
                all_rooms.filter(status='occupied').count() / total_rooms * 100, 1
            ) if total_rooms else 0,
            'by_floor':    sorted(floors_map.values(), key=lambda x: x['floor']),
            'list':        rooms_list,
        }

        # ── 2. Réservations conclues ──────────────────────────────────────────
        concluded_qs = scoped(Booking.objects.filter(
            status=Booking.Status.CHECKED_OUT,
            check_out__gte=start,
            check_out__lte=end,
        )).select_related('client', 'room', 'room__room_type').order_by('-check_out')

        concluded_list = []
        for b in concluded_qs[:200]:
            nights = max((b.check_out - b.check_in).days, 1)
            concluded_list.append({
                'reference':   b.reference,
                'client_name': f"{b.client.first_name} {b.client.last_name}",
                'client_id':   b.client.id,
                'vip_status':  b.client.vip_status,
                'room_number': b.room.number,
                'room_type':   b.room.room_type.name if b.room.room_type else '',
                'check_in':    str(b.check_in),
                'check_out':   str(b.check_out),
                'nights':      nights,
                'total_price': float(b.total_price),
                'source':      SOURCE_LABELS.get(b.source, b.source),
            })

        revenue_concluded = concluded_qs.aggregate(s=Sum('total_price'))['s'] or Decimal('0')
        concluded_data = {
            'total':   concluded_qs.count(),
            'revenue': float(revenue_concluded),
            'avg_stay': round(
                sum(max((co - ci).days, 1) for ci, co in concluded_qs.values_list('check_in', 'check_out')) /
                concluded_qs.count(), 1
            ) if concluded_qs.count() else 0,
            'list': concluded_list,
        }

        # ── 3. Clients VIP ────────────────────────────────────────────────────
        vip_qs = scoped(Client.objects.filter(
            vip_status__in=['vip', 'vvip'], is_blacklisted=False
        )).order_by('-vip_status')

        vip_list = []
        for client in vip_qs:
            client_bk = Booking.objects.filter(client=client, status=Booking.Status.CHECKED_OUT)
            total_stays = client_bk.count()
            total_spent = client_bk.aggregate(s=Sum('total_price'))['s'] or Decimal('0')
            last_bk     = client_bk.select_related('room').order_by('-check_out').first()
            period_bk   = client_bk.filter(check_out__gte=start, check_out__lte=end).first()
            vip_list.append({
                'id':           client.id,
                'name':         f"{client.first_name} {client.last_name}",
                'email':        client.email or '',
                'phone':        client.phone or '',
                'vip_status':   client.vip_status,
                'nationality':  client.nationality or '',
                'preferences':  client.preferences or '',
                'total_stays':  total_stays,
                'total_spent':  float(total_spent),
                'last_stay':    str(last_bk.check_out)   if last_bk   else None,
                'last_room':    last_bk.room.number       if last_bk   else None,
                'stayed_this_period': bool(period_bk),
            })

        vip_list.sort(key=lambda x: (0 if x['vip_status'] == 'vvip' else 1, -x['total_spent']))

        vip_data = {
            'vip_count':  vip_qs.filter(vip_status='vip').count(),
            'vvip_count': vip_qs.filter(vip_status='vvip').count(),
            'list':       vip_list,
        }

        # ── 4. Finances détaillées ────────────────────────────────────────────
        txs     = scoped(Transaction.objects.filter(date__gte=start, date__lte=end))
        income  = txs.filter(type='income').aggregate(s=Sum('amount'))['s']  or Decimal('0')
        expense = txs.filter(type='expense').aggregate(s=Sum('amount'))['s'] or Decimal('0')
        net     = income - expense

        # Income by category
        income_cats = []
        for cat in INCOME_CATEGORIES:
            amt = txs.filter(type='income', category=cat).aggregate(s=Sum('amount'))['s'] or Decimal('0')
            if amt:
                income_cats.append({
                    'key':    cat,
                    'label':  CATEGORY_LABELS.get(cat, cat),
                    'amount': float(amt),
                    'pct':    round(float(amt) / float(income) * 100, 1) if income else 0,
                })
        income_cats.sort(key=lambda x: -x['amount'])

        # Expense by category + budget
        expense_cats = []
        for cat in EXPENSE_CATEGORIES:
            amt = txs.filter(type='expense', category=cat).aggregate(s=Sum('amount'))['s'] or Decimal('0')
            budget_obj = scoped(Budget.objects.filter(
                category=cat, period='monthly', year=year, month=month
            )).first()
            budget_amt = float(budget_obj.amount) if budget_obj else None
            if amt or budget_amt:
                expense_cats.append({
                    'key':        cat,
                    'label':      CATEGORY_LABELS.get(cat, cat),
                    'amount':     float(amt),
                    'pct':        round(float(amt) / float(expense) * 100, 1) if expense else 0,
                    'budget':     budget_amt,
                    'budget_pct': round(float(amt) / budget_amt * 100, 1) if budget_amt else None,
                    'over_budget': float(amt) > budget_amt if budget_amt else False,
                })
        expense_cats.sort(key=lambda x: -x['amount'])

        # Payment methods (income only)
        payment_methods = []
        for pm, lbl in PAYMENT_LABELS.items():
            amt = txs.filter(type='income', payment_method=pm).aggregate(s=Sum('amount'))['s'] or Decimal('0')
            if amt:
                payment_methods.append({
                    'method': pm, 'label': lbl, 'amount': float(amt),
                    'pct': round(float(amt) / float(income) * 100, 1) if income else 0,
                })
        payment_methods.sort(key=lambda x: -x['amount'])

        # Top 10 transactions
        top_txs = []
        for tx in txs.order_by('-amount')[:10]:
            top_txs.append({
                'reference':      tx.reference,
                'type':           tx.type,
                'label':          CATEGORY_LABELS.get(tx.category, tx.category),
                'amount':         float(tx.amount),
                'date':           str(tx.date),
                'description':    tx.description or '',
                'payment_method': PAYMENT_LABELS.get(tx.payment_method, tx.payment_method),
            })

        # Invoice stats
        invoice_data = None
        if HAS_INVOICE:
            try:
                invoices = scoped(Invoice.objects.filter(
                    booking__check_out__gte=start, booking__check_out__lte=end
                ))
                invoice_data = {
                    'total':        invoices.count(),
                    'paid':         invoices.filter(status='paid').count(),
                    'draft':        invoices.filter(status='draft').count(),
                    'issued':       invoices.filter(status='issued').count(),
                    'cancelled':    invoices.filter(status='cancelled').count(),
                    'total_amount': float(invoices.aggregate(s=Sum('total'))['s'] or 0),
                    'paid_amount':  float(invoices.filter(status='paid').aggregate(s=Sum('total'))['s'] or 0),
                }
            except Exception:
                pass

        # Daily revenue curve (income per day)
        daily_income = {}
        for tx in txs.filter(type='income').values('date', 'amount'):
            day = str(tx['date'])
            daily_income[day] = daily_income.get(day, 0) + float(tx['amount'])
        daily_curve = [
            {'date': str(start + datetime.timedelta(days=i)),
             'amount': daily_income.get(str(start + datetime.timedelta(days=i)), 0)}
            for i in range(days_in_month)
        ]

        finances_data = {
            'income':             float(income),
            'expense':            float(expense),
            'net':                float(net),
            'income_by_category': income_cats,
            'expense_by_category': expense_cats,
            'payment_methods':    payment_methods,
            'top_transactions':   top_txs,
            'invoices':           invoice_data,
            'daily_curve':        daily_curve,
        }

        # ── 5. Satisfaction (synthèse) ────────────────────────────────────────
        surveys = scoped(SatisfactionSurvey.objects.filter(
            submitted_at__date__gte=start,
            submitted_at__date__lte=end,
            submitted_at__isnull=False,
        ))
        s_count = surveys.count()
        s_agg = surveys.aggregate(
            avg_overall=Avg('score_overall'), avg_cleanliness=Avg('score_cleanliness'),
            avg_service=Avg('score_service'), avg_comfort=Avg('score_comfort'), avg_value=Avg('score_value'),
        )
        wr = surveys.filter(would_return=True).count()

        def r1(v): return round(float(v), 1) if v is not None else None

        satisfaction_data = {
            'count':            s_count,
            'avg_overall':      r1(s_agg['avg_overall']),
            'avg_cleanliness':  r1(s_agg['avg_cleanliness']),
            'avg_service':      r1(s_agg['avg_service']),
            'avg_comfort':      r1(s_agg['avg_comfort']),
            'avg_value':        r1(s_agg['avg_value']),
            'would_return_pct': round(wr / s_count * 100, 1) if s_count else 0,
        }

        # ── 6. Maintenance ────────────────────────────────────────────────────
        tickets = scoped(MaintenanceTicket.objects.filter(
            created_at__date__gte=start, created_at__date__lte=end
        ))
        t_cost = tickets.aggregate(s=Sum('cost'))['s'] or Decimal('0')

        maintenance_data = {
            'total':    tickets.count(),
            'open':     tickets.filter(status__in=['open', 'in_progress']).count(),
            'resolved': tickets.filter(status__in=['resolved', 'closed']).count(),
            'cost':     float(t_cost),
            'by_priority': [
                {'key': p, 'label': lbl, 'count': tickets.filter(priority=p).count()}
                for p, lbl in PRIORITY_LABELS.items()
            ],
            'by_category': [
                {'key': c, 'label': lbl, 'count': tickets.filter(category=c).count()}
                for c, lbl in CATEGORY_MAINT.items()
                if tickets.filter(category=c).exists()
            ],
            'urgent_open': list(
                tickets.filter(priority='urgent', status__in=['open', 'in_progress'])
                .values('reference', 'title', 'category')[:5]
            ),
        }

        # ── 7. Housekeeping ───────────────────────────────────────────────────
        tasks   = scoped(CleaningTask.objects.filter(scheduled_for__gte=start, scheduled_for__lte=end))
        t_total = tasks.count()
        t_done  = tasks.filter(status__in=['done', 'inspected']).count()

        housekeeping_data = {
            'total':           t_total,
            'done':            t_done,
            'pending':         tasks.filter(status__in=['pending', 'in_progress']).count(),
            'completion_rate': round(t_done / t_total * 100, 1) if t_total else 0,
        }

        return Response({
            'period':      {'year': year, 'month': month, 'label': f"{MONTHS_FR[month - 1]} {year}"},
            'rooms':        rooms_data,
            'concluded':    concluded_data,
            'vip':          vip_data,
            'finances':     finances_data,
            'satisfaction': satisfaction_data,
            'maintenance':  maintenance_data,
            'housekeeping': housekeeping_data,
        })
