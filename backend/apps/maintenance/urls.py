from rest_framework.routers import DefaultRouter
from .views import MaintenanceTicketViewSet, TechnicianViewSet

router = DefaultRouter()
router.register('maintenance/tickets',    MaintenanceTicketViewSet, basename='ticket')
router.register('maintenance/technicians', TechnicianViewSet,       basename='technician')

urlpatterns = router.urls
