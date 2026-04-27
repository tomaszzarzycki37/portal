"""Seed sample press reviews with test results and image links.

Usage:
    python manage.py seed_press_reviews
    python manage.py seed_press_reviews --reset
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.cars.models import CarModel
from apps.opinions.models import PressReview


SAMPLE_REVIEWS = [
    {
        "brand_slug": "byd",
        "model_slug": "seal",
        "title": "BYD Seal 82.5 kWh - Long Range Test and Road Manners",
        "summary": "A practical long-distance test of BYD Seal with charging and comfort metrics.",
        "content": (
            "Overview\n"
            "The BYD Seal was tested on a mixed route (city, motorway, country roads) over 420 km. "
            "The car remained stable at speed, and cabin insulation was above average in this segment.\n\n"
            "Example photo gallery\n"
            "1. https://picsum.photos/seed/byd-seal-front/1280/720\n"
            "2. https://picsum.photos/seed/byd-seal-side/1280/720\n"
            "3. https://picsum.photos/seed/byd-seal-interior/1280/720\n\n"
            "Test results\n"
            "- 0-100 km/h (measured): 5.8 s\n"
            "- 100-0 km/h braking distance: 36.4 m\n"
            "- Real-world consumption (mixed): 16.8 kWh/100 km\n"
            "- Real-world motorway range (120 km/h): 385 km\n"
            "- DC charging 10-80%: 33 min\n\n"
            "Verdict\n"
            "The Seal combines competitive efficiency with predictable handling and strong value for money."
        ),
        "publication_name": "Portal Test Lab",
        "publication_url": "https://example.com/reviews/byd-seal-long-range-test",
        "author_name": "Tomasz Kowalski",
        "published_at": "2026-04-18",
        "is_featured": True,
        "is_published": True,
    },
    {
        "brand_slug": "byd",
        "model_slug": "atto-3",
        "title": "BYD Atto 3 Family Test - Urban SUV in Daily Use",
        "summary": "Seven-day city and suburban test focused on practicality and charging behavior.",
        "content": (
            "Overview\n"
            "BYD Atto 3 was evaluated as a family commuter with child seats, shopping load, and mixed weather. "
            "Visibility and turning radius were highlights in dense city traffic.\n\n"
            "Example photo gallery\n"
            "1. https://picsum.photos/seed/atto3-front/1280/720\n"
            "2. https://picsum.photos/seed/atto3-trunk/1280/720\n"
            "3. https://picsum.photos/seed/atto3-cabin/1280/720\n\n"
            "Test results\n"
            "- 0-100 km/h (measured): 7.5 s\n"
            "- 80-120 km/h kickdown: 5.4 s\n"
            "- Real-world city consumption: 14.9 kWh/100 km\n"
            "- Real-world mixed range: 365 km\n"
            "- AC charging 20-100% (11 kW wallbox): 5 h 20 min\n\n"
            "Verdict\n"
            "Atto 3 is a user-friendly EV SUV with good efficiency and a cabin that works well for daily family duties."
        ),
        "publication_name": "EV Roadbook",
        "publication_url": "https://example.com/reviews/byd-atto3-family-test",
        "author_name": "Anna Nowak",
        "published_at": "2026-04-12",
        "is_featured": True,
        "is_published": True,
    },
    {
        "brand_slug": "nio",
        "model_slug": "et5",
        "title": "Nio ET5 Highway and Battery-Swap Benchmark",
        "summary": "Premium EV sedan benchmark including motorway efficiency and battery-swap timing.",
        "content": (
            "Overview\n"
            "Nio ET5 was tested on a 600 km highway route with one battery swap and one DC charging stop. "
            "Ride comfort at 140 km/h and lane-keeping performance were key evaluation points.\n\n"
            "Example photo gallery\n"
            "1. https://picsum.photos/seed/nio-et5-front/1280/720\n"
            "2. https://picsum.photos/seed/nio-et5-highway/1280/720\n"
            "3. https://picsum.photos/seed/nio-et5-cockpit/1280/720\n\n"
            "Test results\n"
            "- 0-100 km/h (measured): 4.4 s\n"
            "- 100-0 km/h braking distance: 35.2 m\n"
            "- Real-world motorway consumption (130 km/h): 19.6 kWh/100 km\n"
            "- Battery-swap station total stop time: 6 min 40 s\n"
            "- DC charging 20-80%: 27 min\n\n"
            "Verdict\n"
            "ET5 delivers strong performance and comfort, with battery swap offering a real advantage on long trips."
        ),
        "publication_name": "China Auto Insights",
        "publication_url": "https://example.com/reviews/nio-et5-benchmark",
        "author_name": "Marek Wisniewski",
        "published_at": "2026-04-09",
        "is_featured": False,
        "is_published": True,
    },
    {
        "brand_slug": "mg",
        "model_slug": "mg4-electric",
        "title": "MG4 Electric 64 kWh - Compact EV Track and Efficiency Test",
        "summary": "A combined circuit handling session and real-road efficiency run for MG4 Electric.",
        "content": (
            "Overview\n"
            "MG4 Electric completed a closed-track handling loop and 300 km public-road efficiency run. "
            "Steering response and rear-axle stability were notable positives for a compact hatchback.\n\n"
            "Example photo gallery\n"
            "1. https://picsum.photos/seed/mg4-front/1280/720\n"
            "2. https://picsum.photos/seed/mg4-track/1280/720\n"
            "3. https://picsum.photos/seed/mg4-dashboard/1280/720\n\n"
            "Test results\n"
            "- 0-100 km/h (measured): 7.6 s\n"
            "- Slalom (18 m cones): 67.8 km/h average\n"
            "- Real-world mixed consumption: 15.2 kWh/100 km\n"
            "- Real-world range (mixed): 402 km\n"
            "- DC charging 10-80%: 31 min\n\n"
            "Verdict\n"
            "MG4 is one of the best-balanced compact EVs in its class, with engaging handling and low running cost."
        ),
        "publication_name": "Green Motoring Journal",
        "publication_url": "https://example.com/reviews/mg4-compact-ev-test",
        "author_name": "Piotr Zielinski",
        "published_at": "2026-04-05",
        "is_featured": False,
        "is_published": True,
    },
]


class Command(BaseCommand):
    help = "Seed 4 sample press reviews with image URLs and test-result data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete previously seeded sample reviews before re-seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        reset = options.get("reset", False)
        seeded_titles = [review["title"] for review in SAMPLE_REVIEWS]

        if reset:
            deleted_count, _ = PressReview.objects.filter(title__in=seeded_titles).delete()
            self.stdout.write(self.style.WARNING(f"Deleted {deleted_count} seeded review records."))

        created_count = 0
        updated_count = 0
        skipped_count = 0

        for review_data in SAMPLE_REVIEWS:
            brand_slug = review_data["brand_slug"]
            model_slug = review_data["model_slug"]

            car_model = CarModel.objects.filter(
                brand__slug=brand_slug,
                slug=model_slug,
            ).first()

            if not car_model:
                # Fallback to any available model from the same brand.
                car_model = CarModel.objects.filter(brand__slug=brand_slug).order_by("name").first()

                if not car_model:
                    skipped_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"Skipped '{review_data['title']}' (missing car model: {brand_slug}/{model_slug})."
                        )
                    )
                    continue

                self.stdout.write(
                    self.style.WARNING(
                        f"Model '{brand_slug}/{model_slug}' not found. "
                        f"Using fallback model '{car_model.brand.slug}/{car_model.slug}' for '{review_data['title']}'."
                    )
                )

            defaults = {
                "summary": review_data["summary"],
                "content": review_data["content"],
                "publication_url": review_data["publication_url"],
                "author_name": review_data["author_name"],
                "published_at": review_data["published_at"],
                "is_featured": review_data["is_featured"],
                "is_published": review_data["is_published"],
            }

            review_obj, created = PressReview.objects.update_or_create(
                car_model=car_model,
                title=review_data["title"],
                publication_name=review_data["publication_name"],
                defaults=defaults,
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created: {review_obj.title}"))
            else:
                updated_count += 1
                self.stdout.write(f"Updated: {review_obj.title}")

        self.stdout.write("-")
        self.stdout.write(self.style.SUCCESS("Sample press review seeding completed."))
        self.stdout.write(f"Created: {created_count}")
        self.stdout.write(f"Updated: {updated_count}")
        self.stdout.write(f"Skipped: {skipped_count}")
