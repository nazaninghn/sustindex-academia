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
# v4 file follows the actual GRI hierarchy: GRI 1 Foundation → GRI 2 General
# Disclosures → GRI 3 Material Topics → Sector Standard.
python manage.py import_gri_questionnaire "$SCRIPT_DIR/data/GRI_Questionnaire_v4_STRUCTURED.xlsx"

echo ""
echo "Translating questionnaire to Turkish..."
python manage.py translate_questionnaire --survey GRI || echo "Translation step failed (non-fatal)"

echo ""
echo "Building combined GRI Complete Assessment survey..."
# Rebuilds the single hierarchical survey from the 12 imported source surveys.
# --clear : drops and fully rebuilds the combined survey on each deploy.
# NOTE: --hide-components is intentionally NOT used here.
#   The /surveys page now renders a 4-step GRI wizard that looks up each phase
#   survey by name (nameMatch: 'GRI 1:', 'GRI 2:', 'GRI 3:', 'GRI Sector:').
#   The surveys API only returns is_active=True surveys, so hiding the component
#   surveys would leave step.survey=null and silently disable the Start buttons.
#   The combined survey ("GRI Complete Assessment") is still created for
#   admin/reporting use, but the wizard drives the user journey.
# Non-fatal: use || so a failure here doesn't abort the entire deploy.
python manage.py create_combined_survey --clear && echo "[OK] Combined survey built." || {
    echo ""
    echo "=========================================================="
    echo " WARNING: create_combined_survey failed."
    echo " The 12 individual surveys remain visible."
    echo " Check the lines above for the Python traceback."
    echo "=========================================================="
}

echo ""
echo "Build completed successfully!"
