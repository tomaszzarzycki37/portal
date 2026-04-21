from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='SiteTextOverride',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=180)),
                ('lang', models.CharField(choices=[('en', 'English'), ('pl', 'Polski')], max_length=2)),
                ('value', models.TextField()),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['lang', 'key'],
                'unique_together': {('key', 'lang')},
            },
        ),
    ]
