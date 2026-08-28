from rest_framework.routers import DefaultRouter
from .views import RfidCardViewSet

router = DefaultRouter()
router.register('rfid/cards', RfidCardViewSet, basename='rfid-card')

urlpatterns = router.urls
