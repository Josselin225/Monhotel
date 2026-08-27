from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import SatisfactionSurvey
from .serializers import SatisfactionSurveySerializer, SurveySubmitSerializer
from apps.accounts.permissions import IsAdminOrManager
from apps.tenants.mixins import HotelScopeMixin


class SatisfactionSurveyViewSet(HotelScopeMixin, viewsets.ModelViewSet):
    queryset = SatisfactionSurvey.objects.select_related(
        'booking', 'booking__client', 'booking__room',
    ).all()
    serializer_class = SatisfactionSurveySerializer
    permission_classes = [IsAdminOrManager]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def create(self, request, *args, **kwargs):
        from apps.bookings.models import Booking
        booking_id = request.data.get('booking')
        if not booking_id:
            return Response({'booking': 'Ce champ est requis.'}, status=status.HTTP_400_BAD_REQUEST)
        hotel = self.get_hotel()
        bookings_qs = Booking.objects.all()
        if hotel is not None:
            bookings_qs = bookings_qs.filter(hotel=hotel)
        if not bookings_qs.filter(pk=booking_id).exists():
            return Response({'booking': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        survey, created = SatisfactionSurvey.objects.get_or_create(booking_id=booking_id)
        serializer = self.get_serializer(survey)
        http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=http_status)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny],
            url_path='testimonials')
    def testimonials(self, request):
        """Retourne les derniers avis clients publiables (commentaire non vide, note ≥ 4)."""
        qs = SatisfactionSurvey.objects.filter(
            submitted_at__isnull=False,
            comment__gt='',
            score_overall__gte=4,
        ).select_related('booking__client').order_by('-submitted_at')[:9]

        data = []
        for s in qs:
            client = s.booking.client
            # Prénom + initiale du nom pour la confidentialité
            name = client.first_name or client.full_name.split()[0]
            if client.last_name:
                name = f"{name} {client.last_name[0]}."
            data.append({
                'author':        name,
                'score_overall': s.score_overall,
                'text':          s.comment,
                'would_return':  s.would_return,
                'submitted_at':  s.submitted_at,
            })
        return Response(data)

    @action(detail=False, methods=['get', 'post'], permission_classes=[AllowAny],
            url_path='respond/(?P<token>[^/.]+)')
    def respond(self, request, token=None):
        """
        GET  /surveys/respond/<token>/  → retourne les infos du séjour
        POST /surveys/respond/<token>/  → soumet les réponses
        """
        try:
            survey = SatisfactionSurvey.objects.select_related(
                'booking', 'booking__client',
            ).get(token=token)
        except SatisfactionSurvey.DoesNotExist:
            return Response({'detail': 'Lien invalide ou expiré.'}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'GET':
            return Response({
                'is_submitted':  survey.is_submitted,
                'booking_ref':   survey.booking.reference,
                'client_name':   survey.booking.client.full_name,
                'check_in':      survey.booking.check_in,
                'check_out':     survey.booking.check_out,
            })

        if survey.is_submitted:
            return Response({'detail': 'Ce questionnaire a déjà été soumis.'}, status=status.HTTP_400_BAD_REQUEST)

        ser = SurveySubmitSerializer(survey, data=request.data, partial=False)
        ser.is_valid(raise_exception=True)
        ser.save(submitted_at=timezone.now())
        return Response({'detail': 'Merci pour votre avis !'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def stats(self, request):
        qs = self.get_queryset().filter(submitted_at__isnull=False)
        total = qs.count()
        if not total:
            return Response({'total': 0, 'average': None, 'would_return_pct': None, 'scores': {}})

        def avg(field):
            vals = [getattr(s, field) for s in qs if getattr(s, field) is not None]
            return round(sum(vals) / len(vals), 2) if vals else None

        would_return_count = qs.filter(would_return=True).count()
        return Response({
            'total':            total,
            'pending':          self.get_queryset().filter(submitted_at__isnull=True).count(),
            'would_return_pct': round(would_return_count / total * 100, 1),
            'scores': {
                'overall':     avg('score_overall'),
                'cleanliness': avg('score_cleanliness'),
                'service':     avg('score_service'),
                'comfort':     avg('score_comfort'),
                'value':       avg('score_value'),
            },
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrManager])
    def send_survey(self, request, pk=None):
        """Envoie (ou renvoie) le lien de questionnaire par email."""
        survey = self.get_object()
        try:
            from apps.notifications.emails import send_satisfaction_survey
            send_satisfaction_survey(survey)
            return Response({'detail': 'Email envoyé.'})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrManager])
    def send_reminder(self, request, pk=None):
        """Envoie un email de rappel pour un questionnaire non complété."""
        survey = self.get_object()
        if survey.is_submitted:
            return Response({'detail': 'Ce questionnaire a déjà été soumis.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from apps.notifications.emails import send_survey_reminder
            send_survey_reminder(survey)
            survey.refresh_from_db(fields=['reminder_sent_at'])
            return Response({'detail': 'Rappel envoyé.', 'reminder_sent_at': survey.reminder_sent_at})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
