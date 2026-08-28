from rest_framework.routers import DefaultRouter
from .views import AmenityReservationViewSet, MenuItemViewSet

router = DefaultRouter()
router.register('amenity-reservations', AmenityReservationViewSet, basename='amenity-reservation')
router.register('menu-items', MenuItemViewSet, basename='menu-item')

urlpatterns = router.urls
