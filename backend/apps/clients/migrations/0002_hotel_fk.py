from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0001_initial'),
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='client',
            name='hotel',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='clients',
                to='tenants.hotel',
                db_index=True,
            ),
        ),
    ]
