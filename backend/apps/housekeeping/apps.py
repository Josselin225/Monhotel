from django.apps import AppConfig


class HousekeepingConfig(AppConfig):
    name = 'apps.housekeeping'
    verbose_name = 'Housekeeping'

    def ready(self):
        import apps.housekeeping.signals  # noqa
