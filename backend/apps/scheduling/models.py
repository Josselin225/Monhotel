from django.db import models


class Shift(models.Model):
    class Position(models.TextChoices):
        RECEPTION    = 'reception',    'Réception'
        HOUSEKEEPING = 'housekeeping', 'Ménage'
        MAINTENANCE  = 'maintenance',  'Maintenance'
        RESTAURANT   = 'restaurant',   'Restauration'
        MANAGEMENT   = 'management',   'Direction'
        SECURITY     = 'security',     'Sécurité'
        OTHER        = 'other',        'Autre'

    hotel     = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='shifts', db_index=True,
    )
    user       = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='shifts')
    date       = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time   = models.TimeField()
    position   = models.CharField(max_length=20, choices=Position.choices, default=Position.OTHER)
    notes      = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True,
                                   related_name='shifts_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Créneau de travail'
        verbose_name_plural = 'Créneaux de travail'
        ordering = ['date', 'start_time']
        indexes = [models.Index(fields=['date', 'user'])]

    def save(self, *args, **kwargs):
        if not self.hotel_id and self.user_id:
            self.hotel_id = self.user.hotel_id
        super().save(*args, **kwargs)

    @property
    def hours(self):
        from datetime import datetime, timedelta
        start = datetime.combine(self.date, self.start_time)
        end = datetime.combine(self.date, self.end_time)
        if end <= start:
            end += timedelta(days=1)  # créneau de nuit passant minuit
        return round((end - start).total_seconds() / 3600, 2)

    def __str__(self):
        return f'{self.user} — {self.date} {self.start_time}-{self.end_time}'
