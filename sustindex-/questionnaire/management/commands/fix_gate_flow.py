"""
fix_gate_flow
=============
Implements the exact criterion flow from GRI_Master_Soru_Bankasi.docx:

  G1-GATE ──No──► skip G1
           └─Yes─► G1-P → G1-I → G1-COND → G1-M → G1-R
  G2         (no gate) → G2-P → G2-I → G2-M → G2-R
  G3-GATE ──No──► skip G3
           └─Yes─► G3-P → G3-I → G3-COND → G3-M → G3-R
  G4–G6      (no gate) → always flow P/I/M/R
  G7-GATE ──No──► skip G7
           └─Yes─► G7-P → G7-I → G7-M → G7-R
  G8–G9      (no gate) → always flow P/I/M/R
  G10-GATE ──No──► skip G10 AND G11 → go to G12
            └─Yes─► G10-P/I/COND/M/R then G11-P/I/M/R
  G12–G16    (no gate) → always flow P/I/M/R

Changes applied:
  1. Remove the incorrectly-added G2 GATE question (id 2260).
  2. For each G11 question: set conditional_on_question = G10-GATE (id 1882)
     and conditional_on_min_score = 1, so they disappear when G10 = No.

Usage:
    python manage.py fix_gate_flow
    python manage.py fix_gate_flow --dry-run
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from questionnaire.models import Question, Choice


G10_GATE_ID = 1882   # G10-GATE question PK (confirmed in DB)
G2_GATE_ID  = 2260   # erroneously-created G2 GATE (must be removed)


class Command(BaseCommand):
    help = 'Fix gate flow: remove G2 GATE, link G11 to G10-GATE conditional'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', default=False,
                            help='Show what would change without modifying the DB.')

    def handle(self, *args, **options):
        dry = options['dry_run']
        tag = '[DRY-RUN] ' if dry else ''

        # ── 1. Delete the spurious G2 GATE question ───────────────────────────
        try:
            g2gate = Question.objects.get(id=G2_GATE_ID)
            self.stdout.write(
                f'{tag}Deleting G2 GATE (id={G2_GATE_ID}): "{g2gate.text[:60]}..."')
            if not dry:
                Choice.objects.filter(question=g2gate).delete()
                g2gate.delete()
                self.stdout.write(self.style.SUCCESS('  ✓ Deleted G2 GATE + its choices'))
        except Question.DoesNotExist:
            self.stdout.write('  G2 GATE (id=2260) not found — already removed, skip')

        # ── 2. Link G11 questions to G10-GATE ─────────────────────────────────
        # When G10-GATE is answered No (score=0), conditional_on_min_score=1
        # ensures G11 questions are hidden (0 < 1).
        try:
            g10gate = Question.objects.get(id=G10_GATE_ID)
        except Question.DoesNotExist:
            self.stderr.write(self.style.ERROR(
                f'G10-GATE (id={G10_GATE_ID}) not found — aborting'))
            return

        g11_qs = list(Question.objects.filter(criterion_code='G11').order_by('order'))
        if not g11_qs:
            self.stdout.write(self.style.WARNING('  No G11 questions found'))
        else:
            self.stdout.write(
                f'{tag}Linking {len(g11_qs)} G11 question(s) to G10-GATE (id={G10_GATE_ID})')
            if not dry:
                with transaction.atomic():
                    for q in g11_qs:
                        q.conditional_on_question = g10gate
                        q.conditional_on_min_score = 1
                        q.save(update_fields=[
                            'conditional_on_question', 'conditional_on_min_score'])
                        self.stdout.write(
                            f'  ✓ G11 {q.layer} id={q.id}: '
                            f'conditional_on_question={G10_GATE_ID}, min_score=1')
            else:
                for q in g11_qs:
                    self.stdout.write(
                        f'  G11 {q.layer} id={q.id}: '
                        f'conditional_on_question → {G10_GATE_ID}, min_score → 1')

        self.stdout.write(self.style.SUCCESS(f'\n{tag}Done.'))
