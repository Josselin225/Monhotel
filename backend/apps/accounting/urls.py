from rest_framework.routers import DefaultRouter
from .views import TransactionViewSet, BudgetViewSet

router = DefaultRouter()
router.register('accounting/transactions', TransactionViewSet, basename='transaction')
router.register('accounting/budgets', BudgetViewSet, basename='budget')

urlpatterns = router.urls
