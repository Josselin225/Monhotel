from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from mon_hotel_backend.cookie_views import CookieLoginView, CookieRefreshView, CookieLogoutView


urlpatterns = [
    path('', RedirectView.as_view(url='/api/docs/', permanent=False)),
    path('admin/', admin.site.urls),
    # Auth JWT (cookie-based)
    path('api/auth/login/', CookieLoginView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', CookieRefreshView.as_view(), name='token_refresh'),
    path('api/auth/logout/', CookieLogoutView.as_view(), name='token_blacklist'),
    # Apps
    path('api/', include('apps.tenants.urls')),
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.rooms.urls')),
    path('api/', include('apps.clients.urls')),
    path('api/', include('apps.bookings.urls')),
    path('api/', include('apps.billing.urls')),
    path('api/', include('apps.content.urls')),
    path('api/', include('apps.housekeeping.urls')),
    path('api/', include('apps.satisfaction.urls')),
    path('api/', include('apps.accounting.urls')),
    path('api/', include('apps.maintenance.urls')),
    path('api/', include('apps.audit_log.urls')),
    path('api/', include('apps.reports.urls')),
    path('api/', include('apps.tracking.urls')),
    path('api/', include('apps.inventory.urls')),
    path('api/', include('apps.scheduling.urls')),
    # API Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
