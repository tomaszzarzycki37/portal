from django.db import migrations, models


def approve_existing_users(apps, schema_editor):
    UserProfile = apps.get_model('users', 'UserProfile')
    UserProfile.objects.update(is_approved=True)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_userprofile_last_seen'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='is_approved',
            field=models.BooleanField(
                default=False,
                help_text='When False, the user can log in but cannot publish opinions or reviews until an admin approves.',
            ),
        ),
        migrations.RunPython(approve_existing_users, migrations.RunPython.noop),
    ]
