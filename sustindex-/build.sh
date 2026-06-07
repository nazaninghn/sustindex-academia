#!/usr/bin/env bash
set -o errexit

# Fix #18: resolve the script's own directory so all relative paths work
# regardless of the working directory the caller uses.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
# Fix #19: never hard-code credentials — read from the environment.
# Set DJANGO_SUPERUSER_PASSWORD in Render's environment variables.
python manage.py shell << EOF
import os
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
    if not password:
        print('WARNING: DJANGO_SUPERUSER_PASSWORD not set — skipping superuser creation.')
    else:
        User.objects.create_superuser('admin', 'admin@example.com', password)
        print('Admin user created')
else:
    print('Admin user already exists')
EOF

echo ""
echo "Importing GRI questionnaire data..."
# Fix #18: use absolute path derived from SCRIPT_DIR so this works from any CWD.
python manage.py import_gri_questionnaire "$SCRIPT_DIR/data/GRI_Questionnaire_v3_FIXED.xlsx"

echo ""
echo "Translating questionnaire to Turkish..."
python manage.py translate_questionnaire --survey GRI || echo "Translation step failed (non-fatal)"

echo ""
echo "Building combined GRI Complete Assessment survey..."
# Rebuilds the single hierarchical survey from the 12 imported source surveys.
# --clear     : drops and fully rebuilds the combined survey on each deploy
# --hide-components : sets the 12 individual GRI surveys to is_active=False
#               so only the combined survey appears on the surveys page.
python manage.py create_combined_survey --clear --hide-components

echo ""
echo "Build completed successfully!"
