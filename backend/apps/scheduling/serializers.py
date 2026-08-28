from rest_framework import serializers
from .models import Shift, Employee


class EmployeeSerializer(serializers.ModelSerializer):
    position_display = serializers.CharField(source='get_position_display', read_only=True)
    # Alimenté par l'annotation Count('shifts') du queryset (évite un N+1 par employé) ;
    # `default=0` couvre l'instance fraîchement créée (hors queryset annoté).
    shifts_count      = serializers.IntegerField(read_only=True, default=0)
    user_username     = serializers.CharField(source='user.username', read_only=True, default=None)

    class Meta:
        model = Employee
        fields = [
            'id', 'name', 'position', 'position_display', 'phone', 'email', 'notes',
            'is_active', 'user', 'user_username', 'shifts_count', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {'phone': {'required': True, 'allow_blank': False}}

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Le nom est requis.')
        return value


class ShiftSerializer(serializers.ModelSerializer):
    position_display = serializers.CharField(source='get_position_display', read_only=True)
    employee_name     = serializers.CharField(source='employee.name', read_only=True)
    hours             = serializers.FloatField(read_only=True)

    class Meta:
        model = Shift
        fields = [
            'id', 'employee', 'employee_name', 'date', 'start_time', 'end_time',
            'position', 'position_display', 'notes', 'hours', 'created_by', 'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def validate(self, attrs):
        start = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        end   = attrs.get('end_time', getattr(self.instance, 'end_time', None))
        if start is not None and end is not None and start == end:
            raise serializers.ValidationError("L'heure de début et de fin ne peuvent pas être identiques.")

        employee   = attrs.get('employee', getattr(self.instance, 'employee', None))
        shift_date = attrs.get('date', getattr(self.instance, 'date', None))
        if employee and shift_date and start is not None and end is not None:
            def to_minutes(t):
                return t.hour * 60 + t.minute

            new_start = to_minutes(start)
            new_end = to_minutes(end)
            if new_end <= new_start:
                new_end += 24 * 60  # créneau de nuit passant minuit (même logique que Shift.hours)

            existing = Shift.objects.filter(employee=employee, date=shift_date)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)

            for other in existing:
                other_start = to_minutes(other.start_time)
                other_end = to_minutes(other.end_time)
                if other_end <= other_start:
                    other_end += 24 * 60
                if new_start < other_end and other_start < new_end:
                    raise serializers.ValidationError(
                        f"Ce créneau chevauche un créneau existant pour {employee.name} le "
                        f"{shift_date.strftime('%d/%m/%Y')} "
                        f"({other.start_time.strftime('%H:%M')}–{other.end_time.strftime('%H:%M')})."
                    )
        return attrs
