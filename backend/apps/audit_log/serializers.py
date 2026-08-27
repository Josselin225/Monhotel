from rest_framework import serializers
from .models import AuditEntry


class AuditEntrySerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    username       = serializers.SerializerMethodField()

    class Meta:
        model  = AuditEntry
        fields = ['id', 'user', 'username', 'action', 'action_display', 'model_name',
                  'object_id', 'object_repr', 'description', 'ip_address', 'changes', 'created_at']
        read_only_fields = fields

    def get_username(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.email or obj.user.username
        return 'Système'
