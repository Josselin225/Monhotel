from django.db import models
from secrets import token_hex


class Technician(models.Model):
    class Specialty(models.TextChoices):
        PLUMBING    = 'plumbing',    'Plomberie'
        ELECTRICAL  = 'electrical',  'Électricité'
        HVAC        = 'hvac',        'Climatisation / Chauffage'
        FURNITURE   = 'furniture',   'Mobilier'
        CLEANING    = 'cleaning',    'Nettoyage spécial'
        PAINTING    = 'painting',    'Peinture'
        IT          = 'it',          'Informatique / TV'
        SECURITY    = 'security',    'Sécurité'
        GENERAL     = 'general',     'Général (tous corps d\'état)'
        OTHER       = 'other',       'Autre'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='technicians', db_index=True,
    )
    name      = models.CharField(max_length=100, verbose_name='Nom')
    phone     = models.CharField(max_length=30, blank=True, verbose_name='Téléphone')
    email     = models.EmailField(blank=True, verbose_name='Email')
    specialty = models.CharField(max_length=30, choices=Specialty.choices, default=Specialty.OTHER, verbose_name='Spécialité')
    company   = models.CharField(max_length=100, blank=True, verbose_name='Entreprise')
    notes     = models.TextField(blank=True, verbose_name='Notes')
    is_active = models.BooleanField(default=True, verbose_name='Actif')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Technicien'
        verbose_name_plural = 'Techniciens'
        ordering = ['name']

    def __str__(self):
        return self.name


class MaintenanceTicket(models.Model):
    class Priority(models.TextChoices):
        LOW      = 'low',      'Faible'
        MEDIUM   = 'medium',   'Normale'
        HIGH     = 'high',     'Haute'
        URGENT   = 'urgent',   'Urgente'

    class Status(models.TextChoices):
        OPEN        = 'open',        'Ouvert'
        IN_PROGRESS = 'in_progress', 'En cours'
        RESOLVED    = 'resolved',    'Résolu'
        CLOSED      = 'closed',      'Fermé'

    class Category(models.TextChoices):
        PLUMBING    = 'plumbing',    'Plomberie'
        ELECTRICAL  = 'electrical',  'Électricité'
        HVAC        = 'hvac',        'Climatisation / Chauffage'
        FURNITURE   = 'furniture',   'Mobilier'
        CLEANING    = 'cleaning',    'Nettoyage spécial'
        PAINTING    = 'painting',    'Peinture'
        IT          = 'it',          'Informatique / TV'
        SECURITY    = 'security',    'Sécurité'
        OTHER       = 'other',       'Autre'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='maintenance_tickets', db_index=True,
    )
    reference    = models.CharField(max_length=20, unique=True, editable=False)
    room         = models.ForeignKey('rooms.Room', on_delete=models.SET_NULL, related_name='tickets', null=True, blank=True, verbose_name='Chambre')
    location     = models.CharField(max_length=200, blank=True, verbose_name='Emplacement (si pas une chambre)')
    category     = models.CharField(max_length=30, choices=Category.choices, default=Category.OTHER, verbose_name='Catégorie')
    priority     = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM, db_index=True, verbose_name='Priorité')
    status       = models.CharField(max_length=15, choices=Status.choices, default=Status.OPEN, db_index=True, verbose_name='Statut')
    title        = models.CharField(max_length=200, verbose_name='Titre')
    description  = models.TextField(blank=True, verbose_name='Description détaillée')
    reported_by  = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='reported_tickets', verbose_name='Signalé par')
    assigned_to  = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets', verbose_name='Assigné à')
    technician   = models.ForeignKey(Technician, on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets', verbose_name='Technicien')
    cost         = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Coût (FCFA)')
    resolved_at  = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True, verbose_name='Notes de résolution')
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Ticket de maintenance'
        verbose_name_plural = 'Tickets de maintenance'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'priority'], name='ticket_status_priority_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.hotel_id and self.room_id:
            self.hotel_id = self.room.hotel_id
        if not self.reference:
            self.reference = 'TKT' + token_hex(4).upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference} — {self.title}"
