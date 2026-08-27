from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import Hotel


class HotelSerializer(serializers.ModelSerializer):
    users_count    = serializers.SerializerMethodField()
    rooms_count    = serializers.SerializerMethodField()
    bookings_count = serializers.SerializerMethodField()
    revenue_total  = serializers.SerializerMethodField()

    class Meta:
        model  = Hotel
        fields = ['id', 'name', 'slug', 'email', 'phone', 'city', 'country',
                  'plan', 'is_active', 'trial_ends_at', 'created_at',
                  'users_count', 'rooms_count', 'bookings_count', 'revenue_total']
        read_only_fields = ['id', 'slug', 'created_at']

    def get_users_count(self, obj):
        return obj.users.count()

    def get_rooms_count(self, obj):
        return obj.rooms.count()

    def get_bookings_count(self, obj):
        return obj.bookings.count()

    def get_revenue_total(self, obj):
        from django.db.models import Sum
        from apps.billing.models import Invoice
        total = Invoice.objects.filter(hotel=obj, status='paid').aggregate(s=Sum('total'))['s']
        return float(total or 0)


class HotelCreateSerializer(serializers.ModelSerializer):
    """Utilisé lors de l'onboarding (création d'un hôtel + admin)."""
    admin_username = serializers.CharField(write_only=True)
    admin_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    admin_email    = serializers.EmailField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model  = Hotel
        fields = ['name', 'email', 'phone', 'city', 'country', 'plan',
                  'admin_username', 'admin_password', 'admin_email']

    def validate_admin_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        from apps.accounts.models import User
        admin_username = validated_data.pop('admin_username')
        admin_password = validated_data.pop('admin_password')
        admin_email    = validated_data.pop('admin_email', '')

        hotel = Hotel.objects.create(**validated_data)

        # is_staff/is_superuser NE sont JAMAIS accordés ici : ce sont des drapeaux
        # Django réservés aux opérateurs de la plateforme (accès à /admin/), pas au
        # rôle métier "admin" d'un hôtel — sinon n'importe quel hôtel auto-inscrit
        # obtiendrait un accès Django admin non cloisonné à toutes les données.
        user = User(
            username=admin_username,
            email=admin_email or hotel.email,
            role='admin',
            hotel=hotel,
        )
        user.set_password(admin_password)
        user.save()
        return hotel
