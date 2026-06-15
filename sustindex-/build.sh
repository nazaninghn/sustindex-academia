#!/usr/bin/env bash
# ============================================================
# Render Build Script — sustindex backend
# ============================================================
# This script runs on every Render deploy. It:
# 1. Installs dependencies
# 2. Collects static files
# 3. Runs migrations
# 4. Creates superuser (if not exists)
# 5. Syncs questionnaire structure from v5 fixture WITHOUT
#    wiping user data (attempts + answers are preserved).
#    Stale surveys (not in v5) are soft-deactivated.
# 6. Loads questionnaire fixture (data/fixtures/questionnaire_v5.json)
#    — exact copy of verified local SQLite data (418 Q, 1281 choices)
#    — to regenerate: python manage.py dumpdata questionnaire.survey
#      questionnaire.category questionnaire.question questionnaire.choice
#      --indent 2 > data/fixtures/questionnaire_v5.json
# 7. Resets DB sequences so new inserts don't conflict with fixture IDs
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
echo "=== Soft-deactivating stale surveys (preserving user data) ==="
export V5_FIXTURE_PATH="$SCRIPT_DIR/data/fixtures/questionnaire_v5.json"
python -c "
import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()
from questionnaire.models import Survey, QuestionnaireAttempt, Answer

fixture_path = os.environ['V5_FIXTURE_PATH']
with open(fixture_path) as f:
    fixture_data = json.load(f)
v5_survey_pks = [item['pk'] for item in fixture_data if item['model'] == 'questionnaire.survey']
print(f'v5 fixture defines {len(v5_survey_pks)} surveys: pks={v5_survey_pks}')

before_surveys  = Survey.objects.count()
before_attempts = QuestionnaireAttempt.objects.count()
before_answers  = Answer.objects.count()
print(f'DB before sync: {before_surveys} surveys, {before_attempts} attempts, {before_answers} answers')

# Soft-deactivate surveys NOT in v5 fixture so they disappear from the API
# without cascading deletes that would wipe user data.
stale = Survey.objects.exclude(pk__in=v5_survey_pks).filter(is_active=True)
stale_count = stale.count()
if stale_count:
    stale.update(is_active=False)
    print(f'Soft-deactivated {stale_count} stale survey(s) — user attempts preserved.')
else:
    print('No stale surveys found.')
print(f'User data preserved: {QuestionnaireAttempt.objects.count()} attempts, {Answer.objects.count()} answers.')
"

echo ""
echo "=== Loading questionnaire fixture (upserts v5 structure) ==="
python manage.py loaddata "$SCRIPT_DIR/data/fixtures/questionnaire_v5.json"

echo ""
echo "=== Resetting DB sequences after fixture load ==="
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()
from django.db import connection
if connection.vendor == 'postgresql':
    from questionnaire.models import Survey, Category, Question, Choice
    with connection.cursor() as c:
        for model in [Survey, Category, Question, Choice]:
            table = model._meta.db_table
            c.execute(f\"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM {table}), 1))\")
    print('PostgreSQL sequences reset to max fixture IDs.')
else:
    print('SQLite: no sequence reset needed.')
"

echo ""
echo "=== FINAL VALIDATION ==="
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()
from questionnaire.models import Survey, Question, Choice, QuestionnaireAttempt, Answer
print(f'Active surveys:  {Survey.objects.filter(is_active=True).count()}')
print(f'Questions:       {Question.objects.count()}')
print(f'Choices:         {Choice.objects.count()}')
print(f'Gates:           {Question.objects.filter(is_gate=True).count()}')
print(f'User attempts:   {QuestionnaireAttempt.objects.count()}')
print(f'User answers:    {Answer.objects.count()}')
q1 = Question.objects.filter(criterion_code=\"G1\", layer=\"GATE\").first()
if q1:
    print(f'Q1 text: {q1.text[:80]}...')
"

echo ""
echo "=========================================="
echo "  BUILD COMPLETED SUCCESSFULLY"
echo "=========================================="
