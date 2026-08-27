from django.db import migrations

ICON_MAP = {
    'restaurant gastronomique': 'bi-egg-fried',
    'spa':                       'bi-flower1',
    'piscine':                   'bi-water',
    'conférence':                'bi-building',
    'conferences':               'bi-building',
}


def fix_service_icons(apps, schema_editor):
    SiteContent = apps.get_model('content', 'SiteContent')
    try:
        obj = SiteContent.objects.get(pk=1)
    except SiteContent.DoesNotExist:
        return

    services = obj.data.get('services', [])
    changed = False
    for svc in services:
        if not svc.get('icon'):
            title_lower = svc.get('title', '').lower()
            for keyword, icon in ICON_MAP.items():
                if keyword in title_lower:
                    svc['icon'] = icon
                    changed = True
                    break

    if changed:
        obj.data['services'] = services
        obj.save(update_fields=['data'])


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(fix_service_icons, migrations.RunPython.noop),
    ]
