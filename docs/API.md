# API Documentation

## Base URL

- Development: `http://localhost:8000/api`
- Production: `https://yourdomain.com/api`

Interactive API documentation available at `/api/docs/`

## Authentication

All endpoints requiring authentication use JWT (JSON Web Tokens).

### Getting a Token

```bash
POST /users/token/

{
  "username": "user@example.com",
  "password": "password123"
}

Response:
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Refreshing a Token

```bash
POST /users/token/refresh/

{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Using Token in Requests

Include token in Authorization header:

```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

## Endpoints

### Cars

#### List Cars

```
GET /cars/
```

Example request:

```bash
curl "http://localhost:8000/api/cars/?vehicle_type=suv&search=byd&page=1"
```

Query Parameters:
- `brand` - Filter by brand ID
- `vehicle_type` - Filter by vehicle type (sedan, suv, crossover, etc.)
- `year_introduced` - Filter by year
- `search` - Search by name or description
- `page` - Page number (default: 1)

Response:

```json
{
  "count": 150,
  "next": "http://...",
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "Model S",
      "brand_name": "Tesla",
      "slug": "model-s",
      "vehicle_type": "sedan",
      "year_introduced": 2012,
      "image": "http://...",
      "price_range": "$50,000 - $100,000",
      "avg_rating": 4.5,
      "opinions_count": 12,
      "is_featured": true
    }
  ]
}
```

#### Get Car Details

```
GET /cars/{id}/
```

Example request:

```bash
curl "http://localhost:8000/api/cars/1/"
```

Response:

```json
{
  "id": 1,
  "name": "Model S",
  "brand": {
    "id": 1,
    "name": "Tesla",
    "slug": "tesla",
    "description": "...",
    "logo": "http://...",
    "founded_year": 2003,
    "website": "https://..."
  },
  "vehicle_type": "sedan",
  "year_introduced": 2012,
  "description": "...",
  "image": "http://...",
  "images": [
    {
      "id": 1,
      "image": "http://...",
      "caption": "Front view"
    }
  ],
  "engine_type": "Electric",
  "horsepower": 325,
  "acceleration": "5.8s",
  "top_speed": 250,
  "fuel_consumption": "0L/100km",
  "price_range": "$50,000 - $100,000",
  "production_status": "active",
  "is_featured": true,
  "avg_rating": 4.5,
  "opinions_count": 12,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Get Car Opinions

```
GET /cars/{id}/opinions/
```

Example request:

```bash
curl "http://localhost:8000/api/cars/1/opinions/"
```

Example response:

```json
[
  {
    "id": 15,
    "car_name": "BYD Seal",
    "title": "Great daily EV",
    "rating": 5,
    "author": {
      "id": 3,
      "username": "driver01",
      "first_name": "Jan",
      "last_name": "Kowalski"
    },
    "helpful_count": 12,
    "unhelpful_count": 1,
    "comments_count": 4,
    "is_verified_owner": true,
    "created_at": "2026-04-20T18:00:00Z"
  }
]
```

#### Featured Cars

```
GET /cars/featured/
```

Example request:

```bash
curl "http://localhost:8000/api/cars/featured/"
```

#### Latest Cars

```
GET /cars/latest/
```

Example request:

```bash
curl "http://localhost:8000/api/cars/latest/"
```

### Opinions

#### List Opinions

```
GET /opinions/
```

Example request:

```bash
curl "http://localhost:8000/api/opinions/?rating=5&ordering=-created_at"
```

Example response:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 15,
      "car_name": "BYD Seal",
      "title": "Great daily EV",
      "rating": 5,
      "author": {
        "id": 3,
        "username": "driver01",
        "first_name": "Jan",
        "last_name": "Kowalski"
      },
      "helpful_count": 12,
      "unhelpful_count": 1,
      "comments_count": 4,
      "is_verified_owner": true,
      "created_at": "2026-04-20T18:00:00Z"
    }
  ]
}
```

Query Parameters:
- `car_model` - Filter by car ID
- `author` - Filter by author ID
- `rating` - Filter by rating (1-5)
- `search` - Search in title/content
- `page` - Page number

#### Create Opinion (Requires Authentication)

```
POST /opinions/

{
  "car_model": 1,
  "title": "Great car!",
  "content": "This is an amazing vehicle...",
  "rating": 5
}
```

Example request:

```bash
curl -X POST "http://localhost:8000/api/opinions/" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "car_model": 1,
    "title": "Great car!",
    "content": "Very comfortable and efficient.",
    "rating": 5
  }'
```

#### Vote on Opinion (Requires Authentication)

```
POST /opinions/{id}/vote/

{
  "vote_type": "helpful"  # or "unhelpful"
}
```

Example request:

```bash
curl -X POST "http://localhost:8000/api/opinions/15/vote/" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"vote_type": "helpful"}'
```

Example response:

```json
{
  "id": 42,
  "vote_type": "helpful",
  "created_at": "2026-04-20T18:30:00Z"
}
```

#### Add Comment (Requires Authentication)

```
POST /opinions/{id}/add_comment/

{
  "content": "I agree, great car!"
}
```

Example request:

```bash
curl -X POST "http://localhost:8000/api/opinions/15/add_comment/" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"content": "I agree with this review."}'
```

#### Top Rated Opinions

```
GET /opinions/top_rated/
```

Example request:

```bash
curl "http://localhost:8000/api/opinions/top_rated/"
```

#### Most Helpful Opinions

```
GET /opinions/most_helpful/
```

Example request:

```bash
curl "http://localhost:8000/api/opinions/most_helpful/"
```

### Users

#### Register

```
POST /users/

{
  "username": "newuser",
  "email": "user@example.com",
  "password": "securepassword123",
  "password2": "securepassword123",
  "first_name": "John",
  "last_name": "Doe"
}
```

Example request:

```bash
curl -X POST "http://localhost:8000/api/users/" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "user@example.com",
    "password": "securepassword123",
    "password2": "securepassword123",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

#### Get Current User

```
GET /users/me/  # Requires authentication
```

Example request:

```bash
curl "http://localhost:8000/api/users/me/" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Example response:

```json
{
  "id": 3,
  "username": "driver01",
  "email": "driver01@example.com",
  "first_name": "Jan",
  "last_name": "Kowalski",
  "profile": {
    "bio": "EV enthusiast",
    "avatar": null,
    "location": "Warsaw",
    "phone": "+48-000-000-000",
    "email_verified": false,
    "is_car_owner": true,
    "created_at": "2026-04-20T17:30:00Z"
  }
}
```

#### Update User Profile

```
POST /users/update_profile/  # Requires authentication

{
  "bio": "Car enthusiast",
  "location": "New York",
  "phone": "+1-555-0000",
  "is_car_owner": true
}
```

Example request:

```bash
curl -X POST "http://localhost:8000/api/users/update_profile/" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Car enthusiast",
    "location": "New York",
    "phone": "+1-555-0000",
    "is_car_owner": true
  }'
```

#### Get User Opinions

```
GET /users/{id}/opinions/
```

Example request:

```bash
curl "http://localhost:8000/api/users/3/opinions/"
```

### Brands

#### List Brands

```
GET /cars/brands/
```

Example request:

```bash
curl "http://localhost:8000/api/cars/brands/"
```

Example response:

```json
[
  {
    "id": 1,
    "name": "BYD",
    "slug": "byd",
    "description": "Chinese EV and hybrid manufacturer",
    "logo": null,
    "founded_year": 1995,
    "website": "https://www.byd.com",
    "created_at": "2026-04-20T10:00:00Z"
  }
]
```

#### Get Brand Details

```
GET /cars/brands/{slug}/
```

Example request:

```bash
curl "http://localhost:8000/api/cars/brands/byd/"
```

## Status Codes

- **200** - OK
- **201** - Created
- **204** - No Content
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **500** - Internal Server Error

## Error Response

```json
{
  "detail": "Authentication credentials were not provided."
}
```

## Rate Limiting

- Unauthenticated: 100 requests per hour
- Authenticated: 1000 requests per hour

## Filtering & Searching

### Example: Get sedans with average rating > 4

```
GET /cars/?vehicle_type=sedan&ordering=-avg_rating
```

### Example: Search for opinions about Tesla

```
GET /opinions/?search=tesla&ordering=-created_at
```

## Pagination

Standard pagination with 20 results per page:

```json
{
  "count": 150,
  "next": "http://api.example.com/cars/?page=2",
  "previous": null,
  "results": [...]
}
```

Change page size:

```
GET /cars/?page=2&page_size=50
```

For more details, visit `/api/docs/` interactive documentation.
