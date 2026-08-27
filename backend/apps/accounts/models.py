from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrateur'
        RECEPTIONIST = 'receptionist', 'Réceptionniste'
        MANAGER = 'manager', 'Manager'

    role   = models.CharField(max_length=20, choices=Role.choices, default=Role.RECEPTIONIST)
    phone  = models.CharField(max_length=20, blank=True)
    avatar = models.TextField(blank=True, default='')

    # ── Authentification à deux facteurs (TOTP) ──
    two_factor_secret       = models.CharField(max_length=32, blank=True, default='')
    two_factor_enabled      = models.BooleanField(default=False)
    two_factor_backup_codes = models.JSONField(default=list, blank=True)  # hashes des codes de secours
    hotel  = models.ForeignKey(
        'tenants.Hotel',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='users',
        db_index=True,
    )

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"
