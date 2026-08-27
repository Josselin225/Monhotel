from django.urls import path
from .views import MonthlyReportView, FullReportView

urlpatterns = [
    path('reports/monthly/', MonthlyReportView.as_view(), name='monthly-report'),
    path('reports/full/',    FullReportView.as_view(),    name='full-report'),
]
