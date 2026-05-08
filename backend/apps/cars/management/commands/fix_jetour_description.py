"""
Management command to fix Jetour brand English description.

Usage:
    python manage.py fix_jetour_description
"""
from django.core.management.base import BaseCommand
from apps.cars.models import Brand


class Command(BaseCommand):
    help = "Fix Jetour brand English description (was in Polish)"

    def handle(self, *args, **options):
        # Try to find Jetour by name first, then by slug
        jetour = None
        try:
            jetour = Brand.objects.get(name="Jetour")
        except Brand.DoesNotExist:
            try:
                jetour = Brand.objects.get(slug="jetour")
            except Brand.DoesNotExist:
                pass
        
        if jetour:
            # Update existing brand
            jetour.description_en = (
                "Jetour (捷途) is a sub-brand of Chery Automobile focused on affordable "
                "family SUVs and crossovers. Launched in 2018, Jetour targets value-conscious "
                "buyers seeking practical vehicles with good warranty and after-sales support. "
                "The brand has expanded rapidly across Chinese domestic and export markets."
            )
            
            # Set description_pl if empty
            if not jetour.description_pl:
                jetour.description_pl = (
                    "Marka Jetour została wprowadzona na rynek 22 stycznia 2018 r."
                )
            
            jetour.save()
            
            self.stdout.write(
                self.style.SUCCESS(f"✓ Updated Jetour brand descriptions:")
            )
            self.stdout.write(f"  EN: {jetour.description_en[:80]}...")
            self.stdout.write(f"  PL: {jetour.description_pl[:80]}...")
        else:
            # Create new brand
            self.stdout.write(
                self.style.WARNING("Jetour brand not found. Creating new brand...")
            )
            
            jetour = Brand.objects.create(
                name="Jetour",
                slug="jetour",
                description="Jetour is a sub-brand of Chery Automobile.",
                description_en=(
                    "Jetour (捷途) is a sub-brand of Chery Automobile focused on affordable "
                    "family SUVs and crossovers. Launched in 2018, Jetour targets value-conscious "
                    "buyers seeking practical vehicles with good warranty and after-sales support. "
                    "The brand has expanded rapidly across Chinese domestic and export markets."
                ),
                description_pl=(
                    "Marka Jetour została wprowadzona na rynek 22 stycznia 2018 r."
                ),
                founded_year=2018,
                website="https://www.jetour.com",
                country="China",
                is_active=True,
            )
            
            self.stdout.write(
                self.style.SUCCESS(f"✓ Created new Jetour brand with descriptions")
            )
