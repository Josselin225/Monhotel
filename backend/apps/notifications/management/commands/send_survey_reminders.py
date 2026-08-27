from django.core.management.base import BaseCommand
from apps.notifications.emails import send_survey_reminders


class Command(BaseCommand):
    help = "Envoie les rappels de questionnaire de satisfaction aux clients qui n'ont pas répondu"

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, default=None,
            help='Nombre de jours après le check-out avant envoi du rappel (défaut : SURVEY_REMINDER_DAYS)'
        )

    def handle(self, *args, **options):
        count = send_survey_reminders(reminder_days=options.get('days'))
        self.stdout.write(self.style.SUCCESS(f"Rappels questionnaire envoyés : {count}"))
