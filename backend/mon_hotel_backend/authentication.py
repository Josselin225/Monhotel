from rest_framework_simplejwt.authentication import JWTAuthentication


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
        except Exception:
            return None
