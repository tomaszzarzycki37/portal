"""
Populate length, width and height (mm) for car models from manufacturer specs.

Usage:
    python manage.py populate_car_dimensions
    python manage.py populate_car_dimensions --dry-run
"""
from django.core.management.base import BaseCommand

from apps.cars.models import CarModel
from apps.cars.dimension_data import get_dimensions_for_model


class Command(BaseCommand):
    help = 'Populate car model dimensions (length, width, height in mm)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show changes without saving',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        updated = 0
        skipped = []

        for car in CarModel.objects.select_related('brand').order_by('brand__name', 'name'):
            dimensions = get_dimensions_for_model(slug=car.slug, name=car.name)
            if not dimensions:
                skipped.append(f'{car.brand.name} {car.name} ({car.slug})')
                continue

            length_mm, width_mm, height_mm = dimensions

            if dry_run:
                self.stdout.write(
                    f'  {car.brand.name} {car.name}: {length_mm} x {width_mm} x {height_mm} mm'
                )
                continue

            car.length_mm = length_mm
            car.width_mm = width_mm
            car.height_mm = height_mm
            car.save(update_fields=['length_mm', 'width_mm', 'height_mm', 'updated_at'])
            updated += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f'  OK {car.brand.name} {car.name}: {length_mm} x {width_mm} x {height_mm} mm'
                )
            )

        if skipped:
            self.stdout.write(self.style.WARNING('No dimensions mapped for:'))
            for item in skipped:
                self.stdout.write(f'  - {item}')

        if dry_run:
            self.stdout.write(f'Dry run complete for {CarModel.objects.count()} models.')
        else:
            self.stdout.write(self.style.SUCCESS(f'Updated {updated} models.'))
