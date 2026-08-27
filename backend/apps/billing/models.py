from django.db import models
from django.utils import timezone


class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Brouillon'
        ISSUED = 'issued', 'Émise'
        PAID = 'paid', 'Payée'
        CANCELLED = 'cancelled', 'Annulée'

    class PaymentMethod(models.TextChoices):
        CASH = 'cash', 'Espèces'
        CARD = 'card', 'Carte bancaire'
        MOBILE = 'mobile', 'Mobile Money'
        TRANSFER = 'transfer', 'Virement'
        OTHER = 'other', 'Autre'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='invoices', db_index=True,
    )
    number = models.CharField(max_length=20, unique=True, editable=False, verbose_name='Numéro')
    booking = models.OneToOneField('bookings.Booking', on_delete=models.PROTECT, related_name='invoice', verbose_name='Réservation')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True, verbose_name='Statut')
    issued_at = models.DateTimeField(null=True, blank=True, verbose_name='Date d\'émission')
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name='Date de paiement')
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, blank=True, verbose_name='Mode de paiement')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Sous-total (FCFA)')
    taxes = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Taxes (FCFA)')
    total = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Total (FCFA)')
    notes = models.TextField(blank=True, verbose_name='Notes')
    extra_services = models.JSONField(default=list, blank=True, verbose_name='Services supplémentaires')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Facture'
        verbose_name_plural = 'Factures'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.hotel_id and self.booking_id:
            self.hotel_id = self.booking.hotel_id
        if not self.number:
            import random, string
            self.number = 'FAC' + ''.join(random.choices(string.digits, k=7))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Facture {self.number} — {self.booking.client}"


class Payment(models.Model):
    class PaymentMethod(models.TextChoices):
        CASH     = 'cash',     'Espèces'
        CARD     = 'card',     'Carte bancaire'
        MOBILE   = 'mobile',   'Mobile Money'
        TRANSFER = 'transfer', 'Virement'
        OTHER    = 'other',    'Autre'

    invoice    = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments', verbose_name='Facture')
    amount     = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Montant (FCFA)')
    method     = models.CharField(max_length=20, choices=PaymentMethod.choices, verbose_name='Mode de paiement')
    reference  = models.CharField(max_length=100, blank=True, verbose_name='Référence')
    note       = models.TextField(blank=True, verbose_name='Note')
    paid_at    = models.DateTimeField(default=timezone.now, verbose_name='Date du paiement')
    created_by = models.ForeignKey(
        'accounts.User', null=True, blank=True,
        on_delete=models.SET_NULL, verbose_name='Enregistré par',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Paiement'
        verbose_name_plural = 'Paiements'
        ordering = ['-paid_at']

    def __str__(self):
        return f"Paiement {self.amount} FCFA — {self.invoice.number}"
