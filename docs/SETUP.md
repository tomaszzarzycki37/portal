# Development Setup Guide

## Prerequisites

- Python 3.9 or higher
- Node.js 16 or higher
- PostgreSQL 12 or higher
- Git

## Backend Setup

### 1. Create Python Virtual Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Setup Environment Variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Database Migration

```bash
python manage.py migrate
```

### 5. Create Superuser

```bash
python manage.py createsuperuser
# Follow prompts to create admin user
```

### 6. Collect Static Files (Optional for development)

```bash
python manage.py collectstatic --noinput
```

### 7. Run Development Server

```bash
python manage.py runserver
```

Backend will be available at `http://localhost:8000`

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create `.env.local` file:

```
VITE_API_URL=http://localhost:8000/api
```

### 3. Run Development Server

```bash
npm run dev
```

Frontend will be available at `http://localhost:5173`

## Admin Panel

- URL: `http://localhost:8000/admin`
- Username/Password: Created during superuser setup

### Initial Admin Tasks

1. Add car brands
2. Add car models
3. Configure any settings

## Testing the Application

### Backend API Endpoints

- List cars: `GET http://localhost:8000/api/cars/`
- List opinions: `GET http://localhost:8000/api/opinions/`
- User registration: `POST http://localhost:8000/api/users/`
- Token login: `POST http://localhost:8000/api/users/token/`

### API Documentation

Visit `http://localhost:8000/api/docs/` for interactive API documentation.

## Common Development Tasks

### Creating a new app

```bash
python manage.py startapp myapp apps/myapp
```

### Running tests

```bash
pytest
```

### Database reset (WARNING: Deletes all data)

```bash
python manage.py migrate zero
python manage.py migrate
```

### Shell access

```bash
python manage.py shell
```

## Troubleshooting

### Database connection errors

- Ensure PostgreSQL is running
- Check DATABASE_URL in `.env`
- Verify database user permissions

### CORS errors

- Update CORS_ALLOWED_ORIGINS in settings.py
- Ensure frontend URL matches allowed origins

### Port already in use

- Change port: `python manage.py runserver 8080`
- Find and kill process using the port

## Performance Tips

- Use browser dev tools to check bundle size
- Profile database queries with Django Debug Toolbar
- Enable caching for frequently accessed data
- Use pagination for large result sets

For more information, see DEPLOYMENT.md for production setup.
