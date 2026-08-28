import logging
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

logger = logging.getLogger(__name__)


class CookieJWTAuthentication(JWTAuthentication):
    """
    Lit le JWT depuis le cookie HttpOnly 'access_token'.
    Se replie sur l'en-tête Authorization: Bearer pour les clients API tiers.
    """
    def authenticate(self, request):
        raw_token = request.COOKIES.get('access_token')
        if raw_token is None:
            return super().authenticate(request)
        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except (TokenError, InvalidToken):
            # Cas normal (token expiré/malformé) — pas authentifié, rien d'anormal à tracer.
            return None
        except Exception:
            # Échec inattendu (pas une simple expiration) — on le trace pour garder une
            # visibilité sur d'éventuelles tentatives de falsification du token, tout en
            # renvoyant quand même "non authentifié" plutôt qu'une 500 au client.
            logger.warning('Échec inattendu de la validation du token JWT', exc_info=True)
            return None
