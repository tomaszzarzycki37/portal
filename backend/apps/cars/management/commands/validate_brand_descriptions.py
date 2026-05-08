"""
Management command to validate that all brands have proper multilingual descriptions.

This prevents issues where a brand might have text in the wrong language field.

Usage:
    python manage.py validate_brand_descriptions        # Check all brands
    python manage.py validate_brand_descriptions --fix   # Auto-fix by copying description to missing fields
"""
from django.core.management.base import BaseCommand, CommandError
from apps.cars.models import Brand


class Command(BaseCommand):
    help = 'Validate that all brands have proper multilingual descriptions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Automatically fix missing description_en/description_pl by copying from description field',
        )

    def handle(self, *args, **options):
        brands = Brand.objects.all()
        issues_found = 0
        fixed_count = 0

        if not brands.exists():
            self.stdout.write(self.style.WARNING('No brands found in database'))
            return

        self.stdout.write(f'\nValidating {brands.count()} brands...\n')

        for brand in brands:
            brand_issues = []

            # Check if description_en is empty
            if not brand.description_en or brand.description_en.strip() == '':
                brand_issues.append('❌ description_en is empty')
                if options['fix']:
                    brand.description_en = brand.description
                    fixed_count += 1

            # Check if description_pl is empty
            if not brand.description_pl or brand.description_pl.strip() == '':
                brand_issues.append('❌ description_pl is empty')
                if options['fix']:
                    brand.description_pl = brand.description
                    fixed_count += 1

            if brand_issues:
                issues_found += 1
                self.stdout.write(
                    self.style.ERROR(f'  ⚠️  {brand.name} ({brand.slug}):')
                )
                for issue in brand_issues:
                    self.stdout.write(f'       {issue}')
                
                if options['fix']:
                    brand.save()
                    self.stdout.write(
                        self.style.SUCCESS(f'       ✓ Fixed descriptions for {brand.name}')
                    )
            else:
                self.stdout.write(
                    self.style.SUCCESS(f'  ✓ {brand.name}')
                )

        # Summary
        self.stdout.write('\n' + '='*60)
        if issues_found == 0:
            self.stdout.write(
                self.style.SUCCESS('✓ All brands have valid multilingual descriptions!')
            )
        else:
            message = f'⚠️  Found {issues_found} brand(s) with missing descriptions'
            if options['fix']:
                self.stdout.write(
                    self.style.SUCCESS(f'{message} - FIXED {fixed_count} descriptions')
                )
            else:
                self.stdout.write(
                    self.style.ERROR(message)
                )
                self.stdout.write(
                    self.style.WARNING(
                        '\nTo automatically fix missing descriptions, run:\n'
                        '  python manage.py validate_brand_descriptions --fix\n'
                    )
                )
