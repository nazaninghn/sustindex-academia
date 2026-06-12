"""
One-time fix v2: split combined 'TR / EN' text that was incorrectly stored
inside the dedicated text_tr or text_en fields.

v1 only checked choice.text as the base.  This script also catches cases where:
  - choice.text is empty BUT choice.text_tr contains 'Tüm hedefler SMART / All targets are SMART'
  - choice.text_tr or choice.text_en themselves hold the combined bilingual string

Run from Render Shell:
  cd /opt/render/project/src
  python fix_choice_bilingual_v2.py
"""
import django, os, sys
os.environ['DJANGO_SETTINGS_MODULE'] = 'sustindex.settings'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from questionnaire.models import Choice

updated = 0
skipped = 0

def split_bilingual(text):
    """Return (tr_part, en_part) or None if no valid separator found."""
    if not text:
        return None
    sep = text.find(' / ')
    if sep == -1:
        return None
    tr_part = text[:sep].strip()
    en_part = text[sep + 3:].strip()
    if tr_part and en_part:
        return tr_part, en_part
    return None

for choice in Choice.objects.all():
    dirty = False
    new_tr = choice.text_tr or ''
    new_en = choice.text_en or ''

    # Case 1: text_tr itself contains the bilingual pattern
    result = split_bilingual(choice.text_tr or '')
    if result and (choice.text_tr or '').find(' / ') != -1:
        tr_part, en_part = result
        # Only fix if it looks like a combined string (has both parts)
        if not choice.text_en or choice.text_en == choice.text_tr:
            new_tr = tr_part
            new_en = en_part
            dirty = True
        elif choice.text_tr == (choice.text_en or ''):
            # text_tr == text_en (both combined) — fix both
            new_tr = tr_part
            new_en = en_part
            dirty = True

    # Case 2: text_en itself contains the bilingual pattern (and text_tr is ok)
    result_en = split_bilingual(choice.text_en or '')
    if result_en and (choice.text_en or '').find(' / ') != -1:
        if not choice.text_tr or choice.text_tr == choice.text_en:
            tr_part_en, en_part_en = result_en
            new_tr = tr_part_en
            new_en = en_part_en
            dirty = True

    # Case 3: text field has bilingual but text_tr/text_en are empty
    if not dirty and (not choice.text_tr or not choice.text_en):
        result_text = split_bilingual(choice.text or '')
        if result_text:
            tr_part_t, en_part_t = result_text
            if not choice.text_tr:
                new_tr = tr_part_t
                dirty = True
            if not choice.text_en:
                new_en = en_part_t
                dirty = True

    if dirty:
        choice.text_tr = new_tr
        choice.text_en = new_en
        choice.save(update_fields=['text_tr', 'text_en'])
        updated += 1
        print(f'  [{choice.id}] tr={repr(new_tr[:60])} | en={repr(new_en[:60])}')
    else:
        skipped += 1

print(f'\nDone. Updated: {updated}, Skipped: {skipped}')
