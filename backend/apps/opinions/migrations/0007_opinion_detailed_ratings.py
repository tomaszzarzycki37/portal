from decimal import Decimal

from django.db import migrations, models

from apps.opinions.rating_schema import migrate_legacy_to_detailed


def migrate_existing_opinions(apps, schema_editor):
    Opinion = apps.get_model('opinions', 'Opinion')
    for opinion in Opinion.objects.all():
        if opinion.detailed_ratings:
            continue
        opinion.detailed_ratings = migrate_legacy_to_detailed(opinion)
        opinion.save(update_fields=['detailed_ratings'])


class Migration(migrations.Migration):

    dependencies = [
        ('opinions', '0006_alter_pressreview_slug'),
    ]

    operations = [
        migrations.AddField(
            model_name='opinion',
            name='detailed_ratings',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='opinion',
            name='fuel_consumption_min',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name='opinion',
            name='fuel_consumption_max',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.RunPython(migrate_existing_opinions, migrations.RunPython.noop),
    ]
