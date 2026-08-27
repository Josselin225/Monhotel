from django.conf import settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from mon_hotel_backend.throttles import LoginRateThrottle
from apps.accounts.serializers import UserSerializer
from apps.accounts import twofactor

# Verrouillage par compte (en plus du throttling par IP) : bloque un compte
# précis après plusieurs échecs, quelle que soit l'IP d'origine (protège
# contre un bruteforce distribué sur beaucoup d'IPs différentes).
MAX_FAILED_LOGIN_ATTEMPTS = 5
LOGIN_FAILURE_WINDOW = 15 * 60   # fenêtre de comptage des échecs (secondes)
LOGIN_LOCKOUT_DURATION = 15 * 60  # durée du verrouillage (secondes)


def _cookie_kwargs(max_age: int) -> dict:
    return dict(
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Strict',
        max_age=max_age,
        path='/',
    )


class CookieLoginView(TokenObtainPairView):
    """Connexion : pose les tokens JWT en cookies HttpOnly."""
    throttle_classes = [LoginRateThrottle]
    permission_classes = [AllowAny]

    def _register_failure(self, username):
        if not username:
            return
        fail_key = f'login_fail_{username}'
        attempts = cache.get(fail_key, 0) + 1
        cache.set(fail_key, attempts, LOGIN_FAILURE_WINDOW)
        if attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            cache.set(f'login_lockout_{username}', True, LOGIN_LOCKOUT_DURATION)
            cache.delete(fail_key)

    def post(self, request, *args, **kwargs):
        username = str(request.data.get('username') or '').strip().lower()

        if username and cache.get(f'login_lockout_{username}'):
            return Response(
                {'detail': 'Trop de tentatives échouées pour ce compte. Réessayez dans quelques minutes.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            self._register_failure(username)
            raise InvalidToken(e.args[0])
        except Exception:
            self._register_failure(username)
            raise

        user = serializer.user

        # Abonnement hôtel suspendu par la plateforme (gestion des abonnements) :
        # bloque la connexion de tout le personnel de cet hôtel, sans supprimer
        # ni modifier leurs comptes.
        if user.hotel_id and not user.hotel.is_active:
            return Response(
                {'detail': "Ce compte hôtel est suspendu. Contactez le support pour plus d'informations."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── Deuxième facteur (TOTP ou code de secours) ──
        if user.two_factor_enabled:
            otp_code    = str(request.data.get('otp_code') or '').strip()
            backup_code = str(request.data.get('backup_code') or '').strip()

            if not otp_code and not backup_code:
                # Identifiants corrects mais 2FA pas encore fournie : ne pas
                # poser de cookies, indiquer au frontend d'afficher l'étape 2.
                return Response({'two_factor_required': True, 'detail': 'Code de vérification requis.'})

            valid = False
            if otp_code and twofactor.verify_totp(user.two_factor_secret, otp_code):
                valid = True
            elif backup_code:
                remaining = twofactor.consume_backup_code(user.two_factor_backup_codes, backup_code)
                if remaining is not None:
                    user.two_factor_backup_codes = remaining
                    user.save(update_fields=['two_factor_backup_codes'])
                    valid = True

            if not valid:
                self._register_failure(username)
                return Response({'detail': 'Code de vérification invalide.'}, status=status.HTTP_401_UNAUTHORIZED)

        if username:
            cache.delete(f'login_fail_{username}')
            cache.delete(f'login_lockout_{username}')

        access  = serializer.validated_data['access']
        refresh = serializer.validated_data['refresh']
        try:
            from apps.audit_log.signals import _log
            _log(
                user=user, action='login', model_name='Utilisateur',
                obj_id=user.pk, obj_repr=str(user),
                description='Connexion',
                ip=request.META.get('REMOTE_ADDR'),
            )
        except Exception:
            pass

        response = Response(UserSerializer(user).data)
        response.set_cookie('access_token',  access,  **_cookie_kwargs(15 * 60))
        response.set_cookie('refresh_token', refresh, **_cookie_kwargs(3 * 24 * 3600))
        return response


class CookieRefreshView(APIView):
    """Rafraîchit l'access token depuis le cookie refresh_token."""
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get('refresh_token')
        if not raw:
            return Response({'detail': 'Non authentifié.'}, status=401)

        serializer = TokenRefreshSerializer(data={'refresh': raw})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            response = Response({'detail': 'Session expirée, veuillez vous reconnecter.'}, status=401)
            response.delete_cookie('access_token')
            response.delete_cookie('refresh_token')
            return response

        access      = serializer.validated_data['access']
        new_refresh = serializer.validated_data.get('refresh')

        response = Response({'detail': 'Token rafraîchi.'})
        response.set_cookie('access_token', access, **_cookie_kwargs(15 * 60))
        if new_refresh:
            response.set_cookie('refresh_token', new_refresh, **_cookie_kwargs(3 * 24 * 3600))
        return response


class CookieLogoutView(APIView):
    """Déconnexion : blacklist le refresh token et supprime les cookies."""

    def post(self, request):
        raw = request.COOKIES.get('refresh_token')
        if raw:
            try:
                from apps.accounts.models import User
                from apps.audit_log.signals import _log
                token = RefreshToken(raw)
                uid = token.get('user_id')
                user = User.objects.filter(pk=uid).first()
                token.blacklist()
                _log(
                    user=user, action='logout', model_name='Utilisateur',
                    obj_id=uid, obj_repr=str(user) if user else '',
                    description='Déconnexion',
                    ip=request.META.get('REMOTE_ADDR'),
                )
            except Exception:
                pass

        response = Response({'detail': 'Déconnexion réussie.'})
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response
