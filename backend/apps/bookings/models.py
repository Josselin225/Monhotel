from django.db import models
from django.core.exceptions import ValidationError


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        CONFIRMED = 'confirmed', 'Confirmée'
        CHECKED_IN = 'checked_in', 'En cours (Check-in)'
        CHECKED_OUT = 'checked_out', 'Terminée (Check-out)'
        CANCELLED = 'cancelled', 'Annulée'
        NO_SHOW = 'no_show', 'No-show'

    class Source(models.TextChoices):
        DIRECT = 'direct', 'Direct'
        PHONE = 'phone', 'Téléphone'
        ONLINE = 'online', 'En ligne'
        AGENCY = 'agency', 'Agence'

    class PaymentMethod(models.TextChoices):
        ON_SITE = 'on_site', 'Sur place'
        TRANSFER = 'transfer', 'Virement bancaire'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='bookings', db_index=True,
    )
    reference = models.CharField(max_length=20, unique=True, editable=False, verbose_name='Référence')
    client = models.ForeignKey('clients.Client', on_delete=models.PROTECT, related_name='bookings', verbose_name='Client')
    room = models.ForeignKey('rooms.Room', on_delete=models.PROTECT, related_name='bookings', verbose_name='Chambre')
    check_in = models.DateField(db_index=True, verbose_name='Date d\'arrivée')
    check_out = models.DateField(db_index=True, verbose_name='Date de départ')
    adults = models.PositiveIntegerField(default=1, verbose_name='Adultes')
    children = models.PositiveIntegerField(default=0, verbose_name='Enfants')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True, verbose_name='Statut')
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.DIRECT, verbose_name='Source')
    class BillingType(models.TextChoices):
        NIGHTLY = 'nightly', 'Nuit(s)'
        HOURLY  = 'hourly',  'Heure(s)'

    billing_type    = models.CharField(max_length=10, choices=BillingType.choices, default=BillingType.NIGHTLY, verbose_name='Facturation')
    price_per_night = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Prix par nuit (FCFA)')
    hours           = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='Durée (heures)')
    price_per_hour  = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Prix par heure (FCFA)')
    total_price     = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Prix total (FCFA)')
    deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Acompte demandé (FCFA)')
    deposit_paid_at = models.DateTimeField(null=True, blank=True, verbose_name='Acompte encaissé le')
    payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.ON_SITE, verbose_name='Mode de paiement souhaité',
    )
    special_requests = models.TextField(blank=True, verbose_name='Demandes spéciales')
    notes = models.TextField(blank=True, verbose_name='Notes internes')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Réservation'
        verbose_name_plural = 'Réservations'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['room', 'check_in', 'check_out'], name='booking_room_dates_idx'),
            models.Index(fields=['client', 'status'], name='booking_client_status_idx'),
        ]

    @property
    def nights(self):
        if self.billing_type == self.BillingType.HOURLY:
            return 0
        return (self.check_out - self.check_in).days

    @property
    def duration_label(self):
        if self.billing_type == self.BillingType.HOURLY:
            h = self.hours or 0
            return f"{h} heure{'s' if h > 1 else ''}"
        n = self.nights
        return f"{n} nuit{'s' if n > 1 else ''}"

    def clean(self):
        if self.check_in and self.check_out:
            if self.billing_type == self.BillingType.NIGHTLY and self.check_in >= self.check_out:
                raise ValidationError("La date de départ doit être après la date d'arrivée.")
            elif self.billing_type == self.BillingType.HOURLY and self.check_in > self.check_out:
                raise ValidationError("La date de départ ne peut pas être avant la date d'arrivée.")

    def save(self, *args, **kwargs):
        if not self.hotel_id and self.room_id:
            self.hotel_id = self.room.hotel_id
        if not self.reference:
            import random, string
            self.reference = 'RES' + ''.join(random.choices(string.digits, k=7))
        if self.billing_type == self.BillingType.HOURLY:
            if self.check_in:
                self.check_out = self.check_in
            if self.hours and self.price_per_hour:
                self.total_price = self.hours * self.price_per_hour
        else:
            if self.check_in and self.check_out and self.price_per_night:
                self.total_price = self.nights * self.price_per_night
        super().save(*args, **kwargs)

    @property
    def extras_total(self):
        return sum(e.amount for e in self.extras.all())

    def __str__(self):
        return f"{self.reference} — {self.client} / Chambre {self.room.number}"


class ExtraService(models.Model):
    class Category(models.TextChoices):
        FOOD      = 'food',      'Restauration'
        TRANSPORT = 'transport', 'Transport'
        SPA       = 'spa',       'Spa & Bien-être'
        LAUNDRY   = 'laundry',   'Blanchisserie'
        MINIBAR   = 'minibar',   'Minibar'
        PHONE     = 'phone',     'Téléphone'
        OTHER     = 'other',     'Autre'

    booking     = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='extras')
    category    = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    description = models.CharField(max_length=200)
    amount      = models.DecimalField(max_digits=10, decimal_places=2)
    quantity    = models.PositiveIntegerField(default=1)
    date        = models.DateField()
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Service extra'
        verbose_name_plural = 'Services extras'
        ordering = ['-date', '-created_at']

    @property
    def total(self):
        return self.amount * self.quantity

    def __str__(self):
        return f"{self.booking.reference} — {self.description}"
