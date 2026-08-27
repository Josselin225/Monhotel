"""
Moteur de tarification dynamique.
Applique les PricingRule actives pour calculer le prix par nuit d'une chambre.
"""
import datetime
from decimal import Decimal

from django.db import models as django_models

from .models import PricingRule


def get_occupancy_rate(hotel, on_date):
    """Taux d'occupation (%) de l'hôtel pour une date donnée (réservations actives)."""
    from .models import Room
    from apps.bookings.models import Booking

    total_rooms = Room.objects.filter(hotel=hotel).count()
    if not total_rooms:
        return 0.0

    occupied = Booking.objects.filter(
        room__hotel=hotel,
        check_in__lte=on_date,
        check_out__gt=on_date,
        status__in=[Booking.Status.CONFIRMED, Booking.Status.CHECKED_IN],
    ).values('room_id').distinct().count()

    return round(occupied / total_rooms * 100, 1)


def calculate_price(room, check_in, check_out, booking_date=None):
    """
    Calcule le prix par nuit en appliquant les règles actives.

    Args:
        room         : instance Room
        check_in     : datetime.date
        check_out    : datetime.date
        booking_date : date de création de la réservation (défaut: aujourd'hui)

    Returns:
        dict: base_price, price_per_night, multiplier, applied_rules, occupancy_pct
    """
    booking_date = booking_date or datetime.date.today()
    days_before  = (check_in - booking_date).days
    base_price   = Decimal(str(room.price))
    applied      = []

    rules = (
        PricingRule.objects
        .filter(is_active=True, hotel_id=room.hotel_id)
        .filter(
            django_models.Q(room_type__isnull=True) | django_models.Q(room_type=room.room_type)
        )
        .order_by('-priority')
    )

    # Calculé une seule fois, à la demande (les règles occupancy sont rares).
    occupancy_pct = None
    if rules.filter(rule_type=PricingRule.RuleType.OCCUPANCY).exists():
        occupancy_pct = get_occupancy_rate(room.hotel_id, check_in)

    multiplier = Decimal('1.0')

    for rule in rules:
        pct = Decimal(str(rule.percent_change)) / Decimal('100')

        if rule.rule_type == PricingRule.RuleType.SEASON_HIGH:
            if rule.date_start and rule.date_end and rule.date_start <= check_in <= rule.date_end:
                multiplier += pct
                applied.append(rule.name)

        elif rule.rule_type == PricingRule.RuleType.SEASON_LOW:
            if rule.date_start and rule.date_end and rule.date_start <= check_in <= rule.date_end:
                multiplier += pct
                applied.append(rule.name)

        elif rule.rule_type == PricingRule.RuleType.WEEKEND:
            if check_in.weekday() in (4, 5):  # vendredi ou samedi
                multiplier += pct
                applied.append(rule.name)

        elif rule.rule_type == PricingRule.RuleType.EARLY_BIRD:
            if rule.days_threshold and days_before >= rule.days_threshold:
                multiplier += pct
                applied.append(rule.name)

        elif rule.rule_type == PricingRule.RuleType.LAST_MINUTE:
            if rule.days_threshold and 0 <= days_before <= rule.days_threshold:
                multiplier += pct
                applied.append(rule.name)

        elif rule.rule_type == PricingRule.RuleType.OCCUPANCY:
            if rule.occupancy_threshold is not None and occupancy_pct is not None \
                    and occupancy_pct >= rule.occupancy_threshold:
                multiplier += pct
                applied.append(rule.name)

    price_per_night = base_price * multiplier
    return {
        'base_price':      float(base_price),
        'price_per_night': round(float(price_per_night), 2),
        'multiplier':      round(float(multiplier), 4),
        'applied_rules':   applied,
        'occupancy_pct':   occupancy_pct,
    }
