from django.db import migrations

ROLE_TO_POSITION = {
    'receptionist': 'reception',
    'manager': 'management',
    'admin': 'management',
}


def backfill(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    Employee = apps.get_model('scheduling', 'Employee')
    Shift = apps.get_model('scheduling', 'Shift')

    employee_by_user_id = {}
    for user in User.objects.all():
        full_name = f'{user.first_name} {user.last_name}'.strip()
        employee = Employee.objects.create(
            hotel_id=user.hotel_id,
            user_id=user.id,
            name=full_name or user.username,
            position=ROLE_TO_POSITION.get(user.role, 'other'),
        )
        employee_by_user_id[user.id] = employee.id

    for shift in Shift.objects.all():
        employee_id = employee_by_user_id.get(shift.user_id)
        if employee_id:
            shift.employee_id = employee_id
            shift.save(update_fields=['employee_id'])


def backfill_reverse(apps, schema_editor):
    Employee = apps.get_model('scheduling', 'Employee')
    Employee.objects.filter(user__isnull=False).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('scheduling', '0002_employee'),
    ]

    operations = [
        migrations.RunPython(backfill, backfill_reverse),
    ]
