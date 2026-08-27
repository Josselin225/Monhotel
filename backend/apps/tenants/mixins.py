"""
HotelScopeMixin — à ajouter à chaque ViewSet pour isoler les données par hôtel.

Usage:
    class RoomViewSet(HotelScopeMixin, viewsets.ModelViewSet):
        queryset = Room.objects.select_related('room_type')
        ...
"""


class HotelScopeMixin:
    """Filtre automatiquement tous les querysets par l'hôtel de l'utilisateur connecté."""

    def get_hotel(self):
        return getattr(self.request.user, 'hotel', None)

    def get_queryset(self):
        qs    = super().get_queryset()
        hotel = self.get_hotel()
        if hotel is not None:
            qs = qs.filter(hotel=hotel)
        return qs

    def perform_create(self, serializer):
        hotel = self.get_hotel()
        if hotel is not None:
            serializer.save(hotel=hotel)
        else:
            serializer.save()
