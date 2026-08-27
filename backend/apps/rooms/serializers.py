from rest_framework import serializers
from .models import Room, RoomType, PricingRule

MAX_ROOM_IMAGE_SIZE = 5 * 1024 * 1024  # 5 Mo


def validate_room_image_size(file):
    if file.size > MAX_ROOM_IMAGE_SIZE:
        raise serializers.ValidationError('Image trop volumineuse (max 5 Mo).')


class RoomTypeSerializer(serializers.ModelSerializer):
    rooms_count = serializers.SerializerMethodField()

    class Meta:
        model = RoomType
        fields = '__all__'

    def get_rooms_count(self, obj):
        return obj.rooms.count()


class RoomSerializer(serializers.ModelSerializer):
    room_type_name = serializers.CharField(source='room_type.name', read_only=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    floor_display = serializers.CharField(source='get_floor_display', read_only=True)
    image = serializers.ImageField(required=False, allow_null=True, validators=[validate_room_image_size])

    class Meta:
        model = Room
        fields = '__all__'


class PricingRuleSerializer(serializers.ModelSerializer):
    rule_type_display = serializers.CharField(source='get_rule_type_display', read_only=True)
    room_type_name    = serializers.CharField(source='room_type.name', read_only=True)

    class Meta:
        model  = PricingRule
        fields = '__all__'
