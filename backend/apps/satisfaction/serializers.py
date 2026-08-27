from rest_framework import serializers
from .models import SatisfactionSurvey


class SatisfactionSurveySerializer(serializers.ModelSerializer):
    is_submitted  = serializers.BooleanField(read_only=True)
    average_score = serializers.FloatField(read_only=True, allow_null=True)
    booking_ref   = serializers.CharField(source='booking.reference', read_only=True)
    client_name   = serializers.CharField(source='booking.client.full_name', read_only=True)

    class Meta:
        model  = SatisfactionSurvey
        fields = '__all__'
        read_only_fields = ['token', 'booking', 'created_at', 'reminder_sent_at']


class SurveySubmitSerializer(serializers.ModelSerializer):
    """Soumission publique via token — champs limités."""
    class Meta:
        model  = SatisfactionSurvey
        fields = [
            'score_overall', 'score_cleanliness', 'score_service',
            'score_comfort', 'score_value', 'comment', 'would_return',
        ]

    def validate(self, data):
        if not data.get('score_overall'):
            raise serializers.ValidationError({'score_overall': 'La note globale est requise.'})
        for field in ['score_overall', 'score_cleanliness', 'score_service', 'score_comfort', 'score_value']:
            v = data.get(field)
            if v is not None and not (1 <= v <= 5):
                raise serializers.ValidationError({field: 'Le score doit être compris entre 1 et 5.'})
        return data
