# Deployment Guide

## Production Deployment with Apache + Gunicorn

This guide covers deploying the Chinese Cars Portal to a production server using Apache as reverse proxy and Gunicorn as the WSGI server.

## Current Production Environment (autachin.pl)

| Setting | Value |
|---------|-------|
| **Domain** | `autachin.pl`, `www.autachin.pl` |
| **Server path** | `/var/www/PORTAL/` |
| **Apache config** | `config/autachin.conf` |
| **Frontend (built)** | `/var/www/PORTAL/frontend/dist/` |
| **Backend media** | `/var/www/PORTAL/backend/media/` |
| **Gunicorn** | `127.0.0.1:8000` (proxied by Apache) |
| **Git repository** | `https://github.com/tomaszzarzycki37/portal.git` |
| **Branch** | `main` |
| **Apache logs** | `/var/log/apache2/autachin_error.log`, `autachin_access.log` |
| **SSH user** | `ubuntu` |
| **SSH host** | `autachin.pl` (VPS hostname: `vps-2c2d51b4`) |
| **Gunicorn systemd** | `gunicorn-chinese-cars.service` |

Apache routes:

- `/api`, `/django-admin`, `/static` → Gunicorn (port 8000)
- `/media` → `/var/www/PORTAL/backend/media/`
- all other paths → React SPA (`frontend/dist/index.html`)

## Deploy from Cursor or VS Code (routine workflow)

Cursor and VS Code use the same workflow. There is no special deploy plugin — changes go to production via **Git + SSH**.

### Local machine (Windows)

Project folder:

```
C:\Users\<user>\OneDrive - Teleste Corporation\Desktop\PORTAL
```

**Step 1 — make and test changes locally**

```powershell
# Backend (optional local test)
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py runserver

# Frontend (optional local test)
cd ..\frontend
npm run dev
```

**Step 2 — build frontend (if React changed)**

```powershell
cd frontend
npm install
npm run build
```

Output goes to `frontend/dist/` — Apache serves this folder on production.

**Step 3 — push to GitHub**

```powershell
cd C:\Users\<user>\OneDrive - Teleste Corporation\Desktop\PORTAL
git status
git add .
git commit -m "Describe your change"
git push origin main
```

### Production server (Linux, via SSH)

**Step 4 — connect to server**

```bash
ssh user@server_ip
cd /var/www/PORTAL
```

Or use **Remote SSH** in Cursor / VS Code: `Ctrl+Shift+P` → `Remote-SSH: Connect to Host`.

**Step 5 — pull and update**

```bash
cd /var/www/PORTAL
git pull origin main

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# Frontend
cd ../frontend
npm install
npm run build

# Restart services
sudo systemctl restart gunicorn-chinese-cars
sudo systemctl restart apache2
```

**Step 6 — verify**

```bash
curl -I http://autachin.pl
sudo systemctl status gunicorn-chinese-cars
sudo journalctl -u gunicorn-chinese-cars -n 20
tail -f /var/log/apache2/autachin_error.log
```

### Deploy checklist (quick reference)

- [ ] Changes tested locally
- [ ] `npm run build` (if frontend changed)
- [ ] `git push origin main`
- [ ] SSH → `git pull` on server
- [ ] `migrate` + `collectstatic` (if backend changed)
- [ ] `npm run build` on server (if frontend changed)
- [ ] Restart Gunicorn + Apache
- [ ] Check site in browser (hard refresh: `Ctrl+F5`)

### IDE tools (Cursor / VS Code)

| Tool | Purpose |
|------|---------|
| Integrated terminal (`Ctrl+`` `) | Run git, npm, ssh locally |
| Git panel | Commit and push changes |
| Remote SSH extension | Edit files directly on server |
| AI (Cursor) | Code changes — deploy steps stay the same |

> **Note:** Cursor is a VS Code fork. Anything that worked in VS Code (terminal, Git, Remote SSH) works identically in Cursor.

## Standardowy workflow wdrożenia (zapamiętaj)

Ten proces używamy zawsze: **lokalne zmiany → GitHub → SSH na serwer → pull → migrate/build → restart**.

### Krok 1 — lokalnie (Windows / Cursor)

```powershell
cd "C:\Users\tomasz.zarzycki\OneDrive - Teleste Corporation\Desktop\PORTAL"

# opcjonalnie, gdy zmieniasz frontend:
cd frontend
npm run build
cd ..

git add .
git commit -m "Opis zmian"
git push origin main
```

### Krok 2 — serwer PROD (SSH jako ubuntu)

```bash
ssh ubuntu@autachin.pl
cd /var/www/PORTAL
git pull origin main

cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

cd ../frontend
npm install
npm run build

sudo systemctl restart gunicorn-chinese-cars
sudo systemctl restart apache2
```

### Krok 2b — jedna komenda na serwerze (skrót)

Po zalogowaniu SSH możesz wkleić:

```bash
cd /var/www/PORTAL && git pull origin main && \
cd backend && source venv/bin/activate && \
pip install -q -r requirements.txt && python manage.py migrate && \
python manage.py collectstatic --noinput && \
cd ../frontend && npm install --silent && npm run build && \
sudo systemctl restart gunicorn-chinese-cars && sudo systemctl restart apache2 && \
echo "DEPLOY OK"
```

### Krok 3 — weryfikacja

```bash
curl -I https://autachin.pl
sudo systemctl status gunicorn-chinese-cars
```

W przeglądarce: **Ctrl+F5** (twarde odświeżenie).

### Aktualizacja danych modeli (bez pełnego deployu kodu)

Gdy zmieniasz tylko **dane** (ceny, wymiary), jak wcześniej w Visual Studio:

**A) Skrypt API** (z Windows, po `git push` gdy backend ma nowe pola):

```powershell
$env:PORTAL_ADMIN_USER = "admin"
$env:PORTAL_ADMIN_PASSWORD = "<haslo-admina>"
backend\.venv\Scripts\python.exe update_car_dimensions.py
# lub: update_car_price.py
```

**B) Komenda na serwerze** (wymiary z pliku `dimension_data.py`):

```bash
cd /var/www/PORTAL/backend && source venv/bin/activate
python manage.py populate_car_dimensions
```

> **Bezpieczeństwo:** nie commituj haseł do Git. Używaj zmiennych środowiskowych lub wpisuj hasło tylko w terminalu.

### Windows — SSH bez interakcji (PuTTY plink)

Gdy `ssh` wymaga hasła w PowerShell, można użyć PuTTY `plink` (hasło z env, nie w repo):

```powershell
$env:PORTAL_SSH_PASSWORD = "<haslo-ubuntu>"
& "C:\Program Files\PuTTY\plink.exe" -batch `
  -hostkey "SHA256:CtTW09cszl1rViqTi0JzNS3ByoqGP5rZgJlIM5lEWXw" `
  -pw $env:PORTAL_SSH_PASSWORD ubuntu@autachin.pl `
  "cd /var/www/PORTAL && git pull origin main && cd backend && source venv/bin/activate && python manage.py migrate && cd ../frontend && npm run build && sudo systemctl restart gunicorn-chinese-cars && sudo systemctl restart apache2"
```

### Checklist (skrót)

1. `git push origin main`
2. `ssh ubuntu@autachin.pl`
3. `git pull` → `migrate` → `npm run build`
4. `restart gunicorn-chinese-cars` + `apache2`
5. Ctrl+F5 w przeglądarce

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
git clone https://github.com/tomaszzarzycki37/portal.git PORTAL
cd PORTAL
```

For a generic / new server, replace the repo URL and folder name as needed.

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

**Production (autachin.pl):**

```bash
sudo cp config/autachin.conf /etc/apache2/sites-available/autachin.conf
sudo nano /etc/apache2/sites-available/autachin.conf
sudo a2ensite autachin
```

**Generic template (other domains):**

```bash
sudo cp config/apache.conf /etc/apache2/sites-available/chinese-cars-portal.conf
sudo nano /etc/apache2/sites-available/chinese-cars-portal.conf
```

Edit the file and replace:
- `yourdomain.com` with your actual domain
- SSL certificate paths
- `/var/www/chinese-cars-portal` paths with your install path
- Any other settings as needed

### 2. Enable Site

```bash
sudo a2ensite chinese-cars-portal   # or: sudo a2ensite autachin
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

See [Deploy from Cursor or VS Code](#deploy-from-cursor-or-vs-code-routine-workflow) for the full local → GitHub → server workflow.

Server-only update (after `git push` from local machine):

```bash
cd /var/www/PORTAL
git pull origin main

cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

cd ../frontend
npm install
npm run build

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
