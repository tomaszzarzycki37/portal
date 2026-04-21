# Chinese Cars Portal - Semi-Professional Website Engine

A modern full-stack web application built with Django, React, and PostgreSQL for showcasing Chinese car brands and user opinions with comprehensive admin controls.

## Features

- **Car Database**: Comprehensive listing of Chinese car brands and models
- **User Opinions**: Community-driven reviews and ratings system
- **Admin Dashboard**: Full control panel for managing content
- **Authentication**: Secure user registration and login
- **Comments System**: Threaded discussions on car pages
- **Voting Module**: User voting system (expandable for future modules)
- **Responsive Design**: Mobile-friendly interface

## Tech Stack

**Backend:**
- Python 3.9+
- Django 4.2+
- Django REST Framework
- PostgreSQL 12+

**Frontend:**
- React 18+
- Axios for API calls
- Redux for state management

**Deployment:**
- Gunicorn (WSGI server)
- Apache 2.4+ (reverse proxy with mod_proxy)
- Nginx (optional alternative)

## Project Structure

```
PORTAL/
├── backend/                 # Django application
│   ├── portal_project/     # Main Django project settings
│   ├── apps/               # Django apps
│   │   ├── cars/          # Car models and views
│   │   ├── opinions/      # Opinion/review system
│   │   ├── common/        # Reusable components
│   │   └── users/         # User management
│   ├── manage.py
│   ├── requirements.txt
│   └── wsgi.py
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── store/         # Redux store
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── config/                 # Configuration files
│   ├── apache.conf        # Apache VirtualHost configuration
│   ├── gunicorn.conf      # Gunicorn settings
│   └── nginx.conf         # Nginx configuration (optional)
└── docs/                   # Documentation
    ├── SETUP.md           # Setup instructions
    ├── API.md             # API documentation
    └── DEPLOYMENT.md      # Deployment guide
```

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 16+
- PostgreSQL 12+
- Apache 2.4+ (for production deployment)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Create Superuser

```bash
python manage.py createsuperuser
# Access admin at http://localhost:8000/admin
```

## Development Workflow

1. **Backend Development**: `/backend` - Run Django dev server
2. **Frontend Development**: `/frontend` - Run Vite dev server
3. **Admin Panel**: Access at `http://localhost:8000/admin`
4. **API Documentation**: Available at `http://localhost:8000/api/docs/`

## API Endpoints

- `GET /api/cars/` - List all cars
- `GET /api/cars/{id}/` - Get car details
- `POST /api/opinions/` - Submit opinion/review
- `GET /api/opinions/?car_id={id}` - Get car opinions
- `POST /api/comments/` - Add comment
- `POST /api/votes/` - Cast vote
- `GET /api/users/me/` - Get current user info

See [API.md](docs/API.md) for complete documentation.

## Admin Panel Features

- Manage car database (CRUD operations)
- Moderate user opinions and comments
- User management and permissioning
- Analytics and reporting
- Module configuration

## Deployment

### Production with Apache + Gunicorn

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete setup instructions.

**Quick Overview:**
1. Deploy backend with Gunicorn
2. Configure Apache as reverse proxy
3. Build and deploy React frontend
4. Set up SSL/TLS with Let's Encrypt

## Future Modules

- Advanced filtering and search
- Image gallery for cars
- Email notifications
- Social media integration
- Analytics dashboard
- Export reports (PDF, CSV)

## Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions, please open an issue in the repository.
