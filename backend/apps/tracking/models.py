from django.db import models


class SiteVisit(models.Model):
    timestamp   = models.DateTimeField(auto_now_add=True, db_index=True)
    path        = models.CharField(max_length=500)
    session_key = models.CharField(max_length=64, blank=True)
    referrer    = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ['-timestamp']
