from rest_framework import serializers
from .models import Shift


class ShiftSerializer(serializers.ModelSerializer):
    position_display = serializers.CharField(source='get_position_display', read_only=True)
    user_name         = serializers.SerializerMethodField()
    hours             = serializers.FloatField(read_only=True)

    class Meta:
        model = Shift
        fields = [
            'id', 'user', 'user_name', 'date', 'start_time', 'end_time',
            'position', 'position_display', 'notes', 'hours', 'created_by', 'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def validate(self, attrs):
        start = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        end   = attrs.get('end_time', getattr(self.instance, 'end_time', None))
        if start is not None and end is not None and start == end:
            raise serializers.ValidationError("L'heure de début et de fin ne peuvent pas être identiques.")
        return attrs
