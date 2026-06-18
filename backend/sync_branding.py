#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'portal_project.settings')
django.setup()

from apps.common.models import SiteTextOverride

# Data to sync from PROD
updates = [
    ('nav.brandTitle', 'pl', 'Auta Chin'),
    ('nav.brandTagline', 'pl', 'Gwałtowny wzrost popularności chińskich samochodów zmienił się z żartu o klonowaniu jakości i wzornictwa w globalną rewolucję, a marki takie jak BYD wyprzedzają konkurencję w segmencie pojazdów elektrycznych dzięki rozbudowanym i tanim łańcuchom dostaw. Konsumenci przestają się wahać i decydują się na zakup ze względu na wyższą wartość, pomimo utrzymujących się obaw o niezawodność i ekstremalnie zaawansowane technologicznie interfejsy.'),
    ('home.heroSearchBackgroundUrl', 'pl', '/media/portal/c01f5a9bf9894eb4a8a7d88e1d30a973.jpg'),
    ('home.heroSearchBackgroundUrl', 'en', '/media/portal/c01f5a9bf9894eb4a8a7d88e1d30a973.jpg'),
    ('nav.brandTagline', 'en', 'The rapid rise of Chinese cars has shifted from a joke about quality and design cloning to a global disruption, with brands like BYD overtaking competitors in EVs through intense, low-cost supply chains. Consumers are moving from hesitation to buying due to superior value, despite lingering concerns about reliability and extreme tech-focused interfaces.'),
    ('home.feature1Title', 'en', 'Explore new and old models'),
    ('home.feature1Title', 'pl', 'Wyszukaj nowe i stare modele'),
    ('home.feature2Title', 'en', 'Check the latest opinions'),
    ('home.feature2Title', 'pl', 'Sprawdzaj ostatnie opinie'),
    ('home.feature3Title', 'en', 'Registered accounts are allowed to add comments and their own articles'),
    ('home.feature3Title', 'pl', 'Zarejestrowani mogą dodawać swoje opinie i napisać własne artykuły'),
    ('home.feature3Text', 'en', 'Add your own article and opinion about the new and old car models'),
    ('home.feature3Text', 'pl', 'Dodaj swój artykuł i swoją opinie na temat nowych i starych modeli samochodów'),
]

for key, lang, value in updates:
    obj, created = SiteTextOverride.objects.update_or_create(
        key=key,
        lang=lang,
        defaults={'value': value}
    )
    print(f"{'Created' if created else 'Updated'}: {key} ({lang})")

print("\n✓ Branding sync complete!")
