import os, django, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()
sys.stdout.reconfigure(encoding='utf-8')
from questionnaire.models import Question, Choice

# Find all G1-P questions across all surveys
qs = Question.objects.filter(is_active=True).select_related('category', 'survey')
gov_qs = [q for q in qs if 'G1' in (q.text or '')]

print(f"=== Questions with G1 in text ({len(gov_qs)} found) ===\n")
for q in gov_qs[:10]:
    choices = q.choices.order_by('order')
    print(f'Q#{q.id} | survey="{q.survey}" | cat="{q.category.name if q.category else "-"}" | order={q.order}')
    print(f'  EN text: {repr(q.text[:120])}')
    print(f'  TR text: {repr(q.text_tr[:120] if q.text_tr else "(no TR)")}')
    for c in choices:
        print(f'  Choice[order={c.order}] id={c.id} score={c.score}')
        print(f'    EN: {repr(c.text)}')
        print(f'    TR: {repr(c.text_tr or "(no TR)")}')
    print()

# Also check combined survey first question
print("=== Combined survey - first question ===")
combined = qs.filter(survey__name__icontains='combined').order_by('category__order', 'order').first()
if combined:
    print(f'Q#{combined.id} survey="{combined.survey}" text={combined.text[:80]}')
else:
    # try GRI Combined
    combined = qs.filter(survey__name__icontains='GRI').order_by('id').first()
    if combined:
        print(f'Q#{combined.id} survey="{combined.survey}" text={combined.text[:80]}')
