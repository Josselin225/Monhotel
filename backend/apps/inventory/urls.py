from rest_framework.routers import DefaultRouter
from .views import InventoryCategoryViewSet, InventoryItemViewSet, InventoryMovementViewSet

router = DefaultRouter()
router.register('inventory/categories', InventoryCategoryViewSet, basename='inventory-category')
router.register('inventory/items', InventoryItemViewSet, basename='inventory-item')
router.register('inventory/movements', InventoryMovementViewSet, basename='inventory-movement')

urlpatterns = router.urls
