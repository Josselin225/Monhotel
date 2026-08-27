from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('satisfaction', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='satisfactionsurvey',
            name='reminder_sent_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Rappel envoyé le'),
        ),
    ]
