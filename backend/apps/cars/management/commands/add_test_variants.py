"""Add sample year/engine variants for a model family (for UI testing)."""

from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.cars.dimension_data import get_dimensions_for_model
from apps.cars.models import Brand, CarModel


def _variant(
    year,
    engine_type,
    *,
    horsepower,
    acceleration,
    top_speed,
    fuel_consumption,
    price_min,
    price_max,
    production_status='active',
    description='',
):
    return {
        'year_introduced': year,
        'engine_type': engine_type,
        'horsepower': horsepower,
        'acceleration': acceleration,
        'top_speed': top_speed,
        'fuel_consumption': fuel_consumption,
        'price_min': Decimal(str(price_min)),
        'price_max': Decimal(str(price_max)),
        'production_status': production_status,
        'description': description,
    }


OMODA_5_VARIANTS = [
    _variant(
        2020, 'ICE – 1.5T 147 KM FWD',
        horsepower=147, acceleration='9.1', top_speed=180, fuel_consumption='6.9',
        price_min=89000, price_max=115000, production_status='discontinued',
        description='Wersja startowa Omoda 5 z silnikiem benzynowym 1.5T. Wariant testowy.',
    ),
    _variant(
        2022, 'ICE – 1.6T 186 KM FWD',
        horsepower=186, acceleration='8.6', top_speed=185, fuel_consumption='7.2',
        price_min=105000, price_max=145000,
        description='Podstawowa wersja spalinowa Omoda 5 po liftingu. Wariant testowy.',
    ),
    _variant(
        2023, 'BEV – 150 kW FWD',
        horsepower=204, acceleration='7.6', top_speed=172, fuel_consumption='EV',
        price_min=125000, price_max=165000,
        description='Pełna elektryka Omoda 5 z jednym silnikiem na przedniej osi. Wariant testowy BEV.',
    ),
    _variant(
        2024, 'PHEV – 1.5T + 150 kW AWD',
        horsepower=245, acceleration='7.2', top_speed=180, fuel_consumption='1.2 (WLTC)',
        price_min=138000, price_max=178000,
        description='Hybryda plug-in z napędem na obie osie. Wariant testowy PHEV.',
    ),
    _variant(
        2025, 'ICE – 1.6T Sport 197 KM AWD',
        horsepower=197, acceleration='7.8', top_speed=190, fuel_consumption='7.5',
        price_min=142000, price_max=188000,
        description='Wersja sportowa z napędem 4x4. Wariant testowy ICE AWD.',
    ),
    _variant(
        2026, 'BEV – dual motor 205 kW AWD',
        horsepower=279, acceleration='6.9', top_speed=180, fuel_consumption='EV',
        price_min=155000, price_max=205000, production_status='upcoming',
        description='Najmocniejsza wersja elektryczna Omoda 5. Wariant testowy – nadchodzący rocznik.',
    ),
]

BAIC_TEST_VARIANTS = [
    _variant(
        2021, 'ICE – 1.5T 136 KM FWD',
        horsepower=136, acceleration='9.4', top_speed=175, fuel_consumption='6.8',
        price_min=78000, price_max=98000, production_status='discontinued',
        description='BAIC TEST – pierwsza wersja spalinowa (wariant testowy, rocznik 2021).',
    ),
    _variant(
        2022, 'ICE – 1.5T Turbo 150 KM FWD',
        horsepower=150, acceleration='8.9', top_speed=178, fuel_consumption='7.0',
        price_min=82000, price_max=102000, production_status='discontinued',
        description='BAIC TEST – wersja spalinowa z doładowaniem (wariant testowy, rocznik 2022).',
    ),
    _variant(
        2023, 'BEV – 120 kW FWD',
        horsepower=163, acceleration='8.2', top_speed=160, fuel_consumption='EV',
        price_min=95000, price_max=125000,
        description='BAIC TEST – pierwsza wersja elektryczna (wariant testowy BEV, rocznik 2023).',
    ),
    _variant(
        2024, 'PHEV – 1.5T + 120 kW FWD',
        horsepower=218, acceleration='7.5', top_speed=170, fuel_consumption='1.4 (WLTC)',
        price_min=108000, price_max=138000,
        description='BAIC TEST – hybryda plug-in (wariant testowy PHEV, rocznik 2024).',
    ),
    _variant(
        2025, 'ICE – 2.0T 204 KM AWD',
        horsepower=204, acceleration='7.9', top_speed=190, fuel_consumption='7.6',
        price_min=118000, price_max=152000,
        description='BAIC TEST – wersja spalinowa z napędem AWD (wariant testowy, rocznik 2025).',
    ),
    _variant(
        2026, 'BEV – dual motor 180 kW AWD',
        horsepower=245, acceleration='7.0', top_speed=175, fuel_consumption='EV',
        price_min=128000, price_max=168000, production_status='upcoming',
        description='BAIC TEST – elektryczna wersja z dwoma silnikami (wariant testowy, rocznik 2026).',
    ),
]

VARIANT_PROFILES = {
    ('chery', 'omoda 5'): OMODA_5_VARIANTS,
    ('baic', 'test'): BAIC_TEST_VARIANTS,
}

DEFAULT_PROFILE = ('chery', 'omoda 5')


class Command(BaseCommand):
    help = 'Add test year/engine variants for a model family (profiles: chery/Omoda 5, baic/TEST).'

    def add_arguments(self, parser):
        parser.add_argument('--brand-slug', default=None, help='Brand slug (e.g. chery, baic)')
        parser.add_argument('--model-name', default=None, help='Model family name (e.g. "Omoda 5", TEST)')
        parser.add_argument('--dry-run', action='store_true', help='Show planned changes without writing')

    def handle(self, *args, **options):
        brand_slug = options['brand_slug']
        model_name = options['model_name']
        dry_run = options['dry_run']

        if brand_slug is None or model_name is None:
            brand_slug, model_name = DEFAULT_PROFILE[0], 'Omoda 5'

        profile_key = (brand_slug.lower(), model_name.lower())
        variants = VARIANT_PROFILES.get(profile_key)
        if variants is None:
            known = ', '.join(f'{b}/{m}' for b, m in VARIANT_PROFILES)
            self.stderr.write(
                self.style.ERROR(
                    f'No variant profile for {brand_slug}/{model_name}. Known profiles: {known}',
                ),
            )
            return

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
        vehicle_type = base.vehicle_type if base else 'sedan'
        dimensions = get_dimensions_for_model(name=model_name)
        length_mm = width_mm = height_mm = None
        if dimensions:
            length_mm, width_mm, height_mm = dimensions
        elif base:
            length_mm, width_mm, height_mm = base.length_mm, base.width_mm, base.height_mm

        created = 0
        updated = 0

        for variant in variants:
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
                    f'Done for {brand.name} {model_name}: {created} created, {updated} updated. '
                    f'Total variants: {total}.',
                ),
            )
