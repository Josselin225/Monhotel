from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .models import Booking

_prev_status: dict = {}


@receiver(pre_save, sender=Booking)
def _capture_prev_status(sender, instance, **kwargs):
    if instance.pk:
        try:
            _prev_status[instance.pk] = (
                Booking.objects.values_list('status', flat=True).get(pk=instance.pk)
            )
        except Booking.DoesNotExist:
            pass


@receiver(post_save, sender=Booking)
def _on_booking_saved(sender, instance, created, **kwargs):
    from .email_utils import send_booking_pending, send_booking_confirmation

    if created and instance.source == Booking.Source.ONLINE:
        try:
            send_booking_pending(instance)
        except Exception:
            pass
        return

    if not created:
        prev = _prev_status.pop(instance.pk, None)
        if prev != Booking.Status.CONFIRMED and instance.status == Booking.Status.CONFIRMED:
            try:
                send_booking_confirmation(instance)
            except Exception:
                pass
