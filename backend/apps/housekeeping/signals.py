from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver


def _ensure_task(room, priority='normal'):
    """Crée une tâche pending si aucune tâche active n'existe pour cette chambre."""
    from .models import CleaningTask
    exists = CleaningTask.objects.filter(
        room=room,
        status__in=['pending', 'in_progress'],
    ).exists()
    if not exists:
        CleaningTask.objects.create(
            room=room,
            status=CleaningTask.Status.PENDING,
            priority=priority,
            notes='Créée automatiquement via changement de statut de chambre.',
        )


@receiver(pre_save, sender='rooms.Room')
def track_old_status(sender, instance, **kwargs):
    """Mémorise l'ancien statut avant la sauvegarde."""
    if instance.pk:
        try:
            instance._old_status = sender.objects.get(pk=instance.pk).status
        except sender.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None


@receiver(post_save, sender='rooms.Room')
def create_task_on_status_change(sender, instance, created, **kwargs):
    """Génère automatiquement une tâche quand une chambre passe en nettoyage/maintenance."""
    old = getattr(instance, '_old_status', None)
    new = instance.status

    if new == 'cleaning' and old != 'cleaning':
        _ensure_task(instance, priority='normal')
    elif new == 'maintenance' and old != 'maintenance':
        _ensure_task(instance, priority='urgent')
