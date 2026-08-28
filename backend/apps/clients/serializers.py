from decimal import Decimal
from rest_framework import serializers
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

    def _active_bookings(self, obj):
        # Réutilise le Prefetch('bookings', exclude cancelled, .only(...)) posé par
        # ClientViewSet.get_queryset() quand il est présent (0 requête en plus par client
        # sur la liste) ; retombe sur une seule requête sinon (ex : ClientSerializer imbriqué
        # dans BookingSerializer.client_detail, qui ne pose pas ce prefetch). Le résultat est
        # mis en cache sur l'instance pour que les 4 champs calculés ne réémettent pas chacun
        # leur propre requête en mode fallback.
        cached = getattr(obj, '_active_bookings_cache', None)
        if cached is not None:
            return cached
        objects_cache = getattr(obj, '_prefetched_objects_cache', None)
        if objects_cache and 'bookings' in objects_cache:
            bookings = list(objects_cache['bookings'])
        else:
            bookings = list(
                obj.bookings.exclude(status='cancelled').only(
                    'id', 'client_id', 'check_in', 'check_out', 'total_price', 'status'
                )
            )
        obj._active_bookings_cache = bookings
        return bookings

    def get_bookings_count(self, obj):
        return len(self._active_bookings(obj))

    def get_total_nights(self, obj):
        return sum((b.check_out - b.check_in).days for b in self._active_bookings(obj))

    def get_lifetime_value(self, obj):
        return float(sum((b.total_price for b in self._active_bookings(obj)), Decimal('0')))

    def get_last_stay_date(self, obj):
        bookings = self._active_bookings(obj)
        return max((b.check_out for b in bookings), default=None)
