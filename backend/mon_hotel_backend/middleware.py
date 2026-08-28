from urllib.parse import urlparse
from django.conf import settings
from django.http import JsonResponse

UNSAFE_METHODS = ('POST', 'PUT', 'PATCH', 'DELETE')


class CookieOriginCheckMiddleware:
    """
    Défense en profondeur contre le CSRF, en complément (pas en remplacement) du
    cookie JWT en `SameSite=Strict` : un navigateur mal configuré, une ancienne
    version de Safari, ou un webview embarqué peut ignorer `SameSite` — dans ce
    cas rien d'autre ne protège les requêtes qui modifient des données.

    Ne s'applique QUE quand une requête non sûre (POST/PUT/PATCH/DELETE) vers
    `/api/` est authentifiée via le cookie `access_token` (donc potentiellement
    déclenchable par un site tiers via le navigateur de la victime) : l'en-tête
    `Origin` (ou `Referer` en repli) doit alors correspondre à un domaine autorisé.
    Les requêtes sans cookie (API tierces, tests via curl/Postman, endpoints
    publics `AllowAny`) ne sont pas concernées — elles n'ont pas de session de
    navigateur à détourner.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.allowed_origins = set(getattr(settings, 'CORS_ALLOWED_ORIGINS', []) or [])

    def __call__(self, request):
        if (
            request.method in UNSAFE_METHODS
            and request.path.startswith('/api/')
            and request.COOKIES.get('access_token')
        ):
            origin = request.META.get('HTTP_ORIGIN')
            if not origin:
                referer = request.META.get('HTTP_REFERER')
                if referer:
                    parsed = urlparse(referer)
                    origin = f'{parsed.scheme}://{parsed.netloc}' if parsed.scheme else None
            if not origin or origin not in self.allowed_origins:
                return JsonResponse(
                    {'detail': "Origine de la requête non autorisée."},
                    status=403,
                )
        return self.get_response(request)
