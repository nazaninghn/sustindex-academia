#!/usr/bin/env bash
set -o errexit

echo "=== Render Build Script ==="
echo "Python version: $(python --version)"
echo "Pip version: $(pip --version)"

echo ""
echo "=== Upgrading pip ==="
pip install --upgrade pip

echo ""
echo "=== Installing dependencies ==="
pip install -r requirements.txt

echo ""
echo "=== Verifying psycopg2 installation ==="
python -c "import psycopg2; print(f'psycopg2 version: {psycopg2.__version__}')" || echo "Warning: psycopg2 import failed"

echo ""
echo "=== Collecting static files ==="
python manage.py collectstatic --no-input --clear

echo ""
echo "=== Running migrations ==="
python manage.py migrate --noinput

echo ""
echo "=== Creating superuser ==="
python manage.py shell << 'EOF'
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('✓ Admin user created')
else:
    print('✓ Admin user already exists')
EOF

echo ""
echo "=== Build completed successfully! ==="
