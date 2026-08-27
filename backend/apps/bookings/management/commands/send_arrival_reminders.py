from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.bookings.models import Booking
from apps.bookings.email_utils import send_arrival_reminder


class Command(BaseCommand):
    help = "Envoie des rappels J-1 aux clients dont l'arrivée est demain."

    def handle(self, *args, **options):
        tomorrow = timezone.now().date() + timedelta(days=1)
        bookings = Booking.objects.filter(
            check_in=tomorrow,
            status=Booking.Status.CONFIRMED,
        ).select_related('client', 'room', 'room__room_type')

        count = 0
        for booking in bookings:
            if booking.client.email:
                try:
                    send_arrival_reminder(booking)
                    count += 1
                    self.stdout.write(f"  → Rappel envoyé : {booking.reference} — {booking.client.full_name}")
                except Exception as e:
                    self.stderr.write(f"  ✗ Erreur {booking.reference}: {e}")

        self.stdout.write(self.style.SUCCESS(f"{count} rappel(s) envoyé(s) pour le {tomorrow}."))
