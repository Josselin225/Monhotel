from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth.signals import user_logged_in, user_logged_out

from .middleware import get_current_user, get_current_ip

# Modèles suivis : 'app_label.Model' -> nom lisible affiché dans le journal.
# Volontairement absents : audit_log.AuditEntry (boucle infinie), tracking.SiteVisit
# (analytics de fréquentation du site public, pas une action d'un utilisateur de l'app).
TRACKED = {
    'tenants.Hotel':                 'Hôtel',
    'accounts.User':                 'Utilisateur',
    'rooms.Room':                    'Chambre',
    'rooms.RoomType':                'Type de chambre',
    'rooms.PricingRule':             'Règle tarifaire',
    'clients.Client':                'Client',
    'clients.ClientNote':            'Note client',
    'bookings.Booking':              'Réservation',
    'bookings.ExtraService':         'Service extra',
    'billing.Invoice':               'Facture',
    'billing.Payment':               'Paiement',
    'content.SiteContent':           'Contenu du site',
    'housekeeping.CleaningTask':     'Tâche de ménage',
    'satisfaction.SatisfactionSurvey': 'Questionnaire satisfaction',
    'accounting.Transaction':        'Transaction',
    'accounting.Budget':             'Budget',
    'maintenance.Technician':        'Technicien',
    'maintenance.MaintenanceTicket': 'Ticket maintenance',
    'scheduling.Shift':              'Créneau personnel',
    'scheduling.Employee':           'Employé',
    'inventory.InventoryCategory':   'Catégorie de stock',
    'inventory.InventoryItem':       'Article de stock',
    'inventory.InventoryMovement':   'Mouvement de stock',
    'rfid.RfidCard':                 'Carte RFID',
    'amenities.AmenityReservation':  'Réservation de service',
    'amenities.MenuItem':            'Plat du menu',
}

# Champs jamais consignés (bruit ou sensibles)
GLOBAL_EXCLUDE = {'id', 'created_at', 'updated_at', 'hotel'}
SENSITIVE_FIELDS = {
    'Utilisateur': {'password', 'two_factor_secret', 'two_factor_backup_codes'},
    # Jeton d'accès public au questionnaire : pas de valeur d'audit, évite une 2e exposition.
    'Questionnaire satisfaction': {'token'},
}


def _log(user, action, model_name, obj_id, obj_repr, description='', ip=None, changes=None, hotel=None):
    try:
        from .models import AuditEntry
        if hotel is None and user is not None:
            hotel = getattr(user, 'hotel', None)
        AuditEntry.objects.create(
            user=user,
            hotel=hotel,
            action=action,
            model_name=model_name,
            object_id=str(obj_id),
            object_repr=obj_repr[:255],
            description=description,
            ip_address=ip,
            changes=changes or {},
        )
    except Exception:
        pass  # ne jamais faire échouer la requête principale


def _display_value(instance, field):
    """Valeur lisible d'un champ pour le journal (résout les FK en texte)."""
    from django.db.models import ForeignKey
    if isinstance(field, ForeignKey):
        try:
            related = getattr(instance, field.name)
        except Exception:
            related = None
        return str(related) if related is not None else None
    try:
        return field.value_from_object(instance)
    except Exception:
        return None


def _resolve_hotel(instance):
    """L'hôtel concerné par l'entrée. Cas particulier : pour le modèle Hôtel
    lui-même, c'est l'instance modifiée, pas un éventuel champ `hotel`."""
    from apps.tenants.models import Hotel
    if isinstance(instance, Hotel):
        return instance
    return getattr(instance, 'hotel', None)


def _connect_model(model_path, friendly_name):
    try:
        from django.apps import apps
        Model = apps.get_model(model_path)
    except LookupError:
        return

    from django.db.models import JSONField

    exclude = GLOBAL_EXCLUDE | SENSITIVE_FIELDS.get(friendly_name, set())
    tracked_fields = [f for f in Model._meta.fields if f.name not in exclude]

    def field_label(f):
        return str(f.verbose_name) if f.verbose_name else f.name

    def add_field_changes(changes, f, old_val, new_val):
        if old_val == new_val:
            return
        # Diff au niveau des clés pour les champs JSON (ex: contenu du site) :
        # évite de recopier tout le blob pour un seul champ modifié dedans.
        if isinstance(f, JSONField) and isinstance(old_val, dict) and isinstance(new_val, dict):
            for key in sorted(set(old_val) | set(new_val)):
                ov, nv = old_val.get(key), new_val.get(key)
                if ov != nv:
                    changes[f"{field_label(f)} · {key}"] = [ov, nv]
        else:
            changes[field_label(f)] = [old_val, new_val]

    @receiver(pre_save, sender=Model, weak=False)
    def on_pre_save(sender, instance, **kwargs):
        instance._audit_old = None
        if instance.pk:
            try:
                instance._audit_old = sender.objects.get(pk=instance.pk)
            except sender.DoesNotExist:
                pass

    @receiver(post_save, sender=Model, weak=False)
    def on_save(sender, instance, created, **kwargs):
        changes = {}
        if not created:
            old = getattr(instance, '_audit_old', None)
            if old is not None:
                for f in tracked_fields:
                    add_field_changes(changes, f, _display_value(old, f), _display_value(instance, f))
            if not changes:
                return  # sauvegarde sans changement réel (ex: update_fields technique) : pas de bruit
        _log(
            user=get_current_user(),
            hotel=_resolve_hotel(instance),
            action='create' if created else 'update',
            model_name=friendly_name,
            obj_id=instance.pk,
            obj_repr=str(instance),
            changes=changes,
            ip=get_current_ip(),
        )

    @receiver(post_delete, sender=Model, weak=False)
    def on_delete(sender, instance, **kwargs):
        snapshot = {field_label(f): _display_value(instance, f) for f in tracked_fields}
        _log(
            user=get_current_user(),
            hotel=_resolve_hotel(instance),
            action='delete',
            model_name=friendly_name,
            obj_id=instance.pk,
            obj_repr=str(instance),
            changes=snapshot,
            ip=get_current_ip(),
        )


for _path, _name in TRACKED.items():
    _connect_model(_path, _name)


@receiver(user_logged_in)
def on_login(sender, request, user, **kwargs):
    _log(user=user, action='login', model_name='Utilisateur',
         obj_id=user.pk, obj_repr=str(user),
         description='Connexion',
         ip=request.META.get('REMOTE_ADDR'))


@receiver(user_logged_out)
def on_logout(sender, request, user, **kwargs):
    if user:
        _log(user=user, action='logout', model_name='Utilisateur',
             obj_id=user.pk, obj_repr=str(user),
             description='Déconnexion',
             ip=request.META.get('REMOTE_ADDR'))
