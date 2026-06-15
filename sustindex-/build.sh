#!/usr/bin/env bash
# ============================================================
# Render Build Script — sustindex backend
# ============================================================
# This script runs on every Render deploy. It:
# 1. Installs dependencies
# 2. Collects static files
# 3. Runs migrations
# 4. Creates superuser (if not exists)
# 5. WIPES all questionnaire data and re-imports from v5 Excel
# 6. Runs seed_gri_master to fix scores and clean text
# ============================================================

set -o errexit

# Disable auto-translation signals (prevents deep-translator crash on Render)
export SKIP_AUTO_TRANSLATE=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Python version ==="
python --version

echo ""
echo "=== Installing dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "=== Collecting static files ==="
python manage.py collectstatic --no-input --clear

echo ""
echo "=== Running migrations ==="
python manage.py migrate --noinput

echo ""
echo "=== Creating superuser ==="
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    pw = os.environ.get('DJANGO_SUPERUSER_PASSWORD', '')
    if pw:
        User.objects.create_superuser('admin', 'admin@example.com', pw)
        print('Admin user created')
    else:
        print('WARNING: DJANGO_SUPERUSER_PASSWORD not set')
else:
    print('Admin user already exists')
"

echo ""
echo "=== WIPING ALL QUESTIONNAIRE DATA ==="
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()
from questionnaire.models import Survey, Category, Question, Choice
print(f'Before: {Survey.objects.count()} surveys, {Question.objects.count()} questions, {Choice.objects.count()} choices')
Choice.objects.all().delete()
Question.objects.all().delete()
Category.objects.all().delete()
Survey.objects.all().delete()
print('All questionnaire data deleted.')
"

echo ""
echo "=== Importing GRI v5 data ==="
V5="$SCRIPT_DIR/data/v5"

python manage.py import_gri_v5 "$V5/GRI_v5_Bolum1_Governance.xlsx"
echo "  [OK] Governance"

python manage.py import_gri_v5 "$V5/GRI_v5_Bolum2_Environmental.xlsx"
echo "  [OK] Environmental"

python manage.py import_gri_v5 "$V5/GRI_v5_Bolum3_Social.xlsx"
echo "  [OK] Social"

python manage.py import_gri_v5 "$V5/GRI_v5_Bolum4_Economic.xlsx"
echo "  [OK] Economic"

python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Technology.xlsx"
echo "  [OK] Sector: Technology"

python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Manufacturing.xlsx"
echo "  [OK] Sector: Manufacturing"

python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Financial.xlsx"
echo "  [OK] Sector: Financial"

python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Healthcare.xlsx"
echo "  [OK] Sector: Healthcare"

python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Energy.xlsx"
echo "  [OK] Sector: Energy"

python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Agriculture.xlsx"
echo "  [OK] Sector: Agriculture"

python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Construction.xlsx"
echo "  [OK] Sector: Construction"

python manage.py import_gri_v5 "$V5/GRI_v5_Sektor_Retail.xlsx"
echo "  [OK] Sector: Retail"

echo ""
echo "=== Running seed_gri_master (fix scores + clean text) ==="
python manage.py seed_gri_master --fix

echo ""
echo "=== FINAL VALIDATION ==="
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()
from questionnaire.models import Survey, Question, Choice
print(f'Surveys: {Survey.objects.count()}')
print(f'Questions: {Question.objects.count()}')
print(f'Choices: {Choice.objects.count()}')
print(f'Gates: {Question.objects.filter(is_gate=True).count()}')
q1 = Question.objects.filter(criterion_code=\"G1\", layer=\"GATE\").first()
if q1:
    print(f'Q1 text: {q1.text[:80]}...')
"

echo ""
echo "=========================================="
echo "  BUILD COMPLETED SUCCESSFULLY"
echo "=========================================="
