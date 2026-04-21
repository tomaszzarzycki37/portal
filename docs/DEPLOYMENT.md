# Deployment Guide

## Production Deployment with Apache + Gunicorn

This guide covers deploying the Chinese Cars Portal to a production server using Apache as reverse proxy and Gunicorn as the WSGI server.

## Prerequisites

- Ubuntu 20.04 LTS or similar
- Python 3.9+
- PostgreSQL 12+
- Apache 2.4+
- Node.js 16+ (for building frontend)
- SSL certificate (Let's Encrypt recommended)

## Server Setup

### 1. Connect to Server

```bash
ssh user@server_ip
sudo su -  # Switch to root
```

### 2. Update System

```bash
apt update && apt upgrade -y
```

### 3. Install Required Packages

```bash
apt install -y python3.9 python3.9-venv python3-pip postgresql postgresql-contrib \
  apache2 apache2-dev git nodejs npm build-essential libpq-dev
```

### 4. Enable Apache Modules

```bash
a2enmod proxy
a2enmod proxy_http
a2enmod rewrite
a2enmod headers
a2enmod ssl
a2enmod deflate
systemctl restart apache2
```

## Database Setup

### 1. Create PostgreSQL Database

```bash
sudo -u postgres psql

-- In PostgreSQL CLI:
CREATE USER portal_user WITH PASSWORD 'strong_password_here';
CREATE DATABASE chinese_cars_portal OWNER portal_user;
ALTER ROLE portal_user SET client_encoding TO 'utf8';
ALTER ROLE portal_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE portal_user SET default_transaction_deferrable TO 'on';
ALTER ROLE portal_user SET timezone TO 'UTC';
\q
```

## Application Deployment

### 1. Clone Repository

```bash
cd /var/www
git clone https://github.com/yourusername/chinese-cars-portal.git
cd chinese-cars-portal
```

### 2. Setup Backend

```bash
cd backend
python3.9 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit with production settings
nano .env
```

Example production `.env`:

```
DEBUG=False
SECRET_KEY=your-very-secret-key-change-this
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DB_ENGINE=django.db.backends.postgresql
DB_NAME=chinese_cars_portal
DB_USER=portal_user
DB_PASSWORD=strong_password_here
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
JWT_SECRET_KEY=your-jwt-secret-key-change-this
```

### 4. Run Migrations

```bash
python manage.py migrate
python manage.py createsuperuser  # Create admin user
```

### 5. Collect Static Files

```bash
python manage.py collectstatic --noinput
```

### 6. Build Frontend

```bash
cd ../frontend
npm install
npm run build
```

## Gunicorn Setup

### 1. Copy Configuration

```bash
sudo cp config/gunicorn.conf.py /var/www/chinese-cars-portal/config/
sudo chown www-data:www-data -R /var/www/chinese-cars-portal
```

### 2. Create Systemd Service

```bash
sudo cp config/gunicorn.service /etc/systemd/system/gunicorn-chinese-cars.service
sudo systemctl daemon-reload
sudo systemctl enable gunicorn-chinese-cars
sudo systemctl start gunicorn-chinese-cars
```

### 3. Verify Gunicorn

```bash
sudo systemctl status gunicorn-chinese-cars
```

## Apache Configuration

### 1. Create Virtual Host

```bash
sudo cp config/apache.conf /etc/apache2/sites-available/chinese-cars-portal.conf
sudo nano /etc/apache2/sites-available/chinese-cars-portal.conf
```

Edit the file and replace:
- `yourdomain.com` with your actual domain
- SSL certificate paths
- Any other settings as needed

### 2. Enable Site

```bash
sudo a2ensite chinese-cars-portal
sudo a2dissite 000-default  # Disable default site
sudo apache2ctl configtest  # Should say "Syntax OK"
sudo systemctl restart apache2
```

### 3. Test HTTP

```bash
curl http://yourdomain.com
```

## SSL/TLS with Let's Encrypt

### 1. Install Certbot

```bash
apt install -y certbot python3-certbot-apache
```

### 2. Get Certificate

```bash
sudo certbot certonly --apache -d yourdomain.com -d www.yourdomain.com
```

Certificate will be at `/etc/letsencrypt/live/yourdomain.com/`

### 3. Configure Auto-Renewal

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

## Logging and Monitoring

### 1. Check Logs

```bash
# Apache logs
tail -f /var/log/apache2/chinese-cars-portal-error.log
tail -f /var/log/apache2/chinese-cars-portal-access.log

# Gunicorn logs
sudo journalctl -u gunicorn-chinese-cars -f
```

### 2. Database Backups

Create a backup script `/usr/local/bin/backup-portal.sh`:

```bash
#!/bin/bash
DATE=$(date +\%Y\%m\%d_\%H\%M\%S)
sudo -u postgres pg_dump chinese_cars_portal > /backups/portal_$DATE.sql
# Keep last 30 backups
find /backups -name "portal_*.sql" -mtime +30 -delete
```

Schedule with cron:

```bash
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-portal.sh
```

## Database Maintenance

### 1. Create Maintenance Tasks

After deployment, setup periodic tasks:

```bash
cd /var/www/chinese-cars-portal/backend
source venv/bin/activate

# Setup Django management commands as cron jobs
python manage.py clearsessions  # Clear expired sessions
```

### 2. Monitor Disk Space

```bash
df -h
du -sh /var/www/chinese-cars-portal/backend/media/
```

## Updating Application

### 1. Pull Latest Changes

```bash
cd /var/www/chinese-cars-portal
git pull origin main
```

### 2. Backend Update

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
```

### 3. Frontend Update

```bash
cd ../frontend
npm install
npm run build
```

### 4. Restart Services

```bash
sudo systemctl restart gunicorn-chinese-cars
sudo systemctl restart apache2
```

## Performance Optimization

### 1. Enable Caching

```bash
# Varnish cache (optional)
apt install -y varnish
```

### 2. Database Optimization

```bash
# Analyze and vacuum PostgreSQL
sudo -u postgres vacuumdb -a -z
sudo -u postgres reindexdb -a
```

### 3. Monitor Performance

```bash
# Check server resources
top
free -h
ps aux | grep gunicorn
```

## Security Hardening

### 1. Firewall

```bash
ufw enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
```

### 2. Fail2Ban

```bash
apt install -y fail2ban
systemctl enable fail2ban
```

### 3. Regular Updates

```bash
apt autoremove
apt autoclean
apt upgrade
```

## Troubleshooting

### Gunicorn not starting

```bash
sudo journalctl -u gunicorn-chinese-cars -n 50 -e
```

### Permission denied on static files

```bash
sudo chown -R www-data:www-data /var/www/chinese-cars-portal
sudo chmod -R 755 /var/www/chinese-cars-portal
```

### Database connection refused

```bash
# Verify PostgreSQL is running
systemctl status postgresql

# Check connection
psql -U portal_user -h localhost -d chinese_cars_portal
```

## Nginx Alternative

If using Nginx instead of Apache, use `config/nginx.conf` and follow similar setup steps.

## Rollback Procedure

```bash
cd /var/www/chinese-cars-portal
git revert HEAD  # or git checkout previous_tag
cd backend
python manage.py migrate  # Downgrade migrations if needed
cd ../frontend
npm run build
sudo systemctl restart gunicorn-chinese-cars
```

For additional help or issues, check the Django and Gunicorn documentation.
