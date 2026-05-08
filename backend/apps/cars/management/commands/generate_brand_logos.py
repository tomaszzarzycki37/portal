"""
Management command to generate placeholder logos for brands that don't have logos.

Usage:
    python manage.py generate_brand_logos          # Generate for brands without logos
    python manage.py generate_brand_logos --all    # Regenerate for all brands
"""
import io
import math
from PIL import Image, ImageDraw, ImageFont
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from apps.cars.models import Brand


def make_placeholder_png(text, rgb_color):
    """Generate a colored placeholder PNG with initials"""
    size = (200, 200)
    image = Image.new('RGB', size, rgb_color)
    draw = ImageDraw.Draw(image)
    
    # Get initials
    initials = ''.join([word[0].upper() for word in text.split()])[:2]
    
    # Try to use a nice font, fall back to default
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 80)
    except:
        font = ImageFont.load_default()
    
    # Center text
    bbox = draw.textbbox((0, 0), initials, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size[0] - text_width) / 2
    y = (size[1] - text_height) / 2
    
    # Draw white text
    draw.text((x, y), initials, fill=(255, 255, 255), font=font)
    
    # Save to bytes
    png_io = io.BytesIO()
    image.save(png_io, 'PNG')
    png_io.seek(0)
    return png_io.getvalue()


class Command(BaseCommand):
    help = 'Generate placeholder logos for brands without logos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            help='Regenerate logos for all brands (even if they already have logos)',
        )

    def handle(self, *args, **options):
        if options['all']:
            brands = Brand.objects.all()
            self.stdout.write('Regenerating logos for ALL brands...\n')
        else:
            brands = Brand.objects.filter(logo='')
            self.stdout.write('Generating logos for brands WITHOUT logos...\n')

        if not brands.exists():
            self.stdout.write(self.style.WARNING('No brands need logo generation'))
            return

        generated_count = 0
        skipped_count = 0

        # Color palette for brands (same as in seed_brands.py)
        colors = [
            (30, 100, 200),    # BYD - deep blue
            (200, 50, 50),     # Nio - red
            (50, 150, 50),     # Xpeng - green
            (150, 30, 180),    # Chery - purple
            (200, 120, 30),    # Li Auto - orange
            (20, 120, 60),     # Haval - dark green
            (100, 100, 100),   # MG - gray
            (30, 100, 180),    # Geely - blue
            (180, 50, 100),    # GAC Aion - pink
            (80, 150, 200),    # Changan - light blue
            (150, 120, 80),    # Jetour - brown
        ]

        for i, brand in enumerate(brands):
            color = colors[i % len(colors)]
            
            try:
                # If logo field is set but file doesn't exist, clear it first
                if brand.logo and not brand.logo.storage.exists(brand.logo.name):
                    brand.logo.delete()
                    brand.save(update_fields=['logo'])
                
                png_bytes = make_placeholder_png(brand.name, color)
                filename = f"{brand.slug}_placeholder.png"
                
                # Delete existing file if it exists (before save)
                if brand.logo.storage.exists(filename):
                    brand.logo.storage.delete(filename)
                
                brand.logo.save(filename, ContentFile(png_bytes), save=True)
                generated_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'  ✓ Generated logo for {brand.name}')
                )
            except Exception as e:
                skipped_count += 1
                self.stdout.write(
                    self.style.ERROR(f'  ✗ Failed to generate logo for {brand.name}: {str(e)}')
                )

        # Summary
        self.stdout.write('\n' + '='*60)
        self.stdout.write(
            self.style.SUCCESS(f'✓ Generated {generated_count} logos')
        )
        if skipped_count > 0:
            self.stdout.write(
                self.style.WARNING(f'⚠️  {skipped_count} logo(s) failed to generate')
            )
