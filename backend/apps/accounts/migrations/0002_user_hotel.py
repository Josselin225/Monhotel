from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('tenants',  '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='hotel',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='users',
                to='tenants.hotel',
                db_index=True,
            ),
        ),
    ]
