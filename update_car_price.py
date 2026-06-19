import requests
import json

# Get admin token
login_response = requests.post('https://autachin.pl/api/users/token/', json={'username': 'admin', 'password': 'Admin@123'})
if login_response.status_code == 200:
    token = login_response.json().get('access')
    headers = {'Authorization': f'Bearer {token}'}
    
    # Update car with price data
    response = requests.patch('https://autachin.pl/api/cars/25/', json={'price_min': 250000, 'price_max': 380000, 'currency': 'CNY'}, headers=headers)
    if response.status_code == 200:
        car = response.json()
        print('✅ Car updated successfully!')
        print(json.dumps({k: car.get(k) for k in ['id', 'name', 'price_min', 'price_max', 'currency', 'price_range_display']}, indent=2))
    else:
        print(f'Error: {response.status_code}')
        print(response.text)
