import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
import apps.rooms.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mon_hotel_backend.settings')

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': URLRouter(apps.rooms.routing.websocket_urlpatterns),
})
