"""Add sample year/engine variants for a model family (for UI testing)."""

from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.cars.dimension_data import get_dimensions_for_model
from apps.cars.models import Brand, CarModel

DEFAULT_VARIANTS = [
    {
        'year_introduced': 2020,
        'engine_type': 'ICE – 1.5T 147 KM FWD',
        'horsepower': 147,
        'acceleration': '9.1',
        'top_speed': 180,
        'fuel_consumption': '6.9',
        'price_min': Decimal('89000'),
        'price_max': Decimal('115000'),
        'production_status': 'discontinued',
        'description': (
            'Wersja startowa Omoda 5 z silnikiem benzynowym 1.5T. '
            'Wariant testowy do porównania roczników i napędów.'
        ),
    },
    {
        'year_introduced': 2022,
        'engine_type': 'ICE – 1.6T 186 KM FWD',
        'horsepower': 186,
        'acceleration': '8.6',
        'top_speed': 185,
        'fuel_consumption': '7.2',
        'price_min': Decimal('105000'),
        'price_max': Decimal('145000'),
        'production_status': 'active',
        'description': (
            'Podstawowa wersja spalinowa Omoda 5 po liftingu. '
            'Wariant testowy – rocznik referencyjny.'
        ),
    },
    {
        'year_introduced': 2023,
        'engine_type': 'BEV – 150 kW FWD',
        'horsepower': 204,
        'acceleration': '7.6',
        'top_speed': 172,
        'fuel_consumption': 'EV',
        'price_min': Decimal('125000'),
        'price_max': Decimal('165000'),
        'production_status': 'active',
        'description': (
            'Pełna elektryka Omoda 5 z jednym silnikiem na przedniej osi. '
            'Wariant testowy BEV.'
        ),
    },
    {
        'year_introduced': 2024,
        'engine_type': 'PHEV – 1.5T + 150 kW AWD',
        'horsepower': 245,
        'acceleration': '7.2',
        'top_speed': 180,
        'fuel_consumption': '1.2 (WLTC)',
        'price_min': Decimal('138000'),
        'price_max': Decimal('178000'),
        'production_status': 'active',
        'description': (
            'Hybryda plug-in z napędem na obie osie. '
            'Wariant testowy PHEV.'
        ),
    },
    {
        'year_introduced': 2025,
        'engine_type': 'ICE – 1.6T Sport 197 KM AWD',
        'horsepower': 197,
        'acceleration': '7.8',
        'top_speed': 190,
        'fuel_consumption': '7.5',
        'price_min': Decimal('142000'),
        'price_max': Decimal('188000'),
        'production_status': 'active',
        'description': (
            'Wersja sportowa z napędem 4x4 i mocniejszą jednostką spalinową. '
            'Wariant testowy ICE AWD.'
        ),
    },
    {
        'year_introduced': 2026,
        'engine_type': 'BEV – dual motor 205 kW AWD',
        'horsepower': 279,
        'acceleration': '6.9',
        'top_speed': 180,
        'fuel_consumption': 'EV',
        'price_min': Decimal('155000'),
        'price_max': Decimal('205000'),
        'production_status': 'upcoming',
        'description': (
            'Najmocniejsza wersja elektryczna z dwoma silnikami. '
            'Wariant testowy – nadchodzący rocznik.'
        ),
    },
]


class Command(BaseCommand):
    help = 'Add test year/engine variants for a model family (default: Chery Omoda 5).'

    def add_arguments(self, parser):
        parser.add_argument('--brand-slug', default='chery', help='Brand slug (default: chery)')
        parser.add_argument('--model-name', default='Omoda 5', help='Model family name (default: Omoda 5)')
        parser.add_argument('--dry-run', action='store_true', help='Show planned changes without writing')

    def handle(self, *args, **options):
        brand_slug = options['brand_slug']
        model_name = options['model_name']
        dry_run = options['dry_run']

        try:
            brand = Brand.objects.get(slug=brand_slug)
        except Brand.DoesNotExist:
            self.stderr.write(self.style.ERROR(f'Brand not found: {brand_slug}'))
            return

        base = (
            CarModel.objects.filter(brand=brand, name=model_name)
            .order_by('-year_introduced')
            .first()
        )
        vehicle_type = base.vehicle_type if base else 'crossover'
        dimensions = get_dimensions_for_model(name=model_name)
        length_mm = width_mm = height_mm = None
        if dimensions:
            length_mm, width_mm, height_mm = dimensions
        elif base:
            length_mm, width_mm, height_mm = base.length_mm, base.width_mm, base.height_mm

        created = 0
        updated = 0
        skipped = 0

        for variant in DEFAULT_VARIANTS:
            year = variant['year_introduced']
            label = f'{brand.name} {model_name} ({year}) – {variant["engine_type"]}'

            if dry_run:
                exists = CarModel.objects.filter(brand=brand, name=model_name, year_introduced=year).exists()
                action = 'update' if exists else 'create'
                self.stdout.write(f'[dry-run] {action}: {label}')
                continue

            car_model, was_created = CarModel.objects.get_or_create(
                brand=brand,
                name=model_name,
                year_introduced=year,
                defaults={
                    'vehicle_type': vehicle_type,
                    'description': variant['description'],
                    'engine_type': variant['engine_type'],
                    'horsepower': variant['horsepower'],
                    'acceleration': variant['acceleration'],
                    'top_speed': variant['top_speed'],
                    'fuel_consumption': variant['fuel_consumption'],
                    'price_min': variant['price_min'],
                    'price_max': variant['price_max'],
                    'currency': 'CNY',
                    'production_status': variant['production_status'],
                    'is_featured': False,
                    'length_mm': length_mm,
                    'width_mm': width_mm,
                    'height_mm': height_mm,
                },
            )

            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f'Created: {label}'))
                continue

            car_model.vehicle_type = vehicle_type
            car_model.description = variant['description']
            car_model.engine_type = variant['engine_type']
            car_model.horsepower = variant['horsepower']
            car_model.acceleration = variant['acceleration']
            car_model.top_speed = variant['top_speed']
            car_model.fuel_consumption = variant['fuel_consumption']
            car_model.price_min = variant['price_min']
            car_model.price_max = variant['price_max']
            car_model.currency = 'CNY'
            car_model.production_status = variant['production_status']
            if length_mm and car_model.length_mm is None:
                car_model.length_mm = length_mm
            if width_mm and car_model.width_mm is None:
                car_model.width_mm = width_mm
            if height_mm and car_model.height_mm is None:
                car_model.height_mm = height_mm
            car_model.save()
            updated += 1
            self.stdout.write(self.style.WARNING(f'Updated: {label}'))

        if not dry_run:
            total = CarModel.objects.filter(brand=brand, name=model_name).count()
            self.stdout.write('')
            self.stdout.write(
                self.style.SUCCESS(
                    f'Done for {brand.name} {model_name}: {created} created, {updated} updated, '
                    f'{skipped} skipped. Total variants: {total}.',
                ),
            )
