from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializer admin (lecture/écriture complète, y compris rôle et statut actif)."""
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'role_display', 'phone', 'is_active', 'avatar', 'is_superuser']
        read_only_fields = ['id', 'is_superuser']


class MeSerializer(serializers.ModelSerializer):
    """Serializer self-service (route /auth/me/) : un utilisateur ne peut jamais
    modifier son propre rôle ou son statut actif — ces champs sont en lecture seule."""
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'role_display', 'phone', 'is_active', 'avatar', 'two_factor_enabled', 'is_superuser']
        read_only_fields = ['id', 'username', 'role', 'role_display', 'is_active', 'two_factor_enabled', 'is_superuser']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'role', 'phone']

    def validate_password(self, value):
        temp_user = User(
            username=self.initial_data.get('username', ''),
            email=self.initial_data.get('email', ''),
            first_name=self.initial_data.get('first_name', ''),
            last_name=self.initial_data.get('last_name', ''),
        )
        try:
            validate_password(value, user=temp_user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Mise à jour d'un utilisateur avec réinitialisation optionnelle du mot de passe."""
    password = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'role', 'phone', 'is_active', 'password']

    def validate_password(self, value):
        if not value:
            return value
        try:
            validate_password(value, user=self.instance)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
