"""
Management command to seed the database with Chinese car brands, models,
and generate placeholder logo images using Pillow.

Usage:
    python manage.py seed_brands          # Add missing brands/models only
    python manage.py seed_brands --reset  # Clear and reseed from scratch
"""
import io
import os
import math

from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile

try:
    from PIL import Image, ImageDraw, ImageFont
    PILLOW_OK = True
except ImportError:
    PILLOW_OK = False

from apps.cars.models import Brand, CarModel


# ---------------------------------------------------------------------------
# Brand seed data
# ---------------------------------------------------------------------------

BRANDS = [
    {
        "name": "BYD",
        "slug": "byd",
        "description": (
            "BYD (Build Your Dreams) is China's largest electric vehicle manufacturer "
            "and a global leader in new energy vehicles. Founded in 1995 as a battery "
            "company, BYD expanded into EVs and is now one of the best-selling EV brands "
            "worldwide, with models sold across Europe, Asia, and the Americas."
        ),
        "founded_year": 1995,
        "website": "https://www.byd.com",
        "color": (30, 100, 200),   # deep blue
        "models": [
            {
                "name": "Atto 3",
                "slug": "atto-3",
                "vehicle_type": "suv",
                "year_introduced": 2021,
                "description": (
                    "The BYD Atto 3 (also known as Yuan Plus) is a compact electric SUV "
                    "powered by BYD's Blade Battery technology. It offers up to 420 km of "
                    "range and a 150 kW electric motor, making it one of BYD's most popular "
                    "international models."
                ),
                "engine_type": "BEV – 150 kW electric motor",
                "horsepower": 204,
                "acceleration": "7.3",
                "top_speed": 160,
                "price_range": "130 000 – 175 000 PLN",
                "is_featured": True,
            },
            {
                "name": "Seal",
                "slug": "seal",
                "vehicle_type": "sedan",
                "year_introduced": 2022,
                "description": (
                    "The BYD Seal is a premium electric sedan built on the e-Platform 3.0 "
                    "with 800V fast-charging architecture. It competes directly with the Tesla "
                    "Model 3 and delivers up to 570 km WLTP range in the RWD version."
                ),
                "engine_type": "BEV – rear- or all-wheel drive",
                "horsepower": 313,
                "acceleration": "5.9",
                "top_speed": 180,
                "price_range": "155 000 – 205 000 PLN",
                "is_featured": True,
            },
            {
                "name": "Tang",
                "slug": "tang",
                "vehicle_type": "suv",
                "year_introduced": 2018,
                "description": (
                    "The BYD Tang is a full-size electric and plug-in hybrid SUV offering "
                    "seating for up to 7 passengers. The fully electric version delivers "
                    "up to 505 km of range with dual-motor AWD and 380 kW combined output."
                ),
                "engine_type": "BEV / PHEV – dual-motor AWD",
                "horsepower": 517,
                "acceleration": "4.6",
                "top_speed": 180,
                "price_range": "240 000 – 290 000 PLN",
                "is_featured": False,
            },
        ],
    },
    {
        "name": "Nio",
        "slug": "nio",
        "description": (
            "Nio is a premium Chinese electric vehicle brand founded in 2014, known for its "
            "innovative battery-swap technology that lets drivers exchange a depleted battery "
            "for a fully charged one in under 5 minutes. Nio operates in China, Germany, "
            "the Netherlands, Sweden, Denmark, and Norway."
        ),
        "founded_year": 2014,
        "website": "https://www.nio.com",
        "color": (20, 160, 140),   # teal
        "models": [
            {
                "name": "ET5",
                "slug": "et5",
                "vehicle_type": "sedan",
                "year_introduced": 2022,
                "description": (
                    "The Nio ET5 is a mid-size electric sedan packed with LIDAR-based "
                    "autonomous driving hardware. Available with 75 kWh and 100 kWh battery "
                    "packs (or via battery-swap), it offers up to 590 km WLTP range."
                ),
                "engine_type": "BEV – 360 kW dual-motor AWD",
                "horsepower": 489,
                "acceleration": "4.3",
                "top_speed": 200,
                "price_range": "230 000 – 280 000 PLN",
                "is_featured": True,
            },
            {
                "name": "EL6",
                "slug": "el6",
                "vehicle_type": "suv",
                "year_introduced": 2022,
                "description": (
                    "The Nio EL6 (ES6 in some markets) is a 5-seat electric SUV with "
                    "sleek fastback styling. It supports Nio's battery-swap network and "
                    "comes with full ADAS capability including highway pilot."
                ),
                "engine_type": "BEV – 340 kW dual-motor AWD",
                "horsepower": 462,
                "acceleration": "4.5",
                "top_speed": 200,
                "price_range": "250 000 – 295 000 PLN",
                "is_featured": False,
            },
        ],
    },
    {
        "name": "Xpeng",
        "slug": "xpeng",
        "description": (
            "Xpeng (also written as XPENG or 小鹏汽车) is a Chinese smart EV manufacturer "
            "founded in 2014 and listed on the NYSE. The company is known for its in-house "
            "developed XNGP autonomous driving system and strong software integration, "
            "targeting tech-savvy EV buyers."
        ),
        "founded_year": 2014,
        "website": "https://www.xpeng.com",
        "color": (200, 50, 50),    # red
        "models": [
            {
                "name": "P7",
                "slug": "p7",
                "vehicle_type": "sedan",
                "year_introduced": 2020,
                "description": (
                    "The Xpeng P7 is a sleek all-electric sports sedan featuring a drag "
                    "coefficient of only 0.236 Cd. It delivers over 480 km of range and "
                    "supports Xpeng's XPILOT highway and city autonomous driving."
                ),
                "engine_type": "BEV – rear or all-wheel drive",
                "horsepower": 316,
                "acceleration": "4.3",
                "top_speed": 170,
                "price_range": "170 000 – 220 000 PLN",
                "is_featured": True,
            },
            {
                "name": "G9",
                "slug": "g9",
                "vehicle_type": "suv",
                "year_introduced": 2022,
                "description": (
                    "The Xpeng G9 is a large electric SUV with 800V ultra-fast charging "
                    "(up to 300 kW), enabling a 200 km top-up in just 5 minutes. It seats "
                    "five and supports full XNGP autonomous driving on compatible roads."
                ),
                "engine_type": "BEV – 405 kW dual-motor AWD",
                "horsepower": 551,
                "acceleration": "3.9",
                "top_speed": 200,
                "price_range": "240 000 – 300 000 PLN",
                "is_featured": False,
            },
        ],
    },
    {
        "name": "Li Auto",
        "slug": "li-auto",
        "description": (
            "Li Auto (理想汽车) is a Chinese EV company founded in 2015 specialising in "
            "extended-range electric vehicles (EREV). Its range-extender approach eliminates "
            "range anxiety while charging infrastructure grows. Li Auto became one of the "
            "fastest-growing EV startups in China and listed on Nasdaq in 2020."
        ),
        "founded_year": 2015,
        "website": "https://www.lixiang.com",
        "color": (180, 120, 20),   # golden
        "models": [
            {
                "name": "L9",
                "slug": "l9",
                "vehicle_type": "suv",
                "year_introduced": 2022,
                "description": (
                    "The Li Auto L9 is a flagship 6-seat large SUV with an extended-range "
                    "electric drivetrain. The 1.5T range extender tops up a 44.5 kWh battery, "
                    "giving a combined range of over 1 000 km and all-terrain AWD capability."
                ),
                "engine_type": "EREV – 330 kW dual-motor + 1.5T range extender",
                "horsepower": 449,
                "acceleration": "5.3",
                "top_speed": 180,
                "price_range": "270 000 – 310 000 PLN",
                "is_featured": True,
            },
            {
                "name": "L7",
                "slug": "l7",
                "vehicle_type": "suv",
                "year_introduced": 2023,
                "description": (
                    "The Li Auto L7 is a 5-seat mid-size SUV sharing the EREV architecture "
                    "with its larger siblings. It targets family buyers seeking long-range "
                    "capability without compromising on interior space or advanced technology."
                ),
                "engine_type": "EREV – 260 kW + 1.5T range extender",
                "horsepower": 354,
                "acceleration": "5.3",
                "top_speed": 180,
                "price_range": "240 000 – 275 000 PLN",
                "is_featured": False,
            },
        ],
    },
    {
        "name": "Haval",
        "slug": "haval",
        "description": (
            "Haval is Great Wall Motor's dedicated SUV brand and one of the best-selling "
            "SUV marques in China. Established as a standalone brand in 2013, Haval now "
            "exports to over 60 countries. Its H-series and Jolion models dominate the "
            "affordable SUV segment across Eastern Europe and the Middle East."
        ),
        "founded_year": 2013,
        "website": "https://www.haval.com",
        "color": (20, 120, 60),    # green
        "models": [
            {
                "name": "H6",
                "slug": "h6",
                "vehicle_type": "suv",
                "year_introduced": 2011,
                "description": (
                    "The Haval H6 is China's best-selling SUV for over a decade. The current "
                    "generation uses a 1.5T or 2.0T turbo engine paired with a 7-speed DCT. "
                    "A hybrid version achieves fuel consumption of just 5.5 L/100 km."
                ),
                "engine_type": "ICE – 2.0T / HEV",
                "horsepower": 197,
                "acceleration": "8.5",
                "top_speed": 185,
                "fuel_consumption": "5.5",
                "price_range": "110 000 – 145 000 PLN",
                "is_featured": True,
            },
            {
                "name": "Jolion",
                "slug": "jolion",
                "vehicle_type": "crossover",
                "year_introduced": 2021,
                "description": (
                    "The Haval Jolion is a compact crossover built on GWM's Lemon platform. "
                    "It is offered in standard, hybrid, and plug-in hybrid versions. The PHEV "
                    "variant claims a combined range of over 1 100 km."
                ),
                "engine_type": "ICE / PHEV – 1.5T",
                "horsepower": 150,
                "acceleration": "9.5",
                "top_speed": 180,
                "fuel_consumption": "6.2",
                "price_range": "95 000 – 130 000 PLN",
                "is_featured": False,
            },
        ],
    },
    {
        "name": "MG",
        "slug": "mg",
        "description": (
            "MG (Morris Garages) was a beloved British sports car brand, now owned by "
            "SAIC Motor since 2007. Under Chinese ownership MG reinvented itself as a "
            "modern EV and affordable car brand with strong sales in Europe, Australia, "
            "and Southeast Asia. The MG4 Electric was Europe's best-selling Chinese EV in 2023."
        ),
        "founded_year": 1924,
        "website": "https://www.mgmotor.eu",
        "color": (180, 20, 20),    # burgundy red
        "models": [
            {
                "name": "MG4 Electric",
                "slug": "mg4-electric",
                "vehicle_type": "hatchback",
                "year_introduced": 2022,
                "description": (
                    "The MG4 Electric is a compact 5-door hatchback EV built on MG's new "
                    "MSP (Modular Scalable Platform). Rear-wheel drive variants offer up to "
                    "435 km WLTP range. The XPOWER dual-motor version hits 100 km/h in 3.8 s."
                ),
                "engine_type": "BEV – 150 kW / 320 kW XPOWER",
                "horsepower": 204,
                "acceleration": "7.9",
                "top_speed": 160,
                "price_range": "115 000 – 165 000 PLN",
                "is_featured": True,
            },
            {
                "name": "ZS EV",
                "slug": "zs-ev",
                "vehicle_type": "suv",
                "year_introduced": 2019,
                "description": (
                    "The MG ZS EV is a compact electric SUV and one of the most affordable "
                    "EVs on the European market. The refreshed long-range model provides "
                    "up to 440 km WLTP range and 115 kW of power."
                ),
                "engine_type": "BEV – 115 kW",
                "horsepower": 156,
                "acceleration": "8.6",
                "top_speed": 175,
                "price_range": "110 000 – 135 000 PLN",
                "is_featured": False,
            },
        ],
    },
    {
        "name": "Geely",
        "slug": "geely",
        "description": (
            "Geely Auto (吉利汽车) is one of China's largest private car manufacturers, "
            "founded in 1986. The group owns Volvo Cars, Polestar, Lynk & Co, Lotus, "
            "and a stake in Daimler. Geely's own-brand lineup spans affordable ICE vehicles "
            "through to premium EVs under the Galaxy and Zeekr sub-brands."
        ),
        "founded_year": 1986,
        "website": "https://www.geely.com",
        "color": (0, 70, 160),     # royal blue
        "models": [
            {
                "name": "Emgrand",
                "slug": "emgrand",
                "vehicle_type": "sedan",
                "year_introduced": 2009,
                "description": (
                    "The Geely Emgrand is a compact sedan and one of Geely's longest-running "
                    "nameplates. The latest generation uses a 1.5T engine paired with a "
                    "7-speed DCT and targets the value-conscious buyer in emerging markets."
                ),
                "engine_type": "ICE – 1.5T 110 kW",
                "horsepower": 150,
                "acceleration": "9.5",
                "top_speed": 185,
                "fuel_consumption": "6.5",
                "price_range": "70 000 – 95 000 PLN",
                "is_featured": False,
            },
            {
                "name": "Galaxy L7",
                "slug": "galaxy-l7",
                "vehicle_type": "suv",
                "year_introduced": 2023,
                "description": (
                    "The Geely Galaxy L7 is a mid-size PHEV SUV under Geely's premium "
                    "Galaxy sub-brand. It uses the Thor Hi-X hybrid system with a 1.5T engine "
                    "and large 19.1 kWh battery for over 120 km of pure electric range."
                ),
                "engine_type": "PHEV – Thor Hi-X 1.5T + 135 kW motor",
                "horsepower": 340,
                "acceleration": "6.9",
                "top_speed": 190,
                "fuel_consumption": "1.3",
                "price_range": "140 000 – 185 000 PLN",
                "is_featured": True,
            },
        ],
    },
    {
        "name": "Chery",
        "slug": "chery",
        "description": (
            "Chery Automobile (奇瑞汽车) is a state-owned Chinese car manufacturer founded "
            "in 1997 and headquartered in Wuhu, Anhui. Chery is the most exported Chinese "
            "car brand globally and operates sub-brands including Exeed, Jetour, and Jaecoo. "
            "Its vehicles are sold in over 80 countries worldwide."
        ),
        "founded_year": 1997,
        "website": "https://www.cheryinternational.com",
        "color": (150, 30, 180),   # purple
        "models": [
            {
                "name": "Tiggo 8 Pro",
                "slug": "tiggo-8-pro",
                "vehicle_type": "suv",
                "year_introduced": 2020,
                "description": (
                    "The Chery Tiggo 8 Pro is a 7-seat SUV available with 1.6T and 2.0T "
                    "turbocharged engines, as well as a PHEV variant. It features a large "
                    "panoramic sunroof, three-row seating, and a 25.6-inch dual-screen dashboard."
                ),
                "engine_type": "ICE / PHEV – 1.6T / 2.0T",
                "horsepower": 254,
                "acceleration": "7.5",
                "top_speed": 185,
                "fuel_consumption": "7.8",
                "price_range": "120 000 – 165 000 PLN",
                "is_featured": True,
            },
            {
                "name": "Omoda 5",
                "slug": "omoda-5",
                "vehicle_type": "crossover",
                "year_introduced": 2022,
                "description": (
                    "The Chery Omoda 5 is a sporty compact crossover from Chery's international "
                    "sub-brand. Available in ICE (1.6T) and full-electric versions, it targets "
                    "young urban buyers with expressive styling and connected tech."
                ),
                "engine_type": "ICE / BEV – 1.6T / 150 kW",
                "horsepower": 204,
                "acceleration": "7.6",
                "top_speed": 185,
                "fuel_consumption": "7.2",
                "price_range": "105 000 – 145 000 PLN",
                "is_featured": False,
            },
        ],
    },
    {
        "name": "GAC Aion",
        "slug": "gac-aion",
        "description": (
            "GAC Aion is the electric vehicle sub-brand of GAC Group (Guangzhou Automobile "
            "Corporation), one of China's largest state-owned automakers. Launched in 2017, "
            "Aion focuses exclusively on battery-electric vehicles and is China's "
            "third-largest EV brand by sales volume."
        ),
        "founded_year": 2017,
        "website": "https://www.aion.gac.com.cn",
        "color": (0, 160, 220),    # sky blue
        "models": [
            {
                "name": "Aion S",
                "slug": "aion-s",
                "vehicle_type": "sedan",
                "year_introduced": 2019,
                "description": (
                    "The GAC Aion S is a compact electric sedan and one of China's best-selling "
                    "EVs. The 2023 model offers up to 603 km CLTC range, fast DC charging, "
                    "and a connected cockpit powered by Qualcomm 8155."
                ),
                "engine_type": "BEV – 130 kW",
                "horsepower": 177,
                "acceleration": "7.9",
                "top_speed": 150,
                "price_range": "90 000 – 125 000 PLN",
                "is_featured": False,
            },
            {
                "name": "Aion V",
                "slug": "aion-v",
                "vehicle_type": "suv",
                "year_introduced": 2020,
                "description": (
                    "The GAC Aion V is a mid-size electric SUV with LiDAR-based ADiGO PILOT "
                    "autonomous driving system. It supports 80 kW DC fast charging and is "
                    "available in long-range (up to 600 km CLTC) and performance variants."
                ),
                "engine_type": "BEV – 150 kW",
                "horsepower": 204,
                "acceleration": "8.0",
                "top_speed": 185,
                "price_range": "115 000 – 155 000 PLN",
                "is_featured": True,
            },
        ],
    },
    {
        "name": "Changan",
        "slug": "changan",
        "description": (
            "Changan Automobile (长安汽车) is one of China's four largest state-owned car "
            "groups, tracing its roots to an arsenal founded in 1862. Today Changan is a "
            "leading producer of passenger cars and commercial vehicles, and the parent of "
            "the premium Deepal and Avatr EV brands (developed with CATL and Huawei)."
        ),
        "founded_year": 1862,
        "website": "https://www.changan.com.cn",
        "color": (20, 20, 100),    # dark navy
        "models": [
            {
                "name": "CS75 Plus",
                "slug": "cs75-plus",
                "vehicle_type": "suv",
                "year_introduced": 2019,
                "description": (
                    "The Changan CS75 Plus is a 5-seat compact SUV and one of China's "
                    "top-selling domestic models. The Blue Whale 2.0T engine produces 233 hp, "
                    "paired with an 8-speed automatic for smooth highway cruising."
                ),
                "engine_type": "ICE – Blue Whale 2.0T",
                "horsepower": 233,
                "acceleration": "7.9",
                "top_speed": 195,
                "fuel_consumption": "7.5",
                "price_range": "105 000 – 140 000 PLN",
                "is_featured": False,
            },
            {
                "name": "Deepal S7",
                "slug": "deepal-s7",
                "vehicle_type": "suv",
                "year_introduced": 2023,
                "description": (
                    "The Deepal S7 is Changan's premium EV SUV under its Deepal sub-brand. "
                    "Built on an 800V platform, it supports 4C ultra-fast charging, delivering "
                    "400 km of range in around 10 minutes at compatible stations."
                ),
                "engine_type": "BEV – 160 kW / 250 kW AWD",
                "horsepower": 340,
                "acceleration": "4.9",
                "top_speed": 200,
                "price_range": "175 000 – 220 000 PLN",
                "is_featured": True,
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_placeholder_png(name: str, color: tuple) -> bytes:
    """Generate a 256×256 PNG brand logo with solid background and initials."""
    size = 256
    img = Image.new("RGB", (size, size), color=color)
    draw = ImageDraw.Draw(img)

    # Gradient-ish overlay: lighten top-left to bottom-right
    for i in range(size):
        for j in range(size):
            blend = int((i + j) / (2 * size) * 60)
            r = min(255, color[0] + blend)
            g = min(255, color[1] + blend)
            b = min(255, color[2] + blend)
            img.putpixel((j, i), (r, g, b))

    # Draw ring
    margin = 20
    ring_width = 6
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        outline=(255, 255, 255, 180),
        width=ring_width,
    )

    # Initials (first letter of each word, max 2)
    words = name.upper().split()
    initials = "".join(w[0] for w in words)[:2]

    # Try loading a bundled font; fall back to default
    font = None
    font_size = 96 if len(initials) == 1 else 72
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except (IOError, OSError):
        try:
            import matplotlib.font_manager as fm  # noqa: F401
            font_path = fm.findfont(fm.FontProperties(family="DejaVu Sans"))
            font = ImageFont.truetype(font_path, font_size)
        except Exception:
            font = ImageFont.load_default()

    # Center text
    if hasattr(draw, "textbbox"):
        bbox = draw.textbbox((0, 0), initials, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
    else:
        tw, th = draw.textsize(initials, font=font)  # type: ignore[attr-defined]

    x = (size - tw) / 2
    y = (size - th) / 2

    # Shadow
    draw.text((x + 3, y + 3), initials, fill=(0, 0, 0, 80), font=font)
    # Main text
    draw.text((x, y), initials, fill=(255, 255, 255), font=font)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class Command(BaseCommand):
    help = "Seed the database with Chinese car brands and sample models"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing brands and models before seeding",
        )

    def handle(self, *args, **options):
        if not PILLOW_OK:
            self.stderr.write(
                self.style.ERROR(
                    "Pillow is not installed. Run: pip install Pillow"
                )
            )
            return

        if options["reset"]:
            self.stdout.write("Deleting existing brands and models…")
            CarModel.objects.all().delete()
            Brand.objects.all().delete()

        created_brands = 0
        created_models = 0
        skipped_brands = 0
        skipped_models = 0

        for brand_data in BRANDS:
            models_data = brand_data.pop("models")
            color = brand_data.pop("color")

            brand, brand_created = Brand.objects.get_or_create(
                slug=brand_data["slug"],
                defaults={k: v for k, v in brand_data.items()},
            )

            if brand_created:
                # Generate and attach placeholder logo
                png_bytes = make_placeholder_png(brand.name, color)
                filename = f"{brand.slug}_placeholder.png"
                brand.logo.save(filename, ContentFile(png_bytes), save=True)
                created_brands += 1
                self.stdout.write(
                    self.style.SUCCESS(f"  ✓ Created brand: {brand.name}")
                )
            else:
                skipped_brands += 1
                self.stdout.write(f"  – Brand already exists: {brand.name}")
                # Re-attach the models_data for iteration below
                brand_data["models"] = models_data  # restore for clarity

            for m in models_data:
                is_featured = m.pop("is_featured", False)
                _, model_created = CarModel.objects.get_or_create(
                    brand=brand,
                    name=m["name"],
                    year_introduced=m["year_introduced"],
                    defaults={**m, "is_featured": is_featured},
                )
                if model_created:
                    created_models += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"      ✓ Added model: {brand.name} {m['name']}"
                        )
                    )
                else:
                    skipped_models += 1
                    self.stdout.write(
                        f"      – Model already exists: {brand.name} {m['name']}"
                    )

            # Restore key for next iteration safety
            brand_data["models"] = models_data

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Brands: {created_brands} created, {skipped_brands} skipped. "
                f"Models: {created_models} created, {skipped_models} skipped."
            )
        )
