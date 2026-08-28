from django.core.serializers.json import DjangoJSONEncoder
from django.db import models


class AuditEntry(models.Model):
    class Action(models.TextChoices):
        CREATE = 'create', 'Création'
        UPDATE = 'update', 'Modification'
        DELETE = 'delete', 'Suppression'
        LOGIN  = 'login',  'Connexion'
        LOGOUT = 'logout', 'Déconnexion'
        VIEW   = 'view',   'Consultation'
        OTHER  = 'other',  'Autre'

    user        = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL, related_name='audit_entries')
    hotel       = models.ForeignKey('tenants.Hotel', null=True, blank=True, on_delete=models.SET_NULL, related_name='audit_entries')
    action      = models.CharField(max_length=10, choices=Action.choices, db_index=True)
    model_name  = models.CharField(max_length=50, blank=True, db_index=True)
    object_id   = models.CharField(max_length=50, blank=True)
    object_repr = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    changes     = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder, help_text="Champs modifiés : {champ: [avant, après]} ou snapshot à la suppression")
    created_at  = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Entrée d'audit"
        verbose_name_plural = "Journal d'audit"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['model_name', 'object_id']),
            models.Index(fields=['hotel', '-created_at']),
        ]

    def __str__(self):
        return f"{self.created_at:%d/%m/%Y %H:%M} — {self.user} — {self.action} {self.model_name}"
