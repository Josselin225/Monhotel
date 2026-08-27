from django.core.management.base import BaseCommand
from apps.notifications.emails import send_daily_reminders, send_daily_birthdays


class Command(BaseCommand):
    help = "Envoie les rappels d'arrivée (J-1) et les messages d'anniversaire du jour"

    def handle(self, *args, **options):
        reminders = send_daily_reminders()
        birthdays = send_daily_birthdays()
        self.stdout.write(self.style.SUCCESS(
            f"Rappels J-1 envoyés : {reminders} | Anniversaires : {birthdays}"
        ))
