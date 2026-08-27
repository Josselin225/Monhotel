from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Sum, Count, Q, functions
from .models import Invoice, Payment
from .serializers import InvoiceSerializer, PaymentSerializer
from .pdf import generate_invoice_pdf_response
from apps.accounts.permissions import IsAdminOrManager
from apps.tenants.mixins import HotelScopeMixin


class InvoiceViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('booking', 'booking__client', 'booking__room').all()
    serializer_class = InvoiceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'payment_method']
    search_fields = ['number', 'booking__reference', 'booking__client__first_name', 'booking__client__last_name']
    ordering_fields = ['created_at', 'total', 'issued_at']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'stats', 'monthly_revenue', 'payments'):
            return [IsAuthenticated()]
        return [IsAdminOrManager()]

    @action(detail=True, methods=['post'])
    def issue(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != Invoice.Status.DRAFT:
            return Response({'detail': 'Seules les factures brouillon peuvent être émises.'}, status=status.HTTP_400_BAD_REQUEST)
        invoice.status = Invoice.Status.ISSUED
        invoice.issued_at = timezone.now()
        invoice.save()
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        payment_method = request.data.get('payment_method')
        if invoice.status not in [Invoice.Status.ISSUED, Invoice.Status.DRAFT]:
            return Response({'detail': 'Cette facture ne peut pas être marquée comme payée.'}, status=status.HTTP_400_BAD_REQUEST)
        invoice.status = Invoice.Status.PAID
        invoice.paid_at = timezone.now()
        if payment_method:
            invoice.payment_method = payment_method
        invoice.save()
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from django.core.cache import cache
        from django.db.models import Count
        today = timezone.now()
        hotel = self.get_hotel()
        cache_key = f'invoice_stats_{hotel.pk if hotel else "none"}_{today.strftime("%Y-%m-%d-%H")}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        qs = self.get_queryset()
        aggregated = qs.aggregate(
            total_revenue=Sum('total', filter=Q(status=Invoice.Status.PAID)),
            month_revenue=Sum('total', filter=Q(
                status=Invoice.Status.PAID,
                paid_at__month=today.month,
                paid_at__year=today.year,
            )),
            pending_amount=Sum('total', filter=Q(status=Invoice.Status.ISSUED)),
            draft_count=Count('id', filter=Q(status=Invoice.Status.DRAFT)),
            issued_count=Count('id', filter=Q(status=Invoice.Status.ISSUED)),
            paid_count=Count('id', filter=Q(status=Invoice.Status.PAID)),
        )
        data = {
            'total_revenue': float(aggregated['total_revenue'] or 0),
            'month_revenue': float(aggregated['month_revenue'] or 0),
            'pending_amount': float(aggregated['pending_amount'] or 0),
            'draft_count': aggregated['draft_count'] or 0,
            'issued_count': aggregated['issued_count'] or 0,
            'paid_count': aggregated['paid_count'] or 0,
        }
        cache.set(cache_key, data, timeout=300)
        return Response(data)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Téléchargement de la facture en PDF."""
        invoice = self.get_object()
        try:
            return generate_invoice_pdf_response(invoice)
        except ImportError:
            return Response({'detail': 'reportlab non installé. Exécutez : pip install reportlab'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    @action(detail=True, methods=['get'])
    def payments(self, request, pk=None):
        """Liste des paiements partiels d'une facture."""
        invoice = self.get_object()
        pmts = Payment.objects.filter(invoice=invoice)
        total_paid = pmts.aggregate(t=Sum('amount'))['t'] or 0
        return Response({
            'payments': PaymentSerializer(pmts, many=True).data,
            'total_paid': float(total_paid),
            'balance': float(invoice.total) - float(total_paid),
        })

    @action(detail=True, methods=['post'])
    def add_payment(self, request, pk=None):
        """Enregistrer un paiement partiel."""
        invoice = self.get_object()
        if invoice.status == Invoice.Status.CANCELLED:
            return Response({'detail': 'Facture annulée.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            amount = float(request.data.get('amount', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'Montant invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({'detail': 'Le montant doit être positif.'}, status=status.HTTP_400_BAD_REQUEST)

        payment = Payment.objects.create(
            invoice=invoice,
            amount=amount,
            method=request.data.get('method', 'cash'),
            reference=request.data.get('reference', ''),
            note=request.data.get('note', ''),
            created_by=request.user,
        )
        total_paid = float(invoice.payments.aggregate(t=Sum('amount'))['t'] or 0)
        if total_paid >= float(invoice.total) and invoice.status != Invoice.Status.PAID:
            invoice.status = Invoice.Status.PAID
            invoice.paid_at = timezone.now()
            invoice.payment_method = payment.method
            invoice.save()
        elif invoice.status == Invoice.Status.DRAFT:
            invoice.status = Invoice.Status.ISSUED
            invoice.issued_at = timezone.now()
            invoice.save()

        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def monthly_revenue(self, request):
        """Revenus des 12 derniers mois, groupés par mois."""
        from datetime import date
        from dateutil.relativedelta import relativedelta
        today = date.today()
        start = today.replace(day=1) - relativedelta(months=11)

        rows = (
            self.get_queryset()
            .filter(status=Invoice.Status.PAID, paid_at__date__gte=start)
            .annotate(month=functions.TruncMonth('paid_at'))
            .values('month')
            .annotate(revenue=Sum('total'))
            .order_by('month')
        )

        # Construire un dict complet avec 0 pour les mois sans données
        MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
        by_month = {r['month'].strftime('%Y-%m'): float(r['revenue']) for r in rows}
        result = []
        for i in range(12):
            d = start + relativedelta(months=i)
            key = d.strftime('%Y-%m')
            result.append({
                'month': MONTHS_FR[d.month - 1],
                'year': d.year,
                'revenue': by_month.get(key, 0),
            })
        return Response(result)
