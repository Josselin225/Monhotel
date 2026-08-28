from django.urls import path
from .views import (
    SiteContentView, LogoUploadView, ContentImageUploadView,
    ContentVideoUploadView, ContentVideoFileView,
)

urlpatterns = [
    path('content/', SiteContentView.as_view(), name='site-content'),
    path('content/logo/', LogoUploadView.as_view(), name='logo-upload'),
    path('content/image/', ContentImageUploadView.as_view(), name='content-image-upload'),
    path('content/video/', ContentVideoUploadView.as_view(), name='content-video-upload'),
    path('content/video-file/', ContentVideoFileView.as_view(), name='content-video-file'),
]
