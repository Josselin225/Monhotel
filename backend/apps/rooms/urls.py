from rest_framework.routers import DefaultRouter
from .views import RoomViewSet, RoomTypeViewSet, PricingRuleViewSet

router = DefaultRouter()
router.register('room-types', RoomTypeViewSet, basename='room-type')
router.register('rooms', RoomViewSet, basename='room')
router.register('pricing-rules', PricingRuleViewSet, basename='pricing-rule')

urlpatterns = router.urls
