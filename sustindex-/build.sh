#!/usr/bin/env bash
set -o errexit

# Fix: disable auto-translation during build to prevent deep-translator crash
export SKIP_AUTO_TRANSLATE=1

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
echo "Importing GRI questionnaire data (legacy v4 — kept for backwards compatibility)..."
python manage.py import_gri_questionnaire "$SCRIPT_DIR/data/GRI_Questionnaire_v4_STRUCTURED.xlsx" || echo "v4 import failed (non-fatal)"

echo ""
echo "Translating questionnaire to Turkish..."
python manage.py translate_questionnaire --survey GRI || echo "Translation step failed (non-fatal)"

echo ""
echo "=========================================================="
echo " Importing GRI v5 data (4 core sections + 8 sector modules)"
echo "=========================================================="

V5="$SCRIPT_DIR/data/v5"

echo ""
echo "--- Core: Governance (G1-G16) ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Bolum1_Governance.xlsx" --clear

echo ""
echo "--- Core: Environmental (E1-E14) ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Bolum2_Environmental.xlsx" --clear

echo ""
echo "--- Core: Social (S1-S24) ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Bolum3_Social.xlsx" --clear

echo ""
echo "--- Core: Economic (EC1-EC9) ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Bolum4_Economic.xlsx" --clear

echo ""
echo "--- Sector: Technology & IT ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Technology.xlsx" --clear

echo ""
echo "--- Sector: Manufacturing & Industry ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Manufacturing.xlsx" --clear

echo ""
echo "--- Sector: Financial Services ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Financial.xlsx" --clear

echo ""
echo "--- Sector: Healthcare & Pharma ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Healthcare.xlsx" --clear

echo ""
echo "--- Sector: Energy & Utilities ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Energy.xlsx" --clear

echo ""
echo "--- Sector: Agriculture & Food ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Agriculture.xlsx" --clear

echo ""
echo "--- Sector: Construction & Real Estate ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Construction.xlsx" --clear

echo ""
echo "--- Sector: Retail & Trade ---"
python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Retail.xlsx" --clear

echo ""
echo "[OK] All GRI v5 data imported: 4 core sections + 8 sector modules"

echo ""
echo "=========================================================="
echo " Fixing data to match master document (seed_gri_master)"
echo "=========================================================="
python manage.py seed_gri_master --fix

echo ""
echo "Build completed successfully!"
