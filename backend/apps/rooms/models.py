from django.db import models


class PricingRule(models.Model):
    class RuleType(models.TextChoices):
        SEASON_HIGH   = 'season_high',  'Saison haute'
        SEASON_LOW    = 'season_low',   'Saison basse'
        WEEKEND       = 'weekend',      'Weekend'
        EARLY_BIRD    = 'early_bird',   'Réservation anticipée'
        LAST_MINUTE   = 'last_minute',  'Last minute'
        OCCUPANCY     = 'occupancy',    "Taux d'occupation"

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='pricing_rules', db_index=True,
    )
    name           = models.CharField(max_length=100, verbose_name='Nom de la règle')
    rule_type      = models.CharField(max_length=20, choices=RuleType.choices, verbose_name='Type')
    room_type      = models.ForeignKey('RoomType', on_delete=models.CASCADE,
                                       null=True, blank=True, related_name='pricing_rules',
                                       verbose_name='Type de chambre (optionnel)')
    is_active      = models.BooleanField(default=True, verbose_name='Active')
    percent_change = models.DecimalField(max_digits=6, decimal_places=2, default=0,
                                         verbose_name='Variation en % (négatif = réduction)')
    date_start     = models.DateField(null=True, blank=True, verbose_name='Date début (saisons)')
    date_end       = models.DateField(null=True, blank=True, verbose_name='Date fin (saisons)')
    days_threshold = models.PositiveIntegerField(null=True, blank=True,
                                                  verbose_name='Seuil en jours (early_bird / last_minute)')
    occupancy_threshold = models.PositiveIntegerField(null=True, blank=True,
                                                       verbose_name="Seuil de taux d'occupation en % (occupancy)")
    priority       = models.PositiveIntegerField(default=0, verbose_name='Priorité (plus grand = prioritaire)')
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Règle de tarification'
        verbose_name_plural = 'Règles de tarification'
        ordering = ['-priority', 'name']

    def save(self, *args, **kwargs):
        if not self.hotel_id and self.room_type_id:
            self.hotel_id = self.room_type.hotel_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.get_rule_type_display()}) {self.percent_change:+.1f}%"


class RoomType(models.Model):
    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='room_types', db_index=True,
    )
    name = models.CharField(max_length=100, verbose_name='Nom')
    description = models.TextField(blank=True, verbose_name='Description')
    base_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Prix de base (FCFA)')
    capacity = models.PositiveIntegerField(default=2, verbose_name='Capacité (personnes)')
    amenities   = models.JSONField(default=list, blank=True, verbose_name='Équipements')
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Tarif horaire (FCFA)')

    class Meta:
        verbose_name = 'Type de chambre'
        verbose_name_plural = 'Types de chambres'

    def __str__(self):
        return self.name


class Room(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = 'available', 'Disponible'
        OCCUPIED = 'occupied', 'Occupée'
        MAINTENANCE = 'maintenance', 'En maintenance'
        CLEANING = 'cleaning', 'En nettoyage'

    class Floor(models.IntegerChoices):
        GROUND = 0, 'Rez-de-chaussée'
        FIRST = 1, '1er étage'
        SECOND = 2, '2ème étage'
        THIRD = 3, '3ème étage'
        FOURTH = 4, '4ème étage'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='rooms', db_index=True,
    )
    number = models.CharField(max_length=10, unique=True, verbose_name='Numéro')
    room_type = models.ForeignKey(RoomType, on_delete=models.PROTECT, related_name='rooms', verbose_name='Type')
    floor = models.IntegerField(choices=Floor.choices, default=Floor.GROUND, verbose_name='Étage')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE, verbose_name='Statut')
    price_override = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Prix personnalisé')
    notes = models.TextField(blank=True, verbose_name='Notes')
    image = models.ImageField(upload_to='rooms/', null=True, blank=True, verbose_name='Photo')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Chambre'
        verbose_name_plural = 'Chambres'
        ordering = ['number']

    @property
    def price(self):
        return self.price_override or self.room_type.base_price

    def __str__(self):
        return f"Chambre {self.number} ({self.room_type.name})"
