"""Add sample user opinions for UI testing (default: BAIC TEST)."""

from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from apps.cars.models import Brand, CarModel
from apps.opinions.models import Opinion
from apps.opinions.rating_schema import empty_detailed_ratings, sync_legacy_ratings_from_detailed

SAMPLE_OPINIONS = [
    {
        'username': 'test_reviewer_bev',
        'title': 'Spokojna jazda elektryczna TEST',
        'content': (
            '<p>Testowa opinia dla wersji BEV BAIC TEST. Auto ciche, '
            'przyspieszenie linearne, dobry zasięg w mieście.</p>'
        ),
        'year': 2023,
        'fuel_min': Decimal('0'),
        'fuel_max': Decimal('0'),
        'rating_overrides': {
            'technical': {'engine': 5, 'gearbox': 5},
            'comfort': {'soundproofing': 4, 'multimedia': 4},
            'utility': {'performance': 4, 'handling': 4},
            'economy': {'value_for_money': 4, 'reliability': 4},
        },
    },
    {
        'username': 'test_reviewer_phev',
        'title': 'Hybryda TEST na co dzień',
        'content': (
            '<p>Testowa opinia dla wersji PHEV. W trasie spalanie rozsądne, '
            'tryb EV w mieście wystarcza na dojazdy.</p>'
        ),
        'year': 2024,
        'fuel_min': Decimal('1.1'),
        'fuel_max': Decimal('1.6'),
        'rating_overrides': {
            'technical': {'engine': 4, 'gearbox': 4},
            'comfort': {'hvac': 4, 'passenger_space': 4},
            'utility': {'safety_systems': 4, 'functionality': 4},
            'economy': {'value_for_money': 4, 'trouble_free': 3},
        },
    },
    {
        'username': 'test_reviewer_ice',
        'title': 'Wersja spalinowa TEST AWD',
        'content': (
            '<p>Testowa opinia dla wersji ICE AWD. Pewny napęd na mokrej nawierzchni, '
            'silnik kultury pracy, wyższe spalanie w mieście.</p>'
        ),
        'year': 2025,
        'fuel_min': Decimal('7.2'),
        'fuel_max': Decimal('9.1'),
        'rating_overrides': {
            'technical': {'engine': 4, 'drivetrain': 5, 'suspension': 4},
            'comfort': {'ergonomics': 4, 'materials': 3},
            'utility': {'handling': 4, 'driving_position': 4},
            'economy': {'reliability': 4, 'maintenance_ease': 3},
        },
    },
]


def build_detailed_ratings(overrides):
    detailed = empty_detailed_ratings()
    for section, values in (overrides or {}).items():
        if section not in detailed:
            continue
        for key, value in values.items():
            if key in detailed[section]:
                detailed[section][key] = int(value)
    return detailed


class Command(BaseCommand):
    help = 'Add test opinions for a model family (default: BAIC TEST).'

    def add_arguments(self, parser):
        parser.add_argument('--brand-slug', default='baic')
        parser.add_argument('--model-name', default='TEST')

    def handle(self, *args, **options):
        brand_slug = options['brand_slug']
        model_name = options['model_name']

        try:
            brand = Brand.objects.get(slug=brand_slug)
        except Brand.DoesNotExist:
            self.stderr.write(self.style.ERROR(f'Brand not found: {brand_slug}'))
            return

        variants = {
            car.year_introduced: car
            for car in CarModel.objects.filter(brand=brand, name=model_name)
        }

        if not variants:
            self.stderr.write(self.style.ERROR(f'No variants found for {brand.name} {model_name}'))
            return

        created = 0
        updated = 0

        for sample in SAMPLE_OPINIONS:
            car = variants.get(sample['year'])
            if not car:
                self.stdout.write(self.style.WARNING(f"Skip: no variant for year {sample['year']}"))
                continue

            user, _ = User.objects.get_or_create(
                username=sample['username'],
                defaults={'email': f"{sample['username']}@example.com"},
            )
            if not user.has_usable_password():
                user.set_password('TestReview123!')
                user.save()

            detailed = build_detailed_ratings(sample['rating_overrides'])
            legacy = sync_legacy_ratings_from_detailed(detailed)

            opinion, was_created = Opinion.objects.update_or_create(
                car_model=car,
                author=user,
                defaults={
                    'title': sample['title'],
                    'content': sample['content'],
                    'detailed_ratings': detailed,
                    'fuel_consumption_min': sample.get('fuel_min'),
                    'fuel_consumption_max': sample.get('fuel_max'),
                    'is_approved': True,
                    'is_verified_owner': True,
                    **legacy,
                },
            )

            label = f'{brand.name} {model_name} ({car.year_introduced}) — {user.username}'
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f'Created opinion: {label}'))
            else:
                updated += 1
                self.stdout.write(self.style.WARNING(f'Updated opinion: {label}'))

        self.stdout.write(self.style.SUCCESS(f'Done: {created} created, {updated} updated.'))
