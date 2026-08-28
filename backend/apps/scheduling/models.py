from django.db import models


class Position(models.TextChoices):
    RECEPTION    = 'reception',    'Réception'
    HOUSEKEEPING = 'housekeeping', 'Ménage'
    MAINTENANCE  = 'maintenance',  'Maintenance'
    RESTAURANT   = 'restaurant',   'Restauration'
    MANAGEMENT   = 'management',   'Direction'
    SECURITY     = 'security',     'Sécurité'
    OTHER        = 'other',        'Autre'


class Employee(models.Model):
    """Membre du personnel planifiable. Indépendant d'un compte de connexion :
    un vigile, un agent de ménage ou un employé sans accès au logiciel peut être
    ajouté ici pour figurer dans le planning, sans qu'un compte utilisateur soit créé.
    Peut optionnellement être relié à un compte (`user`) pour le personnel qui
    utilise aussi l'application — lui permet de voir ses propres créneaux."""
    hotel = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='employees', db_index=True,
    )
    name       = models.CharField(max_length=100, verbose_name='Nom complet')
    position   = models.CharField(max_length=20, choices=Position.choices, default=Position.OTHER, verbose_name='Poste')
    phone      = models.CharField(max_length=30, blank=True, verbose_name='Téléphone')
    email      = models.EmailField(blank=True, verbose_name='Email')
    notes      = models.TextField(blank=True, verbose_name='Notes')
    is_active  = models.BooleanField(default=True, verbose_name='Actif')
    user       = models.OneToOneField(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='employee_profile', verbose_name='Compte utilisateur lié',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Employé'
        verbose_name_plural = 'Employés'
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.hotel_id and self.user_id:
            self.hotel_id = self.user.hotel_id
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Shift(models.Model):
    Position = Position  # rétro-compatibilité : Shift.Position.XXX reste utilisable

    hotel     = models.ForeignKey(
        'tenants.Hotel', on_delete=models.CASCADE,
        null=True, blank=True, related_name='shifts', db_index=True,
    )
    employee   = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='shifts', verbose_name='Employé')
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
        indexes = [models.Index(fields=['date', 'employee'])]

    def save(self, *args, **kwargs):
        if not self.hotel_id and self.employee_id:
            self.hotel_id = self.employee.hotel_id
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
        return f'{self.employee} — {self.date} {self.start_time}-{self.end_time}'
