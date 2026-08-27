from rest_framework import serializers
from django.db.models import Sum
from .models import Invoice, Payment
from apps.bookings.serializers import BookingSerializer


class PaymentSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = Payment
        fields = ['id', 'invoice', 'amount', 'method', 'method_display', 'reference', 'note', 'paid_at', 'created_by', 'created_at']
        read_only_fields = ['created_by', 'created_at']


class InvoiceSerializer(serializers.ModelSerializer):
    booking_detail         = BookingSerializer(source='booking', read_only=True)
    status_display         = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    total_paid             = serializers.SerializerMethodField()
    balance                = serializers.SerializerMethodField()
    payments               = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ['number']

    def get_total_paid(self, obj):
        return float(obj.payments.aggregate(t=Sum('amount'))['t'] or 0)

    def get_balance(self, obj):
        total_paid = obj.payments.aggregate(t=Sum('amount'))['t'] or 0
        return float(obj.total) - float(total_paid)
