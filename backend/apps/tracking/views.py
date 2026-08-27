from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrManager
from .models import SiteVisit


@api_view(['POST'])
@permission_classes([AllowAny])
def track(request):
    path        = (request.data.get('path') or '/')[:500]
    session_key = (request.data.get('session_key') or '')[:64]
    referrer    = (request.data.get('referrer') or '')[:500]
    SiteVisit.objects.create(path=path, session_key=session_key, referrer=referrer)
    return Response(status=204)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def stats(request):
    now = timezone.now()
    d30 = now - timedelta(days=30)
    d90 = now - timedelta(days=90)

    qs30 = SiteVisit.objects.filter(timestamp__gte=d30)
    qs90 = SiteVisit.objects.filter(timestamp__gte=d90)

    daily = list(
        qs90
        .annotate(date=TruncDate('timestamp'))
        .values('date')
        .annotate(visits=Count('id'), unique=Count('session_key', distinct=True))
        .order_by('date')
    )

    referrers = list(
        qs90.exclude(referrer='')
        .values('referrer')
        .annotate(count=Count('id'))
        .order_by('-count')[:5]
    )

    return Response({
        'last_30_days': {
            'visits': qs30.count(),
            'unique': qs30.values('session_key').distinct().count(),
        },
        'last_90_days': {
            'visits': qs90.count(),
            'unique': qs90.values('session_key').distinct().count(),
        },
        'daily':     daily,
        'referrers': referrers,
    })
