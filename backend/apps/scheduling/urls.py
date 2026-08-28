from rest_framework.routers import DefaultRouter
from .views import ShiftViewSet, EmployeeViewSet

router = DefaultRouter()
router.register('employees', EmployeeViewSet, basename='employee')
router.register('shifts', ShiftViewSet, basename='shift')

urlpatterns = router.urls
