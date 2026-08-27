from rest_framework.routers import DefaultRouter
from .views import CleaningTaskViewSet

router = DefaultRouter()
router.register('housekeeping', CleaningTaskViewSet, basename='housekeeping')

urlpatterns = router.urls
