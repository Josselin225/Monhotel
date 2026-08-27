from rest_framework.routers import DefaultRouter
from .views import SatisfactionSurveyViewSet

router = DefaultRouter()
router.register('surveys', SatisfactionSurveyViewSet, basename='survey')

urlpatterns = router.urls
