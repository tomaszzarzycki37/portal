# Chinese Cars Portal - Project Dashboard

## Project Overview
A modern, semi-professional full-stack web application for showcasing Chinese car brands with comprehensive admin controls, user opinions, and voting systems.

## Tech Stack
- **Backend:** Django 4.2+ with Django REST Framework
- **Frontend:** React 18 with modern tooling (Vite, Redux, Tailwind CSS)
- **Database:** PostgreSQL 12+
- **Deployment:** Apache + Gunicorn + PostgreSQL

## Key Features Implemented
✅ Car database with brands and models  
✅ User authentication with JWT  
✅ Opinion/review system with ratings  
✅ Comments on opinions  
✅ Voting system (helpful/unhelpful)  
✅ Admin dashboard  
✅ React frontend with routing  
✅ API documentation  
✅ Production deployment configuration

## Project Structure

```
PORTAL/
├── backend/                  # Django application
│   ├── portal_project/      # Django settings & URLs
│   ├── apps/                # Django apps
│   │   ├── cars/           # Car models & endpoints
│   │   ├── opinions/       # Reviews & comments
│   │   ├── users/          # Authentication & profiles
│   │   └── common/         # Shared utilities
│   ├── manage.py
│   ├── requirements.txt
│   └── wsgi.py
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API integration
│   │   ├── store/          # Redux store
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── config/                 # Deployment configs
│   ├── apache.conf        # Apache VirtualHost
│   ├── nginx.conf         # Nginx config (alt)
│   ├── gunicorn.conf.py   # Gunicorn settings
│   └── gunicorn.service   # Systemd service
├── docs/                   # Documentation
│   ├── SETUP.md           # Development setup
│   ├── API.md             # API documentation
│   └── DEPLOYMENT.md      # Production deployment
└── README.md
```

## Getting Started

### Development Setup (5 minutes)
1. See [docs/SETUP.md](docs/SETUP.md) for detailed instructions
2. Backend: `cd backend && python -m venv venv && pip install -r requirements.txt && python manage.py migrate && python manage.py runserver`
3. Frontend: `cd frontend && npm install && npm run dev`
4. Admin: http://localhost:8000/admin

### API Documentation
- Interactive: http://localhost:8000/api/docs/
- Full details: [docs/API.md](docs/API.md)

### Production Deployment
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete deployment guide with Apache + Gunicorn + PostgreSQL + SSL.

## Key Endpoints

### Cars API
- `GET /api/cars/` - List all cars
- `GET /api/cars/{id}/` - Car details with opinions
- `GET /api/cars/featured/` - Featured cars
- `GET /api/cars/brands/` - List brands

### Opinions API
- `POST /api/opinions/` - Create opinion (auth required)
- `POST /api/opinions/{id}/vote/` - Vote helpful/unhelpful
- `POST /api/opinions/{id}/add_comment/` - Add comment
- `GET /api/opinions/top_rated/` - Top opinions

### Users API
- `POST /api/users/` - Register
- `POST /api/users/token/` - Login
- `GET /api/users/me/` - Current user (auth required)
- `POST /api/users/update_profile/` - Update profile

## Admin Features

Access at `/admin` with superuser credentials:
- Manage car brands and models
- Moderate user opinions and comments
- User management and permissions
- Analytics and reporting
- Configure system settings

## Frontend Pages

- **Home** (`/`) - Welcome & overview
- **Cars** (`/cars`) - Browse car catalog
- **Car Details** (`/cars/:id`) - Single car with opinions
- **Opinions** (`/opinions`) - All user opinions
- **Login** (`/login`) - User authentication
- **Register** (`/register`) - New account creation
- **Profile** (`/profile`) - User profile management
- **Admin** (`/admin`) - Admin dashboard

## Development Workflow

1. **Backend Changes**
   - Edit models, serializers, or views in `apps/`
   - Run migrations: `python manage.py migrate`
   - Test endpoints: http://localhost:8000/api/docs/

2. **Frontend Changes**
   - Edit components in `src/pages` or `src/components`
   - Changes auto-reload in dev server
   - Build: `npm run build` (production)

3. **Database**
   - Create migration: `python manage.py makemigrations`
   - Apply: `python manage.py migrate`
   - Reset: `python manage.py migrate zero` then `migrate`

## Future Enhancements Roadmap

- Advanced search and filtering with autocomplete
- Image gallery with lazy loading
- Email verification and notifications
- Social media sharing
- Advanced analytics dashboard
- Two-factor authentication
- Multi-language support
- Mobile app (React Native)
- Real-time chat support
- Premium subscription features

## Deployment Checklist

- [ ] Set DEBUG=False in .env
- [ ] Configure SECRET_KEY securely
- [ ] Setup PostgreSQL database
- [ ] Collect static files
- [ ] Create superuser
- [ ] Configure SSL with Let's Encrypt
- [ ] Setup Apache or Nginx
- [ ] Start Gunicorn service
- [ ] Configure backups
- [ ] Setup monitoring

## Database Backup

```bash
# Backup
pg_dump chinese_cars_portal > backup.sql

# Restore
psql chinese_cars_portal < backup.sql
```

## Performance Tips

- Cache frequently accessed data
- Implement pagination for large datasets
- Use database indexes on search fields
- Optimize images for web
- Enable Gzip compression in Apache/Nginx
- Use CDN for static assets

## Common Commands

```bash
# Backend
python manage.py runserver           # Dev server
python manage.py migrate             # Database migrations
python manage.py createsuperuser    # Create admin
python manage.py shell              # Interactive shell
pytest                              # Run tests

# Frontend
npm run dev                          # Dev server
npm run build                        # Production build
npm run lint                         # Lint code
npm run format                       # Format code

# Gunicorn
gunicorn -c config/gunicorn.conf.py portal_project.wsgi
```

## Security Best Practices

✅ JWT authentication for API  
✅ CORS configured for specific origins  
✅ SQL injection protection via ORM  
✅ CSRF protection enabled  
✅ Password hashing with Django auth  
✅ SSL/TLS for HTTPS  
✅ Security headers configured  
✅ Rate limiting ready for implementation  

## Support & Troubleshooting

- Check logs: `tail -f logs/*.log`
- Database issues: See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- API errors: Visit `/api/docs/` for endpoint details
- Frontend build: Clear `node_modules` and reinstall

## License

MIT License - See LICENSE file

## Status

🟢 **Development Ready** - Core features complete, ready for customization and deployment

---

For questions or issues, refer to the documentation files in the `/docs` directory or the README.md file.
