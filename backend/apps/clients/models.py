from django.db import models
from django.conf import settings


class Client(models.Model):
    class IdType(models.TextChoices):
        CNI = 'cni', "Carte Nationale d'Identité"
        PASSPORT = 'passport', 'Passeport'
        DRIVER = 'driver', 'Permis de conduire'
        OTHER = 'other', 'Autre'

    class VipStatus(models.TextChoices):
        REGULAR = 'regular', 'Régulier'
        VIP = 'vip', 'VIP'
        VVIP = 'vvip', 'VVIP'

    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='clients', db_index=True,
    )
    first_name = models.CharField(max_length=100, verbose_name='Prénom')
    last_name = models.CharField(max_length=100, verbose_name='Nom')
    email = models.EmailField(blank=True, verbose_name='Email')
    phone = models.CharField(max_length=20, verbose_name='Téléphone')
    nationality = models.CharField(max_length=100, blank=True, verbose_name='Nationalité')
    id_type = models.CharField(max_length=20, choices=IdType.choices, default=IdType.CNI, verbose_name="Type de pièce d'identité")
    id_number = models.CharField(max_length=50, blank=True, verbose_name="Numéro de pièce")
    address = models.TextField(blank=True, verbose_name='Adresse')
    notes = models.TextField(blank=True, verbose_name='Notes')
    # Blacklist
    is_blacklisted    = models.BooleanField(default=False, db_index=True, verbose_name='Liste noire')
    blacklist_reason  = models.TextField(blank=True, verbose_name='Motif liste noire')
    # CRM fields
    vip_status = models.CharField(max_length=10, choices=VipStatus.choices, default=VipStatus.REGULAR, db_index=True, verbose_name='Statut VIP')
    birthday = models.DateField(null=True, blank=True, verbose_name='Date de naissance')
    preferences = models.TextField(blank=True, verbose_name='Préférences')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Client'
        verbose_name_plural = 'Clients'
        ordering = ['last_name', 'first_name']

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return self.full_name


class ClientNote(models.Model):
    class NoteType(models.TextChoices):
        NOTE = 'note', 'Note interne'
        CALL = 'call', 'Appel téléphonique'
        EMAIL = 'email', 'Email'
        COMPLAINT = 'complaint', 'Réclamation'
        REQUEST = 'request', 'Demande spéciale'
        VISIT = 'visit', 'Visite / Séjour'

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='crm_notes', db_index=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='crm_notes')
    note_type = models.CharField(max_length=20, choices=NoteType.choices, default=NoteType.NOTE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['client', '-created_at'], name='clientnote_client_date_idx'),
        ]

    def __str__(self):
        return f"{self.client} — {self.get_note_type_display()}"
