from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('opinions', '0007_opinion_detailed_ratings'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pressreview',
            name='publication_name',
            field=models.CharField(blank=True, default='', max_length=180),
        ),
    ]
