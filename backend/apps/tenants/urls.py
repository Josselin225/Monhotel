from django.urls import path
from .views import HotelRegisterView, CurrentHotelView, HotelListView, HotelDetailView

urlpatterns = [
    path('hotels/',          HotelListView.as_view(),    name='hotel-list'),
    path('hotels/me/',       CurrentHotelView.as_view(), name='hotel-me'),
    path('hotels/register/', HotelRegisterView.as_view(), name='hotel-register'),
    path('hotels/<int:pk>/', HotelDetailView.as_view(),  name='hotel-detail'),
]
