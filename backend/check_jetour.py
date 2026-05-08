#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'portal_project.settings')
django.setup()

from apps.cars.models import Brand

try:
    jetour = Brand.objects.get(slug='jetour')
    print(f"Jetour logo field: '{jetour.logo}'")
    print(f"Jetour logo name: {jetour.logo.name if jetour.logo else 'None'}")
    print(f"Logo exists: {bool(jetour.logo)}")
except Exception as e:
    print(f"Error: {e}")
