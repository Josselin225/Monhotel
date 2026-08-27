from django.conf import settings
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Payment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12, verbose_name='Montant (FCFA)')),
                ('method', models.CharField(
                    choices=[('cash', 'Espèces'), ('card', 'Carte bancaire'), ('mobile', 'Mobile Money'), ('transfer', 'Virement'), ('other', 'Autre')],
                    max_length=20, verbose_name='Mode de paiement')),
                ('reference', models.CharField(blank=True, max_length=100, verbose_name='Référence')),
                ('note', models.TextField(blank=True, verbose_name='Note')),
                ('paid_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='Date du paiement')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Enregistré par')),
                ('invoice', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='payments',
                    to='billing.invoice',
                    verbose_name='Facture')),
            ],
            options={
                'verbose_name': 'Paiement',
                'verbose_name_plural': 'Paiements',
                'ordering': ['-paid_at'],
            },
        ),
    ]
