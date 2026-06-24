#!/usr/bin/env bash
set -euo pipefail

PORTAL_ROOT="${PORTAL_ROOT:-/var/www/PORTAL}"

cd "$PORTAL_ROOT"

git checkout -- frontend/dist/index.html 2>/dev/null || true
git pull origin main

cd backend
source venv/bin/activate
pip install -q -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

cd ../frontend
npm install --silent
npm run build

sudo systemctl restart gunicorn-chinese-cars
sudo systemctl restart apache2

echo "DEPLOY_OK"
