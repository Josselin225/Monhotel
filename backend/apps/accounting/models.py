import secrets
from django.db import models


class Transaction(models.Model):
    class Type(models.TextChoices):
        INCOME  = 'income',  'Recette'
        EXPENSE = 'expense', 'Dépense'

    class Category(models.TextChoices):
        # Recettes
        ROOM_REVENUE = 'room_revenue', 'Revenus chambres'
        DEPOSIT      = 'deposit',      'Acomptes encaissés'
        EXTRA        = 'extra',        'Services extra'
        OTHER_INCOME = 'other_income', 'Autres recettes'
        # Dépenses
        STAFF        = 'staff',        'Personnel'
        MAINTENANCE  = 'maintenance',  'Maintenance'
        SUPPLIES     = 'supplies',     'Fournitures'
        UTILITIES    = 'utilities',    'Charges & Fluides'
        MARKETING    = 'marketing',    'Marketing'
        TAXES        = 'taxes',        'Impôts & Taxes'
        OTHER_EXPENSE = 'other_expense', 'Autres dépenses'

    class PaymentMethod(models.TextChoices):
        CASH     = 'cash',     'Espèces'
        CARD     = 'card',     'Carte bancaire'
        MOBILE   = 'mobile',   'Mobile Money'
        TRANSFER = 'transfer', 'Virement'
        OTHER    = 'other',    'Autre'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='transactions', db_index=True,
    )
    reference      = models.CharField(max_length=20, unique=True, editable=False)
    type           = models.CharField(max_length=10, choices=Type.choices, db_index=True)
    category       = models.CharField(max_length=20, choices=Category.choices, db_index=True)
    amount         = models.DecimalField(max_digits=12, decimal_places=2)
    date           = models.DateField(db_index=True)
    description    = models.CharField(max_length=255)
    payment_method = models.CharField(max_length=10, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    booking        = models.ForeignKey(
        'bookings.Booking', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='transactions'
    )
    notes          = models.TextField(blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Transaction'
        verbose_name_plural = 'Transactions'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['type', 'date']),
            models.Index(fields=['category', 'date']),
        ]

    def save(self, *args, **kwargs):
        if not self.hotel_id and self.booking_id:
            self.hotel_id = self.booking.hotel_id
        if not self.reference:
            prefix = 'REC' if self.type == self.Type.INCOME else 'DEP'
            self.reference = prefix + secrets.token_hex(4).upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.reference} – {self.description} ({self.amount} FCFA)'


class Budget(models.Model):
    class Period(models.TextChoices):
        MONTHLY  = 'monthly',  'Mensuel'
        ANNUAL   = 'annual',   'Annuel'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='budgets', db_index=True,
    )
    category   = models.CharField(max_length=20, choices=Transaction.Category.choices)
    amount     = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Montant budget (FCFA)')
    period     = models.CharField(max_length=10, choices=Period.choices, default=Period.MONTHLY)
    year       = models.PositiveSmallIntegerField()
    month      = models.PositiveSmallIntegerField(null=True, blank=True)
    alert_pct  = models.PositiveSmallIntegerField(default=80, verbose_name='Alerte à (%) du budget')
    notes      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Budget'
        verbose_name_plural = 'Budgets'
        unique_together = [['hotel', 'category', 'period', 'year', 'month']]
        ordering = ['year', 'month', 'category']

    def __str__(self):
        return f"Budget {self.get_category_display()} {self.year}/{self.month or ''}"
