from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import BookingViewSet
from .public_views import (
    PublicAvailableRoomsView, PublicBookingCreateView, PublicAvailabilityCalendarView,
    MyBookingLookupView, MyBookingUpdateView, MyBookingCancelView, MyBookingInvoiceView,
)

router = DefaultRouter()
router.register('bookings', BookingViewSet, basename='booking')

urlpatterns = router.urls + [
    path('public/available-rooms/', PublicAvailableRoomsView.as_view(), name='public-available-rooms'),
    path('public/book/', PublicBookingCreateView.as_view(), name='public-book'),
    path('public/calendar/', PublicAvailabilityCalendarView.as_view(), name='public-calendar'),
    path('public/my-booking/', MyBookingLookupView.as_view(), name='my-booking-lookup'),
    path('public/my-booking/<str:reference>/', MyBookingUpdateView.as_view(), name='my-booking-update'),
    path('public/my-booking/<str:reference>/cancel/', MyBookingCancelView.as_view(), name='my-booking-cancel'),
    path('public/my-booking/<str:reference>/invoice/', MyBookingInvoiceView.as_view(), name='my-booking-invoice'),
]
