from django.urls import path
from .views import (
    MeView, ChangePasswordView, UserListCreateView, UserDetailView,
    TwoFactorSetupView, TwoFactorConfirmView, TwoFactorDisableView, LoginHistoryView,
)

urlpatterns = [
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('auth/2fa/setup/', TwoFactorSetupView.as_view(), name='2fa-setup'),
    path('auth/2fa/confirm/', TwoFactorConfirmView.as_view(), name='2fa-confirm'),
    path('auth/2fa/disable/', TwoFactorDisableView.as_view(), name='2fa-disable'),
    path('auth/login-history/', LoginHistoryView.as_view(), name='login-history'),
    path('users/', UserListCreateView.as_view(), name='user-list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
]
