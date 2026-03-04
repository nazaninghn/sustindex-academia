#!/usr/bin/env bash
set -o errexit

echo "Python version:"
python --version

echo ""
echo "Upgrading pip..."
pip install --upgrade pip setuptools wheel

echo ""
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Collecting static files..."
python manage.py collectstatic --no-input

echo ""
echo "Running migrations..."
python manage.py makemigrations --noinput || echo "No new migrations"
python manage.py migrate --noinput

echo ""
echo "Compiling translations..."
python manage.py compilemessages --ignore=venv 2>/dev/null || echo "Skipping compilemessages"

echo ""
echo "Setting up initial data..."
python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

if not User.objects.filter(username='admin').exists():
    try:
        exec(open('setup.py').read())
        print('Setup completed')
    except Exception as e:
        print(f'Setup error: {e}')
        User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
        print('Admin user created')
else:
    print('Admin user exists')
" || echo "Setup had issues"

echo ""
echo "Build completed!"
