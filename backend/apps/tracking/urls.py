from django.urls import path
from . import views

urlpatterns = [
    path('visits/track/', views.track, name='visit-track'),
    path('visits/stats/', views.stats, name='visit-stats'),
]
