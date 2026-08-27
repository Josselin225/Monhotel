from rest_framework import serializers
from .models import Transaction, Budget


class TransactionSerializer(serializers.ModelSerializer):
    type_display     = serializers.CharField(source='get_type_display',     read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    booking_reference = serializers.SerializerMethodField()

    class Meta:
        model  = Transaction
        fields = [
            'id', 'reference', 'type', 'type_display', 'category', 'category_display',
            'amount', 'date', 'description', 'payment_method', 'payment_method_display',
            'booking', 'booking_reference', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'reference', 'created_at', 'updated_at']

    def get_booking_reference(self, obj):
        return obj.booking.reference if obj.booking_id else None


class BudgetSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    period_display   = serializers.CharField(source='get_period_display',   read_only=True)

    class Meta:
        model  = Budget
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']
