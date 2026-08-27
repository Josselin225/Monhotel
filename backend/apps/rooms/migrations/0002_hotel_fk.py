from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('rooms',   '0001_initial'),
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='roomtype',
            name='hotel',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='room_types',
                to='tenants.hotel',
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name='room',
            name='hotel',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='rooms',
                to='tenants.hotel',
                db_index=True,
            ),
        ),
    ]
