import base64
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from .models import SiteContent
from .serializers import SiteContentSerializer
from apps.accounts.permissions import IsAdminOrManager


def _check_magic(file) -> bool:
    """Vérifie les octets magiques : accepte PNG, JPEG, WebP, GIF. Rejette SVG et tout autre format."""
    header = file.read(12)
    file.seek(0)
    if header[:8] == b'\x89PNG\r\n\x1a\n':           return True   # PNG
    if header[:3] == b'\xff\xd8\xff':                 return True   # JPEG
    if header[:4] == b'RIFF' and header[8:12] == b'WEBP': return True  # WebP
    if header[:6] in (b'GIF87a', b'GIF89a'):          return True   # GIF
    return False


def _file_to_b64(file):
    content = file.read()
    b64 = base64.b64encode(content).decode()
    return f'data:{file.content_type};base64,{b64}'


class SiteContentView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminOrManager()]

    def get(self, request):
        obj = SiteContent.get_content()
        return Response(obj.data)

    def put(self, request):
        obj = SiteContent.get_content()
        for key, value in request.data.items():
            # Fusion superficielle pour les sections de type objet (ex: "hotel") :
            # un appelant qui n'envoie qu'un sous-ensemble de champs ne doit pas
            # effacer les autres champs déjà enregistrés dans cette section.
            existing = obj.data.get(key)
            if isinstance(existing, dict) and isinstance(value, dict):
                obj.data[key] = {**existing, **value}
            else:
                obj.data[key] = value
        obj.save()
        return Response(obj.data)


class LogoUploadView(APIView):
    permission_classes = [IsAdminOrManager]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('logo')
        if not file:
            return Response({'error': 'Aucun fichier fourni.'}, status=400)
        if not file.content_type.startswith('image/'):
            return Response({'error': 'Le fichier doit être une image.'}, status=400)
        if file.size > 2 * 1024 * 1024:
            return Response({'error': 'Taille maximale : 2 Mo.'}, status=400)
        if not _check_magic(file):
            return Response({'error': 'Format non autorisé. Utilisez PNG, JPEG, WebP ou GIF.'}, status=400)

        logo_url = _file_to_b64(file)
        obj = SiteContent.get_content()
        obj.data.setdefault('hotel', {})
        obj.data['hotel']['logo_url'] = logo_url
        obj.save()
        return Response({'logo_url': logo_url})

    def delete(self, request):
        obj = SiteContent.get_content()
        obj.data.setdefault('hotel', {})
        obj.data['hotel']['logo_url'] = ''
        obj.save()
        return Response({'logo_url': ''})


class ContentImageUploadView(APIView):
    permission_classes = [IsAdminOrManager]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('image')
        if not file:
            return Response({'error': 'Aucun fichier fourni.'}, status=400)
        if not file.content_type.startswith('image/'):
            return Response({'error': 'Le fichier doit être une image.'}, status=400)
        if file.size > 5 * 1024 * 1024:
            return Response({'error': 'Taille maximale : 5 Mo.'}, status=400)
        if not _check_magic(file):
            return Response({'error': 'Format non autorisé. Utilisez PNG, JPEG, WebP ou GIF.'}, status=400)

        image_url = _file_to_b64(file)
        return Response({'image_url': image_url})
