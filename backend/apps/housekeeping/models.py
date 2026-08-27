from django.db import models
from django.conf import settings


class CleaningTask(models.Model):
    class Status(models.TextChoices):
        PENDING   = 'pending',   'À nettoyer'
        IN_PROGRESS = 'in_progress', 'En cours'
        DONE      = 'done',      'Terminé'
        INSPECTED = 'inspected', 'Inspecté'

    class Priority(models.TextChoices):
        NORMAL = 'normal', 'Normal'
        URGENT = 'urgent', 'Urgent'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='cleaning_tasks', db_index=True,
    )
    room = models.ForeignKey('rooms.Room', on_delete=models.CASCADE,
                             related_name='cleaning_tasks', verbose_name='Chambre', db_index=True)
    booking = models.ForeignKey('bookings.Booking', on_delete=models.SET_NULL,
                                null=True, blank=True, related_name='cleaning_tasks', verbose_name='Réservation')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='cleaning_tasks', verbose_name='Assigné à')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING,
                              db_index=True, verbose_name='Statut')
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL,
                                verbose_name='Priorité')
    notes = models.TextField(blank=True, verbose_name='Consignes')
    scheduled_for = models.DateField(null=True, blank=True, verbose_name='Prévue le')
    started_at = models.DateTimeField(null=True, blank=True, verbose_name='Début')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='Fin')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tâche de nettoyage'
        verbose_name_plural = 'Tâches de nettoyage'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'scheduled_for'], name='cleaning_status_date_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.hotel_id and self.room_id:
            self.hotel_id = self.room.hotel_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Chambre {self.room.number} — {self.get_status_display()}"
