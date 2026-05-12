# Generated migration for adding category-based ratings

from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('opinions', '0004_pressreview_author'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='opinion',
            name='rating',
        ),
        migrations.AddField(
            model_name='opinion',
            name='rating_quality',
            field=models.IntegerField(default=5, help_text='Quality rating (1-5)', validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)]),
        ),
        migrations.AddField(
            model_name='opinion',
            name='rating_workmanship',
            field=models.IntegerField(default=5, help_text='Workmanship rating (1-5)', validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)]),
        ),
        migrations.AddField(
            model_name='opinion',
            name='rating_economy',
            field=models.IntegerField(default=5, help_text='Economy rating (1-5)', validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)]),
        ),
        migrations.AddField(
            model_name='opinion',
            name='rating_safety',
            field=models.IntegerField(default=5, help_text='Safety rating (1-5)', validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)]),
        ),
        migrations.AddField(
            model_name='opinion',
            name='rating_comfort',
            field=models.IntegerField(default=5, help_text='Comfort rating (1-5)', validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)]),
        ),
        migrations.AddField(
            model_name='opinion',
            name='rating_performance',
            field=models.IntegerField(default=5, help_text='Performance rating (1-5)', validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)]),
        ),
        migrations.AddField(
            model_name='opinion',
            name='rating_design',
            field=models.IntegerField(default=5, help_text='Design rating (1-5)', validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)]),
        ),
        migrations.AddField(
            model_name='opinion',
            name='rating_reliability',
            field=models.IntegerField(default=5, help_text='Reliability rating (1-5)', validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)]),
        ),
    ]
