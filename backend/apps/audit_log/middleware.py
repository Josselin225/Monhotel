"""Rend l'utilisateur et l'IP de la requête en cours disponibles depuis les
signaux post_save/post_delete (qui n'ont pas accès à la requête HTTP).

DRF synchronise `request.user` sur la requête Django sous-jacente dès que
l'authentification a lieu (au tout début du traitement de la vue) — comme on
garde ici une référence à l'objet requête (pas une copie), le lire plus tard
dans un signal déclenché pendant la vue reflète bien l'utilisateur authentifié.
"""
import threading

_local = threading.local()


class AuditContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _local.request = request
        try:
            return self.get_response(request)
        finally:
            _local.request = None


def get_current_user():
    request = getattr(_local, 'request', None)
    if request is None:
        return None
    user = getattr(request, 'user', None)
    if user is not None and getattr(user, 'is_authenticated', False):
        return user
    return None


def get_current_ip():
    request = getattr(_local, 'request', None)
    if request is None:
        return None
    return request.META.get('REMOTE_ADDR')
