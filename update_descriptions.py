import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'portal_project.settings')
import django
django.setup()
from apps.cars.models import Brand

updated = 0
for brand in Brand.objects.all():
    if not brand.description_en and brand.description:
        brand.description_en = brand.description
        brand.save()
        updated += 1
        print(f'Updated: {brand.name}')

print(f'\nTotal updated: {updated}')
