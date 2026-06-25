from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('common', '0002_alter_sitetextoverride_value'),
    ]

    operations = [
        migrations.CreateModel(
            name='AdminActionLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('actor_username', models.CharField(blank=True, max_length=150)),
                ('action_type', models.CharField(choices=[
                    ('text_create', 'Text create'),
                    ('text_edit', 'Text edit'),
                    ('text_delete', 'Text delete'),
                    ('brand_create', 'Brand create'),
                    ('brand_update', 'Brand update'),
                    ('brand_delete', 'Brand delete'),
                    ('model_create', 'Model create'),
                    ('model_update', 'Model update'),
                    ('model_delete', 'Model delete'),
                    ('review_create', 'Review create'),
                    ('review_update', 'Review update'),
                    ('review_delete', 'Review delete'),
                    ('user_update', 'User update'),
                    ('user_delete', 'User delete'),
                    ('user_temp_password', 'Temporary password'),
                    ('file_upload', 'File upload'),
                ], max_length=40)),
                ('object_type', models.CharField(blank=True, max_length=40)),
                ('object_id', models.CharField(blank=True, max_length=64)),
                ('object_label', models.CharField(blank=True, max_length=255)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='admin_action_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
