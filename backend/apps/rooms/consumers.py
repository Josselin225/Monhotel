import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError


def _group_for_hotel(hotel_id):
    return f'room_status_{hotel_id if hotel_id is not None else "none"}'


@database_sync_to_async
def _get_user_hotel_id(user_id):
    from apps.accounts.models import User
    return User.objects.filter(pk=user_id).values_list('hotel_id', flat=True).first()


class RoomStatusConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        token_str = self.scope.get('cookies', {}).get('access_token')
        if not token_str:
            await self.close(code=4001)
            return
        try:
            token = AccessToken(token_str)
        except TokenError:
            await self.close(code=4001)
            return

        # Un client ne doit recevoir que les mises à jour de son propre hôtel.
        hotel_id = await _get_user_hotel_id(token['user_id'])
        self.group = _group_for_hotel(hotel_id)

        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        group = getattr(self, 'group', None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        pass  # lecture seule — le client ne peut pas envoyer

    async def room_status_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'room_status_update',
            'room_id': event['room_id'],
            'room_number': event['room_number'],
            'status': event['status'],
        }))
