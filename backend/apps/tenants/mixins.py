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

    def check_related_hotel(self, obj, field_name='related'):
        """À appeler depuis perform_create/perform_update quand la requête accepte une
        clé étrangère vers un objet lui-même rattaché à un hôtel (chambre, client,
        réservation, employé...). Le filtrage de get_queryset() et l'auto-assignation
        de `hotel` sur l'instance créée ne protègent PAS ce cas : sans cette vérification,
        un utilisateur peut référencer par son ID un objet appartenant à un AUTRE hôtel
        et se le faire silencieusement rattacher à ses propres données."""
        hotel = self.get_hotel()
        if hotel is not None and obj is not None and getattr(obj, 'hotel_id', None) != hotel.id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({field_name: 'Introuvable.'})
