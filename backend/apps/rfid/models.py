from django.db import models
from django.utils import timezone


class RfidCard(models.Model):
    class CardType(models.TextChoices):
        GUEST = 'guest', 'Client'
        STAFF = 'staff', 'Personnel'
        MASTER = 'master', 'Passe général'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        LOST = 'lost', 'Perdue'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='rfid_cards', db_index=True,
    )
    uid = models.CharField(max_length=64, db_index=True, verbose_name='Identifiant carte')
    card_type = models.CharField(max_length=10, choices=CardType.choices, default=CardType.GUEST, verbose_name='Type')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE, db_index=True, verbose_name='Statut')

    booking = models.ForeignKey(
        'bookings.Booking', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='rfid_cards', verbose_name='Réservation',
    )
    room = models.ForeignKey(
        'rooms.Room', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='rfid_cards', verbose_name='Chambre',
    )
    valid_from = models.DateTimeField(null=True, blank=True, verbose_name='Valide à partir de')
    valid_until = models.DateTimeField(null=True, blank=True, verbose_name="Valide jusqu'à")

    issued_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='rfid_cards_issued', verbose_name='Émise par',
    )
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Carte RFID'
        verbose_name_plural = 'Cartes RFID'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['hotel', 'uid']),
            models.Index(fields=['hotel', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self.hotel_id:
            if self.room_id:
                self.hotel_id = self.room.hotel_id
            elif self.booking_id:
                self.hotel_id = self.booking.hotel_id
        super().save(*args, **kwargs)

    @property
    def is_valid_now(self):
        if self.status != self.Status.ACTIVE:
            return False
        now = timezone.now()
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        return True

    def __str__(self):
        return f"{self.uid} — {self.get_card_type_display()} ({self.get_status_display()})"
