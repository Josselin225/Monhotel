from django.db import migrations

DEFAULT_CATEGORIES = [
    ('Minibar', 'bi-cup-straw'),
    ('Linge', 'bi-bag'),
    ('Fournitures', 'bi-box-seam'),
    ("Produits d'entretien", 'bi-droplet'),
    ('Autre', 'bi-three-dots'),
]


def seed_categories(apps, schema_editor):
    Hotel = apps.get_model('tenants', 'Hotel')
    InventoryCategory = apps.get_model('inventory', 'InventoryCategory')
    for hotel in Hotel.objects.all():
        for name, icon in DEFAULT_CATEGORIES:
            InventoryCategory.objects.get_or_create(hotel=hotel, name=name, defaults={'icon': icon})


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0002_alter_inventoryitem_options_inventorycategory_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_categories, noop_reverse),
    ]
