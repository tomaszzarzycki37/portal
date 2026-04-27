# Generated manually for press reviews

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('cars', '0001_initial'),
        ('opinions', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PressReview',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=220)),
                ('summary', models.TextField(blank=True)),
                ('content', models.TextField()),
                ('publication_name', models.CharField(max_length=180)),
                ('publication_url', models.URLField(blank=True)),
                ('author_name', models.CharField(blank=True, max_length=120)),
                ('published_at', models.DateField()),
                ('is_featured', models.BooleanField(default=False)),
                ('is_published', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('car_model', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='press_reviews', to='cars.carmodel')),
            ],
            options={
                'ordering': ['-published_at', '-created_at'],
            },
        ),
    ]
