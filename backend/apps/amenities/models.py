from django.db import models


class AmenityType(models.TextChoices):
    RESTAURANT = 'restaurant', 'Restaurant'
    CONFERENCE = 'conference', 'Salle de conférence'
    POOL       = 'pool',       'Piscine'
    SPA        = 'spa',        'Spa'


class AmenityReservation(models.Model):
    """Réservation unifiée pour les services de l'hôtel (restaurant, salle de
    conférence, piscine, spa) — un seul modèle, filtré par `amenity` dans chaque
    page de gestion dédiée."""

    class Status(models.TextChoices):
        PENDING   = 'pending',   'En attente'
        CONFIRMED = 'confirmed', 'Confirmée'
        CANCELLED = 'cancelled', 'Annulée'
        COMPLETED = 'completed', 'Terminée'

    class Source(models.TextChoices):
        STAFF  = 'staff',  'Personnel'
        ONLINE = 'online', 'En ligne'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='amenity_reservations', db_index=True,
    )
    amenity = models.CharField(max_length=20, choices=AmenityType.choices, db_index=True, verbose_name='Service')
    client = models.ForeignKey(
        'clients.Client', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='amenity_reservations', verbose_name='Client (fiche existante)',
    )
    client_name  = models.CharField(max_length=150, verbose_name='Nom du client')
    client_phone = models.CharField(max_length=30, blank=True, verbose_name='Téléphone')
    date         = models.DateField(db_index=True)
    start_time   = models.TimeField()
    end_time     = models.TimeField(null=True, blank=True)
    party_size   = models.PositiveIntegerField(default=1, verbose_name='Nombre de personnes')
    detail       = models.CharField(max_length=150, blank=True, verbose_name='Détail')
    price        = models.DecimalField(max_digits=10, decimal_places=0, null=True, blank=True, verbose_name='Prix (FCFA)')
    status       = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    source       = models.CharField(max_length=10, choices=Source.choices, default=Source.STAFF)
    notes        = models.TextField(blank=True)
    created_by   = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True,
                                     related_name='amenity_reservations_created')
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Réservation de service'
        verbose_name_plural = 'Réservations de services'
        ordering = ['-date', '-start_time']
        indexes = [models.Index(fields=['amenity', 'date'])]

    def __str__(self):
        return f'{self.get_amenity_display()} — {self.client_name} ({self.date})'


class MenuItem(models.Model):
    """Plat/boisson du menu du restaurant. `is_available` détermine s'il figure
    au menu du jour actuellement affiché (aux clients côté réservation en ligne
    comme au personnel dans la gestion du restaurant)."""

    class Category(models.TextChoices):
        STARTER = 'starter', 'Entrée'
        MAIN    = 'main',    'Plat principal'
        DESSERT = 'dessert', 'Dessert'
        DRINK   = 'drink',   'Boisson'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='menu_items', db_index=True,
    )
    name         = models.CharField(max_length=150, verbose_name='Nom du plat')
    description  = models.TextField(blank=True)
    category     = models.CharField(max_length=20, choices=Category.choices, default=Category.MAIN)
    price        = models.DecimalField(max_digits=10, decimal_places=0, verbose_name='Prix (FCFA)')
    is_available = models.BooleanField(default=True, verbose_name='Au menu du jour')
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Plat du menu'
        verbose_name_plural = 'Plats du menu'
        ordering = ['category', 'name']

    def __str__(self):
        return self.name
