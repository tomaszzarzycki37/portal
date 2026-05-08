"""
Management command to restore original brand logo references from uploaded files.
"""
from django.core.management.base import BaseCommand
from apps.cars.models import Brand


class Command(BaseCommand):
    help = 'Restore original brand logo file references'

    def handle(self, *args, **options):
        # Map brand slugs to their original uploaded logo filenames
        logo_mappings = {
            'byd': 'BYD.png',
            'changan': 'changan.png',
            'chery': 'chery.png',
            'geely': 'GEELY.png',
            'haval': 'Haval-Logo.jpg',
            'li-auto': 'li-auto5478.jpg',
            'mg': 'mg.png',
            'nio': 'NIO.png',
            'xpeng': 'Xpeng-Logo-1.jpg',
            # gac-aion and jetour don't have original uploads, keep placeholders
        }

        restored_count = 0
        for slug, filename in logo_mappings.items():
            try:
                brand = Brand.objects.get(slug=slug)
                brand.logo = f'brands/{filename}'
                brand.save(update_fields=['logo'])
                restored_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Restored logo for {brand.name}: {filename}')
                )
            except Brand.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f'⚠️  Brand not found: {slug}')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'✗ Failed to restore {slug}: {str(e)}')
                )

        self.stdout.write('\n' + '='*60)
        self.stdout.write(
            self.style.SUCCESS(f'✓ Restored {restored_count} original logos')
        )
