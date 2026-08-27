import base64
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import User
from .serializers import UserSerializer, MeSerializer, UserCreateSerializer, UserUpdateSerializer, ChangePasswordSerializer
from .permissions import IsAdmin
from . import twofactor
from apps.tenants.mixins import HotelScopeMixin


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        # Fichier image → conversion base64 en mémoire, stockage en DB
        avatar_file = request.FILES.get('avatar')
        if avatar_file is not None:
            if not avatar_file.content_type.startswith('image/'):
                return Response({'detail': 'Le fichier doit être une image.'}, status=status.HTTP_400_BAD_REQUEST)
            if avatar_file.size > 5 * 1024 * 1024:
                return Response({'detail': 'Taille maximale : 5 Mo.'}, status=status.HTTP_400_BAD_REQUEST)
            # Vérification des octets magiques (rejette SVG et autres formats non-image)
            header = avatar_file.read(12); avatar_file.seek(0)
            is_valid = (
                header[:8] == b'\x89PNG\r\n\x1a\n' or
                header[:3] == b'\xff\xd8\xff' or
                (header[:4] == b'RIFF' and header[8:12] == b'WEBP') or
                header[:6] in (b'GIF87a', b'GIF89a')
            )
            if not is_valid:
                return Response({'detail': 'Format non autorisé. Utilisez PNG, JPEG, WebP ou GIF.'}, status=status.HTTP_400_BAD_REQUEST)
            content = avatar_file.read()
            b64 = base64.b64encode(content).decode()
            request.user.avatar = f'data:{avatar_file.content_type};base64,{b64}'
            request.user.save(update_fields=['avatar'])
            return Response(MeSerializer(request.user).data)

        # Suppression de l'avatar
        if 'avatar' in request.data and not request.data['avatar']:
            request.user.avatar = ''
            request.user.save(update_fields=['avatar'])
            return Response(MeSerializer(request.user).data)

        # role/is_active/username sont en lecture seule sur ce serializer :
        # un utilisateur ne peut jamais s'auto-promouvoir ni se réactiver lui-même.
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'detail': 'Ancien mot de passe incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
        new_password = serializer.validated_data['new_password']
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            raise ValidationError({'new_password': list(exc.messages)})
        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Mot de passe modifié avec succès.'})


class UserListCreateView(HotelScopeMixin, generics.ListCreateAPIView):
    """Liste et création d'utilisateurs — admin uniquement (cloisonné par hôtel)."""
    queryset = User.objects.all().order_by('role', 'username')
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer


class UserDetailView(HotelScopeMixin, generics.RetrieveUpdateDestroyAPIView):
    """Détail, mise à jour et suppression — admin uniquement (cloisonné par hôtel)."""
    queryset = User.objects.all()
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserUpdateSerializer
        return UserSerializer

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response({'detail': 'Vous ne pouvez pas supprimer votre propre compte.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)


class TwoFactorSetupView(APIView):
    """POST /api/auth/2fa/setup/ — génère un secret TOTP + QR code (pas encore activé)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.two_factor_enabled:
            return Response({'detail': 'La double authentification est déjà activée.'}, status=status.HTTP_400_BAD_REQUEST)
        secret = twofactor.generate_secret()
        user.two_factor_secret = secret
        user.save(update_fields=['two_factor_secret'])
        uri = twofactor.otpauth_uri(secret, user.username)
        return Response({
            'secret': secret,
            'qr_code': twofactor.qr_data_uri(uri),
        })


class TwoFactorConfirmView(APIView):
    """POST /api/auth/2fa/confirm/ — vérifie le premier code et active la 2FA."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.two_factor_enabled:
            return Response({'detail': 'La double authentification est déjà activée.'}, status=status.HTTP_400_BAD_REQUEST)
        if not user.two_factor_secret:
            return Response({'detail': "Aucune configuration en cours. Relancez l'activation."}, status=status.HTTP_400_BAD_REQUEST)
        code = request.data.get('code', '')
        if not twofactor.verify_totp(user.two_factor_secret, code):
            return Response({'detail': 'Code invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        plain_codes, hashed_codes = twofactor.generate_backup_codes()
        user.two_factor_enabled = True
        user.two_factor_backup_codes = hashed_codes
        user.save(update_fields=['two_factor_enabled', 'two_factor_backup_codes'])
        return Response({
            'detail': 'Double authentification activée.',
            'backup_codes': plain_codes,
        })


class TwoFactorDisableView(APIView):
    """POST /api/auth/2fa/disable/ — désactive la 2FA (mot de passe requis)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        password = request.data.get('password', '')
        if not user.check_password(password):
            return Response({'detail': 'Mot de passe incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
        user.two_factor_enabled = False
        user.two_factor_secret = ''
        user.two_factor_backup_codes = []
        user.save(update_fields=['two_factor_enabled', 'two_factor_secret', 'two_factor_backup_codes'])
        return Response({'detail': 'Double authentification désactivée.'})


class LoginHistoryView(generics.ListAPIView):
    """GET /api/auth/login-history/ — historique des connexions du compte courant."""
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        from apps.audit_log.models import AuditEntry
        from apps.audit_log.serializers import AuditEntrySerializer
        qs = AuditEntry.objects.filter(
            user=request.user, action__in=['login', 'logout'],
        ).order_by('-created_at')[:50]
        return Response(AuditEntrySerializer(qs, many=True).data)
