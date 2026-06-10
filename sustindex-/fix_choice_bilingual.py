"""
One-time fix: split combined 'TR / EN' choice text into text_tr + text_en fields.
Run from Render Shell:
  cd /opt/render/project/src  (or wherever manage.py is)
  python fix_choice_bilingual.py
"""
import django, os, sys
os.environ['DJANGO_SETTINGS_MODULE'] = 'sustindex.settings'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from questionnaire.models import Choice

updated = 0
skipped = 0

for choice in Choice.objects.all():
    raw = choice.text or ''
    sep = raw.find(' / ')
    if sep == -1:
        skipped += 1
        continue
    tr_part = raw[:sep].strip()
    en_part = raw[sep + 3:].strip()
    if not (tr_part and en_part):
        skipped += 1
        continue

    # Fix: always split when text_tr/text_en == text (i.e. translate_questionnaire
    # blindly copied the combined string into both lang fields)
    needs_fix = (
        (choice.text_tr or '') == raw or not choice.text_tr or
        (choice.text_en or '') == raw or not choice.text_en
    )
    if needs_fix:
        choice.text_tr = tr_part
        choice.text_en = en_part
        choice.save(update_fields=['text_tr', 'text_en'])
        updated += 1
        print(f'  [{choice.id}] updated')
    else:
        skipped += 1

print(f'\nDone. Updated: {updated}, Skipped: {skipped}')
