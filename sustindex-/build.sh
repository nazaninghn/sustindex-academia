#!/usr/bin/env bash
set -o errexit

echo "Python version:"
python --version

echo ""
echo "Upgrading pip..."
pip install --upgrade pip

echo ""
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Testing database connection..."
python test_db.py

echo ""
echo "Collecting static files..."
python manage.py collectstatic --no-input --clear

echo ""
echo "Running migrations..."
python manage.py migrate --noinput

echo ""
echo "Creating superuser if not exists..."
python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Admin user created')
else:
    print('Admin user already exists')
EOF

echo ""
echo "Importing GRI questionnaire data..."
python manage.py import_gri_questionnaire data/GRI_Questionnaire_v3_FIXED.xlsx

echo ""
echo "Translating questionnaire to Turkish..."
python manage.py translate_questionnaire --survey GRI || echo "Translation step failed (non-fatal)"

echo ""
echo "Build completed successfully!"
