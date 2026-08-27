from django.db import migrations


def backfill_default_hotel(apps, schema_editor):
    """
    Avant ce correctif, aucun ViewSet n'appliquait le cloisonnement par hôtel :
    toutes les données existantes ont `hotel=NULL`. On crée un hôtel par défaut
    et on y rattache tout ce qui existe déjà, pour que l'activation du
    cloisonnement (HotelScopeMixin) n'efface l'accès à aucune donnée existante.
    """
    Hotel = apps.get_model('tenants', 'Hotel')

    # Rien à faire si un hôtel existe déjà (déploiement déjà multi-tenant actif).
    if Hotel.objects.exists():
        return

    User = apps.get_model('accounts', 'User')
    Room = apps.get_model('rooms', 'Room')
    RoomType = apps.get_model('rooms', 'RoomType')
    PricingRule = apps.get_model('rooms', 'PricingRule')
    Client = apps.get_model('clients', 'Client')
    Booking = apps.get_model('bookings', 'Booking')
    Invoice = apps.get_model('billing', 'Invoice')
    Transaction = apps.get_model('accounting', 'Transaction')
    Budget = apps.get_model('accounting', 'Budget')
    Technician = apps.get_model('maintenance', 'Technician')
    MaintenanceTicket = apps.get_model('maintenance', 'MaintenanceTicket')
    CleaningTask = apps.get_model('housekeeping', 'CleaningTask')
    SatisfactionSurvey = apps.get_model('satisfaction', 'SatisfactionSurvey')

    has_data = any([
        User.objects.exists(), Room.objects.exists(),
        Client.objects.exists(), Booking.objects.exists(),
    ])
    if not has_data:
        return  # base neuve, rien à rattacher

    admin_user = User.objects.filter(role='admin').order_by('id').first() or User.objects.order_by('id').first()

    hotel_name = 'Mon Hôtel'
    try:
        SiteContent = apps.get_model('content', 'SiteContent')
        content = SiteContent.objects.filter(pk=1).first()
        if content and isinstance(content.data, dict):
            name = (content.data.get('hotel') or {}).get('name')
            if name:
                hotel_name = name
    except LookupError:
        pass

    hotel = Hotel.objects.create(
        name=hotel_name,
        email=(admin_user.email if admin_user and admin_user.email else 'contact@monhotel.local'),
    )

    User.objects.filter(hotel__isnull=True).update(hotel=hotel)
    RoomType.objects.filter(hotel__isnull=True).update(hotel=hotel)
    Room.objects.filter(hotel__isnull=True).update(hotel=hotel)
    PricingRule.objects.filter(hotel__isnull=True).update(hotel=hotel)
    Client.objects.filter(hotel__isnull=True).update(hotel=hotel)
    Booking.objects.filter(hotel__isnull=True).update(hotel=hotel)
    Invoice.objects.filter(hotel__isnull=True).update(hotel=hotel)
    Transaction.objects.filter(hotel__isnull=True).update(hotel=hotel)
    Budget.objects.filter(hotel__isnull=True).update(hotel=hotel)
    Technician.objects.filter(hotel__isnull=True).update(hotel=hotel)
    MaintenanceTicket.objects.filter(hotel__isnull=True).update(hotel=hotel)
    CleaningTask.objects.filter(hotel__isnull=True).update(hotel=hotel)
    SatisfactionSurvey.objects.filter(hotel__isnull=True).update(hotel=hotel)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0002_alter_hotel_email_alter_hotel_id'),
        ('accounts', '0003_merge_0002_alter_user_avatar_0002_user_hotel'),
        ('rooms', '0005_pricingrule_hotel'),
        ('clients', '0005_merge_0002_hotel_fk_0004_blacklist_fields'),
        ('bookings', '0006_merge_20260701_1100'),
        ('billing', '0003_invoice_hotel_alter_invoice_status'),
        ('accounting', '0003_alter_budget_unique_together_budget_hotel_and_more'),
        ('maintenance', '0003_maintenanceticket_hotel_technician_hotel'),
        ('housekeeping', '0002_cleaningtask_hotel'),
        ('satisfaction', '0003_satisfactionsurvey_hotel'),
        ('content', '0002_fix_services_icons'),
    ]

    operations = [
        migrations.RunPython(backfill_default_hotel, noop_reverse),
    ]
