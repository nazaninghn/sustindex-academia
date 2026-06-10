import os, django, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()
sys.stdout.reconfigure(encoding='utf-8')
from questionnaire.models import Question, Choice

# Show first 10 questions ordered by survey/category/order
questions = (Question.objects
    .filter(is_active=True)
    .order_by('survey__id', 'category__order', 'order')
    .select_related('category', 'survey')[:15])

for q in questions:
    choices = q.choices.order_by('order')
    print(f'Q#{q.id} | survey="{q.survey}" | cat="{q.category.name if q.category else "-"}" | order={q.order}')
    print(f'  EN: {q.text[:100]}')
    print(f'  TR: {(q.text_tr or "(no TR)")[:100]}')
    for c in choices:
        print(f'    [{c.order}] score={c.score} | EN: {c.text[:70]} | TR: {(c.text_tr or "(no TR)")[:70]}')
    print()
