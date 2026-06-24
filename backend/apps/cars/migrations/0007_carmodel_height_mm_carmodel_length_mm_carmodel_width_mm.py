from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cars', '0006_alter_brand_slug'),
    ]

    operations = [
        migrations.AddField(
            model_name='carmodel',
            name='height_mm',
            field=models.IntegerField(blank=True, help_text='Overall height in mm', null=True),
        ),
        migrations.AddField(
            model_name='carmodel',
            name='length_mm',
            field=models.IntegerField(blank=True, help_text='Overall length in mm', null=True),
        ),
        migrations.AddField(
            model_name='carmodel',
            name='width_mm',
            field=models.IntegerField(blank=True, help_text='Overall width in mm', null=True),
        ),
    ]
