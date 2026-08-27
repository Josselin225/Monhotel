from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='SiteVisit',
            fields=[
                ('id',          models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('timestamp',   models.DateTimeField(auto_now_add=True, db_index=True)),
                ('path',        models.CharField(max_length=500)),
                ('session_key', models.CharField(blank=True, max_length=64)),
                ('referrer',    models.CharField(blank=True, max_length=500)),
            ],
            options={
                'ordering': ['-timestamp'],
            },
        ),
    ]
