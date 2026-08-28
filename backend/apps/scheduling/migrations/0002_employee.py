import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0003_backfill_default_hotel'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('scheduling', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Employee',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Nom complet')),
                ('position', models.CharField(choices=[('reception', 'Réception'), ('housekeeping', 'Ménage'), ('maintenance', 'Maintenance'), ('restaurant', 'Restauration'), ('management', 'Direction'), ('security', 'Sécurité'), ('other', 'Autre')], default='other', max_length=20, verbose_name='Poste')),
                ('phone', models.CharField(blank=True, max_length=30, verbose_name='Téléphone')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='Email')),
                ('notes', models.TextField(blank=True, verbose_name='Notes')),
                ('is_active', models.BooleanField(default=True, verbose_name='Actif')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('hotel', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='employees', to='tenants.hotel')),
                ('user', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='employee_profile', to=settings.AUTH_USER_MODEL, verbose_name='Compte utilisateur lié')),
            ],
            options={
                'verbose_name': 'Employé',
                'verbose_name_plural': 'Employés',
                'ordering': ['name'],
            },
        ),
        migrations.AddField(
            model_name='shift',
            name='employee',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='shifts', to='scheduling.employee', verbose_name='Employé'),
        ),
    ]
