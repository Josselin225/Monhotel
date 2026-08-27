from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver


@receiver(pre_save, sender='rooms.Room')
def track_room_status(sender, instance, **kwargs):
    if not instance.pk:
        instance._old_status = None
        return
    try:
        instance._old_status = sender.objects.values_list('status', flat=True).get(pk=instance.pk)
    except sender.DoesNotExist:
        instance._old_status = None


@receiver(post_save, sender='rooms.Room')
def broadcast_room_status(sender, instance, created, **kwargs):
    if created:
        return
    old = getattr(instance, '_old_status', None)
    if old is None or old == instance.status:
        return
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from .consumers import _group_for_hotel
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            _group_for_hotel(instance.hotel_id),
            {
                'type': 'room_status_update',
                'room_id': instance.id,
                'room_number': instance.number,
                'status': instance.status,
            },
        )
    except Exception:
        pass
