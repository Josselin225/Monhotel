from rest_framework import serializers
from .models import SiteContent


class SiteContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteContent
        fields = ['data', 'updated_at']
