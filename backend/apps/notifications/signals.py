from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver


def _get_old_status(instance):
    """Retourne l'ancien statut de l'instance (None si création)."""
    if not instance.pk:
        return None
    try:
        return instance.__class__.objects.filter(pk=instance.pk).values_list('status', flat=True).first()
    except Exception:
        return None


@receiver(pre_save, sender='billing.Invoice')
def track_invoice_status(sender, instance, **kwargs):
    instance._old_status = _get_old_status(instance)


@receiver(post_save, sender='billing.Invoice')
def on_invoice_issued(sender, instance, created, **kwargs):
    """Envoie la facture uniquement à la transition → 'issued'."""
    old = getattr(instance, '_old_status', None)
    if instance.status == 'issued' and old != 'issued':
        from .emails import send_invoice
        send_invoice(instance)


@receiver(post_save, sender='bookings.Booking')
def on_new_booking(sender, instance, created, **kwargs):
    """Alerte staff à chaque nouvelle réservation créée."""
    if created:
        from .emails import send_new_booking_alert
        send_new_booking_alert(instance)


@receiver(post_save, sender='maintenance.MaintenanceTicket')
def on_urgent_ticket(sender, instance, created, **kwargs):
    """Alerte staff sur création d'un ticket haute priorité ou urgent."""
    if created and instance.priority in ('high', 'urgent'):
        from .emails import send_maintenance_alert
        send_maintenance_alert(instance)
