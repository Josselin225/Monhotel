from rest_framework import serializers
from django.db.models import Sum
from .models import Client, ClientNote


class ClientNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    note_type_display = serializers.CharField(source='get_note_type_display', read_only=True)

    class Meta:
        model = ClientNote
        fields = ['id', 'client', 'author', 'author_name', 'note_type', 'note_type_display', 'content', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.get_full_name() or obj.author.username
        return 'Système'


class ClientSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    bookings_count = serializers.SerializerMethodField()
    total_nights = serializers.SerializerMethodField()
    lifetime_value = serializers.SerializerMethodField()
    last_stay_date = serializers.SerializerMethodField()
    vip_status_display = serializers.CharField(source='get_vip_status_display', read_only=True)

    class Meta:
        model = Client
        fields = '__all__'

    def get_bookings_count(self, obj):
        return obj.bookings.count()

    def get_total_nights(self, obj):
        return sum(
            (b.check_out - b.check_in).days
            for b in obj.bookings.exclude(status='cancelled').only('check_in', 'check_out')
        )

    def get_lifetime_value(self, obj):
        result = obj.bookings.exclude(status='cancelled').aggregate(total=Sum('total_price'))
        return float(result['total'] or 0)

    def get_last_stay_date(self, obj):
        last = obj.bookings.exclude(status='cancelled').order_by('-check_out').first()
        return last.check_out if last else None
