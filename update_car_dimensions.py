"""
Update car body dimensions on production via admin API (same workflow as update_car_price.py).

Usage:
    python update_car_dimensions.py
"""
import os
import sys

import requests

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT_DIR, 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'portal_project.settings')

import django  # noqa: E402

django.setup()

from apps.cars.dimension_data import get_dimensions_for_model  # noqa: E402

API_BASE = 'https://autachin.pl/api'
ADMIN_USERNAME = os.environ.get('PORTAL_ADMIN_USER', 'admin')
ADMIN_PASSWORD = os.environ.get('PORTAL_ADMIN_PASSWORD', 'Admin@123')


def get_admin_headers():
    login_response = requests.post(
        f'{API_BASE}/users/token/',
        json={'username': ADMIN_USERNAME, 'password': ADMIN_PASSWORD},
        timeout=30,
    )
    if login_response.status_code != 200:
        raise RuntimeError(f'Login failed: {login_response.status_code} {login_response.text}')
    token = login_response.json().get('access')
    return {'Authorization': f'Bearer {token}'}


def fetch_all_cars(headers):
    cars = []
    url = f'{API_BASE}/cars/?page_size=100'
    while url:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        payload = response.json()
        cars.extend(payload.get('results', payload))
        url = payload.get('next')
    return cars


def main():
    headers = get_admin_headers()
    cars = fetch_all_cars(headers)

    updated = 0
    skipped = []

    for car in cars:
        dimensions = get_dimensions_for_model(slug=car.get('slug', ''), name=car.get('name', ''))
        if not dimensions:
            skipped.append(f"{car.get('brand_name', '?')} {car.get('name', '?')} ({car.get('slug', '?')})")
            continue

        length_mm, width_mm, height_mm = dimensions
        response = requests.patch(
            f"{API_BASE}/cars/{car['id']}/",
            json={
                'length_mm': length_mm,
                'width_mm': width_mm,
                'height_mm': height_mm,
            },
            headers=headers,
            timeout=30,
        )

        if response.status_code == 200:
            updated += 1
            print(f"OK {car.get('brand_name')} {car.get('name')}: {length_mm} x {width_mm} x {height_mm} mm")
        else:
            print(f"FAIL {car.get('brand_name')} {car.get('name')}: {response.status_code} {response.text[:200]}")

    print(f'\nUpdated: {updated}')
    if skipped:
        print('Skipped (no dimension mapping):')
        for item in skipped:
            print(f'  - {item}')


if __name__ == '__main__':
    main()
