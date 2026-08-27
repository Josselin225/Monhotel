import secrets
from django.db import models


class SatisfactionSurvey(models.Model):
    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='satisfaction_surveys', db_index=True,
    )
    booking    = models.OneToOneField('bookings.Booking', on_delete=models.CASCADE,
                                      related_name='survey', verbose_name='Réservation')
    token      = models.CharField(max_length=64, unique=True, editable=False,
                                  verbose_name='Jeton de réponse')
    submitted_at = models.DateTimeField(null=True, blank=True, verbose_name='Répondu le')

    # Scores 1–5
    score_overall     = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='Note globale')
    score_cleanliness = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='Propreté')
    score_service     = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='Service')
    score_comfort     = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='Confort')
    score_value       = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='Rapport qualité/prix')

    comment      = models.TextField(blank=True, verbose_name='Commentaire')
    would_return = models.BooleanField(null=True, blank=True, verbose_name='Reviendrait')
    created_at        = models.DateTimeField(auto_now_add=True)
    reminder_sent_at  = models.DateTimeField(null=True, blank=True, verbose_name='Rappel envoyé le')

    class Meta:
        verbose_name = 'Questionnaire de satisfaction'
        verbose_name_plural = 'Questionnaires de satisfaction'
        ordering = ['-created_at']

    @property
    def is_submitted(self):
        return self.submitted_at is not None

    @property
    def average_score(self):
        scores = [s for s in [
            self.score_overall, self.score_cleanliness,
            self.score_service, self.score_comfort, self.score_value,
        ] if s is not None]
        return round(sum(scores) / len(scores), 1) if scores else None

    def save(self, *args, **kwargs):
        if not self.hotel_id and self.booking_id:
            self.hotel_id = self.booking.hotel_id
        if not self.token:
            self.token = secrets.token_urlsafe(40)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Questionnaire {self.booking.reference} — {'répondu' if self.is_submitted else 'en attente'}"
