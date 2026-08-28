import base64
import re
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from .models import SiteContent
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


def _check_video_magic(file) -> bool:
    """Vérifie les octets magiques : accepte MP4/MOV, WebM/MKV et Ogg."""
    header = file.read(12)
    file.seek(0)
    if header[4:8] == b'ftyp':                return True   # MP4 / MOV
    if header[:4] == b'\x1a\x45\xdf\xa3':      return True   # WebM / MKV
    if header[:4] == b'OggS':                  return True   # Ogg
    return False


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


class ContentVideoUploadView(APIView):
    """Upload de la vidéo de présentation — stockée hors de `data` (voir SiteContent)."""
    permission_classes = [IsAdminOrManager]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('video')
        if not file:
            return Response({'error': 'Aucun fichier fourni.'}, status=400)
        if not file.content_type.startswith('video/'):
            return Response({'error': 'Le fichier doit être une vidéo.'}, status=400)
        if file.size > 50 * 1024 * 1024:
            return Response({'error': 'Taille maximale : 50 Mo.'}, status=400)
        if not _check_video_magic(file):
            return Response({'error': 'Format non autorisé. Utilisez MP4, WebM ou Ogg.'}, status=400)

        obj = SiteContent.get_content()
        obj.video_file = file.read()
        obj.video_content_type = file.content_type
        obj.save(update_fields=['video_file', 'video_content_type'])
        video_url = f"/api/content/video-file/?v={obj.updated_at.timestamp():.0f}"
        return Response({'video_url': video_url})

    def delete(self, request):
        obj = SiteContent.get_content()
        obj.video_file = None
        obj.video_content_type = ''
        obj.save(update_fields=['video_file', 'video_content_type'])
        return Response({'video_url': ''})


class ContentVideoFileView(APIView):
    """Sert la vidéo uploadée, avec support des requêtes Range (nécessaire pour
    que la lecture/le défilement fonctionnent dans la balise <video> du navigateur)."""
    permission_classes = [AllowAny]

    def get(self, request):
        obj = SiteContent.get_content()
        data = bytes(obj.video_file) if obj.video_file else b''
        if not data:
            return Response(status=404)
        content_type = obj.video_content_type or 'video/mp4'
        total = len(data)

        range_header = request.META.get('HTTP_RANGE', '')
        match = re.match(r'bytes=(\d+)-(\d*)', range_header)
        if match:
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else total - 1
            end = min(end, total - 1)
            chunk = data[start:end + 1]
            response = HttpResponse(chunk, status=206, content_type=content_type)
            response['Content-Range'] = f'bytes {start}-{end}/{total}'
            response['Content-Length'] = str(len(chunk))
        else:
            response = HttpResponse(data, content_type=content_type)
            response['Content-Length'] = str(total)
        response['Accept-Ranges'] = 'bytes'
        return response
