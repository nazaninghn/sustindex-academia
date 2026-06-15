"""
fix_question_order
==================
Two-step fix for criterion-level question ordering:

Step 1 — Add missing GATE questions
    G2 (Executive ESG Accountability) was loaded from the DOCX without a
    binary Yes/No gate question.  This command creates it so that when a
    company has NO dedicated ESG executive, the entire G2 criterion is
    skipped (P → I → M → R hidden), consistent with the G1 gate behaviour.

Step 2 — Reassign globally-sequential order values
    The original load_gri_bank command stored per-criterion relative offsets
    (GATE=0, P=10, I=20, CONDITIONAL=25, M=30, R=40).  When all questions
    are sorted together the result is:

        G1-GATE, G3-GATE, G7-GATE, G10-GATE,   ← all order-0 together
        G1-P, G2-P, G3-P, …,                   ← all order-10 together
        …

    This command assigns globally-unique order values:

        criterion_rank * 100 + layer_offset

    so the sorted list becomes:

        G1-GATE(100), G1-P(110), G1-I(120), G1-COND(125), G1-M(130), G1-R(140),
        G2-GATE(200), G2-P(210), G2-I(220), G2-M(230), G2-R(240),
        G3-GATE(300), …

Usage:
    python manage.py fix_question_order
    python manage.py fix_question_order --dry-run
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Min
from questionnaire.models import Question, Choice

# Layer display order (offset within a criterion block)
LAYER_OFFSET = {
    'GATE':        0,
    'P':          10,
    'I':          20,
    'CONDITIONAL': 25,
    'M':          30,
    'R':          40,
}

# GATE questions to inject when missing.
# key   = criterion_code
# value = dict with fields for Question.create() + list of (text, score, order) for choices
MISSING_GATES = {
    'G2': {
        'text': (
            'Üst yönetimde (CEO, Genel Müdür, CSO vb.) '
            'sürdürülebilirlikten sorumlu resmi bir kişi veya ekip var mı?'
        ),
        'text_tr': (
            'Üst yönetimde (CEO, Genel Müdür, CSO vb.) '
            'sürdürülebilirlikten sorumlu resmi bir kişi veya ekip var mı?'
        ),
        'text_en': (
            'Is there a formally designated person or team at senior management level '
            '(CEO, General Manager, CSO, etc.) responsible for sustainability?'
        ),
        'choices': [
            ('Evet', 'Yes', 1, 0),
            ('Hayır', 'No', 0, 1),
        ],
    },
}


class Command(BaseCommand):
    help = (
        'Add missing GATE questions and reassign globally-sequential order '
        'values so questions flow criterion-by-criterion (G1 complete → G2 → …)'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Print what would be changed without touching the database.',
        )

    def handle(self, *args, **options):
        dry = options['dry_run']
        prefix = '[DRY-RUN] ' if dry else ''

        # ── Step 1: inject missing GATE questions ─────────────────────────────
        for code, spec in MISSING_GATES.items():
            if Question.objects.filter(criterion_code=code, is_gate=True).exists():
                self.stdout.write(f'  {code} GATE already exists — skip')
                continue

            # Find an existing question in this criterion to inherit survey + category
            sibling = Question.objects.filter(criterion_code=code).order_by('id').first()
            if not sibling:
                self.stdout.write(self.style.WARNING(
                    f'  {code}: no sibling question found — cannot create GATE'))
                continue

            self.stdout.write(f'{prefix}Creating {code} GATE question (survey={sibling.survey_id})')
            if not dry:
                gate = Question.objects.create(
                    text=spec['text'],
                    text_tr=spec.get('text_tr', spec['text']),
                    text_en=spec.get('text_en', ''),
                    category=sibling.category,
                    survey=sibling.survey,
                    criterion_code=code,
                    layer='GATE',
                    is_gate=True,
                    question_type='binary',
                    order=0,          # will be corrected in Step 2
                    allow_multiple=False,
                    bonus_points=0,
                )
                for tr, en, score, ord_ in spec['choices']:
                    Choice.objects.create(
                        question=gate,
                        text=tr,
                        text_tr=tr,
                        text_en=en,
                        score=score,
                        order=ord_,
                    )
                self.stdout.write(self.style.SUCCESS(
                    f'  Created {code} GATE id={gate.id}'))

        # ── Step 2: compute globally-sequential order values ──────────────────
        # Determine criterion sequence by earliest question id (= DOCX load order)
        criteria_in_order = list(
            Question.objects
            .exclude(criterion_code__isnull=True)
            .exclude(criterion_code='')
            .values('criterion_code')
            .annotate(first_id=Min('id'))
            .order_by('first_id')
            .values_list('criterion_code', flat=True)
        )

        self.stdout.write(
            f'\n{prefix}Reassigning order for {len(criteria_in_order)} criteria ...')

        updates = []  # list of (question_id, new_order) for bulk update
        for rank, code in enumerate(criteria_in_order, start=1):
            base = rank * 100
            questions = list(
                Question.objects.filter(criterion_code=code).order_by('order', 'id')
            )
            for q in questions:
                layer_off = LAYER_OFFSET.get(q.layer or 'P', 10)
                new_order = base + layer_off
                if q.order != new_order:
                    updates.append((q.id, new_order))
                    if dry:
                        self.stdout.write(
                            f'  {code} layer={q.layer} id={q.id}: '
                            f'{q.order} → {new_order}')

        self.stdout.write(f'{prefix}{len(updates)} questions need order update')

        if not dry and updates:
            with transaction.atomic():
                for qid, new_order in updates:
                    Question.objects.filter(id=qid).update(order=new_order)

        self.stdout.write(self.style.SUCCESS(
            f'\n{prefix}Done.  Run "python manage.py fix_question_order --dry-run" '
            f'to verify no more changes are needed.'))
