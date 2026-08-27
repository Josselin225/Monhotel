from rest_framework.routers import DefaultRouter
from .views import AuditEntryViewSet

router = DefaultRouter()
router.register('audit-log', AuditEntryViewSet, basename='audit-entry')

urlpatterns = router.urls
