import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scheduling', '0003_backfill_employees'),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name='shift',
            name='scheduling__date_c8a4f5_idx',
        ),
        migrations.RemoveField(
            model_name='shift',
            name='user',
        ),
        migrations.AlterField(
            model_name='shift',
            name='employee',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shifts', to='scheduling.employee', verbose_name='Employé'),
        ),
        migrations.AddIndex(
            model_name='shift',
            index=models.Index(fields=['date', 'employee'], name='scheduling__date_6b4e9c_idx'),
        ),
    ]
