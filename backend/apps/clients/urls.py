from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import ClientViewSet, ClientNoteListCreateView, ClientNoteDeleteView

router = DefaultRouter()
router.register('clients', ClientViewSet, basename='client')

urlpatterns = router.urls + [
    path('clients/<int:client_pk>/notes/', ClientNoteListCreateView.as_view(), name='client-notes'),
    path('clients/<int:client_pk>/notes/<int:pk>/', ClientNoteDeleteView.as_view(), name='client-note-delete'),
]
