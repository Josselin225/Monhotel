import django_filters
from .models import Booking


class BookingFilter(django_filters.FilterSet):
    status      = django_filters.CharFilter(field_name='status')
    source      = django_filters.CharFilter(field_name='source')
    room        = django_filters.NumberFilter(field_name='room')
    client      = django_filters.NumberFilter(field_name='client')
    check_in_after  = django_filters.DateFilter(field_name='check_in', lookup_expr='gte')
    check_in_before = django_filters.DateFilter(field_name='check_in', lookup_expr='lte')

    class Meta:
        model = Booking
        fields = ['status', 'source', 'room', 'client', 'check_in_after', 'check_in_before']
