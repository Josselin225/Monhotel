from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Hotel',
            fields=[
                ('id',            models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('name',          models.CharField(max_length=200)),
                ('slug',          models.SlugField(max_length=80, unique=True, blank=True)),
                ('email',         models.EmailField(unique=True)),
                ('phone',         models.CharField(max_length=30, blank=True)),
                ('city',          models.CharField(max_length=100, blank=True)),
                ('country',       models.CharField(max_length=100, default="Côte d'Ivoire")),
                ('plan',          models.CharField(max_length=20, db_index=True, default='basic',
                                    choices=[('basic','Basic (1 hôtel)'),('pro','Pro (analytics avancés)'),
                                             ('enterprise','Enterprise (multi-propriétés)')])),
                ('is_active',     models.BooleanField(default=True, db_index=True)),
                ('trial_ends_at', models.DateTimeField(null=True, blank=True)),
                ('created_at',    models.DateTimeField(auto_now_add=True)),
                ('updated_at',    models.DateTimeField(auto_now=True)),
            ],
            options={'verbose_name': 'Hôtel', 'verbose_name_plural': 'Hôtels', 'ordering': ['name']},
        ),
    ]
