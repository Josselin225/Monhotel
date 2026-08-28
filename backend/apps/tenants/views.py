from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from mon_hotel_backend.throttles import HotelRegisterThrottle
from .models import Hotel
from .serializers import HotelSerializer, HotelCreateSerializer, HotelSelfServiceSerializer


class HotelRegisterView(generics.CreateAPIView):
    """
    POST /api/hotels/register/
    Crée un nouvel hôtel et son premier compte admin.
    Accessible sans authentification (onboarding).
    """
    serializer_class   = HotelCreateSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [HotelRegisterThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        hotel = serializer.save()
        return Response(
            HotelSerializer(hotel).data,
            status=status.HTTP_201_CREATED,
        )


class CurrentHotelView(APIView):
    """
    GET  /api/hotels/me/       → Retourne les infos de l'hôtel connecté
    PATCH /api/hotels/me/      → Met à jour les infos de l'hôtel (admin seulement)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_hotel(self, request):
        hotel = getattr(request.user, 'hotel', None)
        if not hotel:
            return None
        return hotel

    def get(self, request):
        hotel = self.get_hotel(request)
        if not hotel:
            return Response({'detail': 'Aucun hôtel associé.'}, status=404)
        return Response(HotelSerializer(hotel).data)

    def patch(self, request):
        if request.user.role != 'admin':
            return Response({'detail': 'Réservé aux administrateurs.'}, status=403)
        hotel = self.get_hotel(request)
        if not hotel:
            return Response({'detail': 'Aucun hôtel associé.'}, status=404)
        serializer = HotelSelfServiceSerializer(hotel, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(HotelSerializer(hotel).data)


class IsPlatformSuperuser(permissions.BasePermission):
    """Vrai superadmin plateforme uniquement (créé via createsuperuser) —
    distinct du rôle métier 'admin' d'un hôtel, qui ne doit jamais voir
    la liste des autres hôtels clients."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class HotelListView(generics.ListAPIView):
    """
    GET /api/hotels/  — Superadmin plateforme uniquement : liste tous les hôtels.
    """
    serializer_class   = HotelSerializer
    permission_classes = [IsPlatformSuperuser]
    queryset           = Hotel.objects.all().order_by('-created_at')


class HotelDetailView(generics.RetrieveUpdateAPIView):
    """
    GET/PATCH /api/hotels/<id>/  — Superadmin plateforme uniquement :
    gestion de l'abonnement (plan, statut, essai) d'un hôtel client.
    """
    serializer_class   = HotelSerializer
    permission_classes = [IsPlatformSuperuser]
    queryset           = Hotel.objects.all()
