# -*- coding: utf-8 -*-
"""
seed_gri_master  –  Master fix/validation command for GRI v5 questionnaire data.

Usage:
    python manage.py seed_gri_master --fix

Actions performed with --fix flag:
  1. DELETE all legacy surveys (IDs 1-17) and their associated questions/choices/categories
  2. KEEP surveys 18-29 (the v5 ones) but FIX them per the master document
  3. FIX sector module scores to match the document exactly
  4. FIX G16 (remove extra CONDITIONAL layers - should be P, I, M, R only)
  5. FIX E14 (should have GATE, P, I, CONDITIONAL, M, R - remove the extra CONDITIONAL)
  6. DELETE extra questions in sectors that have more than 12
  7. Output a validation report at the end

Environment:
  Set SKIP_AUTO_TRANSLATE=1 to suppress any auto-translation signal triggers.
"""

import os
from django.core.management.base import BaseCommand
from django.db import transaction

from questionnaire.models import Survey, Category, Question, Choice


# ─── SECTOR SURVEY ID MAPPING ──────────────────────────────────────────────────
# Sector surveys live in IDs 22-29. The sector field on Question is empty.
SECTOR_SURVEY_IDS = {
    'tech':          22,  # GRI Sector: Technology & IT
    'manufacturing': 23,  # GRI Sector: Manufacturing & Industry
    'finance':       24,  # GRI Sector: Financial Services
    'health':        25,  # GRI Sector: Healthcare & Pharma
    'energy':        26,  # GRI Sector: Energy & Utilities
    'agri':          27,  # GRI Sector: Agriculture & Food
    'construction':  28,  # GRI Sector: Construction & Real Estate
    'retail':        29,  # GRI Sector: Retail & Trade
}

# ─── MASTER SECTOR SCORE DATA ──────────────────────────────────────────────────
# Each question spec: (code, max_pts, question_type, is_multi, choice_scores)
# For numerical questions, choice_scores represents the threshold scores (high to low).
# For multi questions, choice_scores are individual scores that sum up.

SECTOR_MASTER = {
    'agri': {
        'name': 'Agriculture & Food',
        'survey_id': 27,
        'max_points': 123,
        'question_count': 12,
        'questions': [
            # (code, max_pts, qtype, is_multi, scores)
            # For multi: scores must sum (positives) to max_pts
            # For single/binary: max(scores) must equal max_pts
            ('AG-01', 15, 'single', False, [15, 9, 4, 0]),
            ('AG-02', 12, 'single', False, [12, 7, 2, 0]),
            ('AG-03', 10, 'multi',  True,  [4, 3, 3, 0]),        # sum=10
            ('AG-04', 10, 'single', False, [10, 5, 1, 0]),
            ('AG-05', 10, 'multi',  True,  [4, 3, 3, 0]),        # sum=10
            ('AG-06',  8, 'binary', False, [8, 0]),               # yes=8, no=0
            ('AG-07',  8, 'single', False, [8, 4, 1, 0]),
            ('AG-08',  8, 'single', False, [8, 4, 1, 0]),
            ('AG-09', 12, 'multi',  True,  [3, 3, 3, 3, 0]),     # sum=12
            ('AG-10', 12, 'single', False, [12, 7, 2, 0]),
            ('AG-11', 10, 'binary', False, [10, 0]),
            ('AG-12',  8, 'single', False, [8, 5, 2, 0]),
        ],
    },
    'energy': {
        'name': 'Energy & Utilities',
        'survey_id': 26,
        'max_points': 121,
        'question_count': 12,
        'questions': [
            ('EN-01', 15, 'single',    False, [15, 8, 2, 0]),
            ('EN-02', 12, 'single',    False, [12, 7, 3, 0]),
            ('EN-03', 12, 'multi',     True,  [5, 4, 3, 0]),     # sum=12
            ('EN-04', 10, 'numerical', False, [10, 7, 3, 0]),
            ('EN-05',  8, 'single',    False, [8, 4, 1, 0]),
            ('EN-06',  6, 'numerical', False, [6, 4, 2, 0]),
            ('EN-07',  8, 'single',    False, [8, 5, 2, 0]),
            ('EN-08', 12, 'single',    False, [12, 7, 3, 0]),
            ('EN-09', 12, 'single',    False, [12, 7, 3, 0]),
            ('EN-10', 10, 'single',    False, [10, 6, 2, 0]),
            ('EN-11', 10, 'single',    False, [10, 6, 2]),
            ('EN-12',  6, 'single',    False, [6, 3, 1, 0]),
        ],
    },
    'finance': {
        'name': 'Financial Services',
        'survey_id': 24,
        'max_points': 121,
        'question_count': 12,
        'questions': [
            ('FIN-01', 15, 'single',    False, [15, 8, 3, 0]),
            ('FIN-02', 12, 'single',    False, [12, 7, 2, 0]),
            ('FIN-03', 12, 'single',    False, [12, 7, 3, 0]),
            ('FIN-04', 10, 'multi',     True,  [4, 3, 3, 0]),    # sum=10
            ('FIN-05',  8, 'numerical', False, [8, 5, 2, 0]),
            ('FIN-06',  6, 'single',    False, [6, 3, 1, 0]),
            ('FIN-07',  8, 'numerical', False, [8, 4, 1, 0]),
            ('FIN-08',  8, 'single',    False, [8, 4, 1, 0]),
            ('FIN-09', 12, 'single',    False, [12, 7, 3, 0]),
            ('FIN-10', 10, 'single',    False, [10, 6, 2]),
            ('FIN-11', 10, 'numerical', False, [10, 7, 3, 0]),
            ('FIN-12', 10, 'single',    False, [10, 6, 2, 0]),
        ],
    },
    'manufacturing': {
        'name': 'Manufacturing & Industry',
        'survey_id': 23,
        'max_points': 114,
        'question_count': 12,
        'questions': [
            ('MFG-01', 12, 'single',    False, [12, 7, 3, 0]),
            ('MFG-02', 10, 'numerical', False, [10, 7, 3, 0]),
            ('MFG-03', 10, 'single',    False, [10, 6, 2, 0]),
            ('MFG-04',  8, 'numerical', False, [8, 5, 2, 0]),
            ('MFG-05',  8, 'single',    False, [8, 4, 1, 0]),
            ('MFG-06',  8, 'single',    False, [8, 4, 2, 0]),
            ('MFG-07', 10, 'single',    False, [10, 6, 2, 0]),
            ('MFG-08',  6, 'numerical', False, [6, 4, 2, 0]),
            ('MFG-09', 12, 'single',    False, [12, 7, 3, 0]),
            ('MFG-10', 12, 'single',    False, [12, 7, 3, 0]),
            ('MFG-11', 10, 'single',    False, [10, 6, 2, 0]),
            ('MFG-12',  8, 'single',    False, [8, 5, 2, 0]),
        ],
    },
    'construction': {
        'name': 'Construction & Real Estate',
        'survey_id': 28,
        'max_points': 115,
        'question_count': 12,
        'questions': [
            ('CON-01', 15, 'numerical', False, [15, 9, 4, 0]),
            ('CON-02', 12, 'single',    False, [12, 7, 3, 0]),
            ('CON-03', 10, 'numerical', False, [10, 7, 3, 0]),
            ('CON-04', 10, 'single',    False, [10, 6, 2, 0]),
            ('CON-05',  8, 'numerical', False, [8, 5, 2, 0]),
            ('CON-06',  8, 'single',    False, [8, 4, 2, 0]),
            ('CON-07',  6, 'single',    False, [6, 3, 1, 0]),
            ('CON-08',  6, 'single',    False, [6, 3, 1, 0]),
            ('CON-09', 12, 'single',    False, [12, 7, 3, 0]),
            ('CON-10', 10, 'single',    False, [10, 5, 2, 0]),
            ('CON-11', 10, 'single',    False, [10, 6, 2, 0]),
            ('CON-12',  8, 'single',    False, [8, 4, 2]),
        ],
    },
    'health': {
        'name': 'Healthcare & Pharma',
        'survey_id': 25,
        'max_points': 119,
        'question_count': 12,
        'questions': [
            ('HC-01', 15, 'single',    False, [15, 8, 2, 0]),
            ('HC-02', 12, 'single',    False, [12, 7, 3, 0]),
            ('HC-03', 10, 'numerical', False, [10, 6, 2, 0]),
            ('HC-04', 10, 'multi',     True,  [4, 3, 3, 0]),     # sum=10
            ('HC-05',  8, 'single',    False, [8, 4, 1, 0]),
            ('HC-06',  8, 'single',    False, [8, 4, 1, 0]),
            ('HC-07',  6, 'numerical', False, [6, 4, 2, 0]),
            ('HC-08',  8, 'single',    False, [8, 4, 2, 0]),
            ('HC-09', 12, 'single',    False, [12, 7, 3, 0]),
            ('HC-10', 10, 'multi',     True,  [4, 3, 3, 0]),     # sum=10
            ('HC-11', 10, 'single',    False, [10, 6, 2, 0]),
            ('HC-12', 10, 'single',    False, [10, 6, 2, 0]),
        ],
    },
    'tech': {
        'name': 'Technology & IT',
        'survey_id': 22,
        'max_points': 117,
        'question_count': 12,
        'questions': [
            ('TECH-01', 15, 'multi',     True,  [5, 5, 5, 0]),   # sum=15
            ('TECH-02', 12, 'single',    False, [12, 7, 2, 0]),
            ('TECH-03', 10, 'numerical', False, [10, 6, 2, 0]),
            ('TECH-04', 10, 'multi',     True,  [4, 3, 3, 0]),   # sum=10
            ('TECH-05', 10, 'single',    False, [10, 5, 1, 0]),
            ('TECH-06',  8, 'multi',     True,  [3, 3, 2, 0]),   # sum=8
            ('TECH-07',  8, 'single',    False, [8, 4, 1, 0]),
            ('TECH-08', 12, 'single',    False, [12, 7, 3, 0]),
            ('TECH-09', 10, 'single',    False, [10, 5, 2, 0]),
            ('TECH-10', 10, 'multi',     True,  [4, 3, 3, 0]),   # sum=10
            ('TECH-11',  6, 'binary',    False, [6, 0]),
            ('TECH-12',  6, 'binary',    False, [6, 0]),
        ],
    },
    'retail': {
        'name': 'Retail & Trade',
        'survey_id': 29,
        'max_points': 123,
        'question_count': 12,
        'questions': [
            ('RET-01', 15, 'single',    False, [15, 9, 4, 0]),
            ('RET-02', 12, 'numerical', False, [12, 8, 4, 0]),
            ('RET-03', 12, 'single',    False, [12, 7, 2, 0]),
            ('RET-04', 10, 'multi',     True,  [4, 3, 3, 0]),    # sum=10
            ('RET-05',  8, 'multi',     True,  [3, 3, 2, 0]),    # sum=8
            ('RET-06',  8, 'single',    False, [8, 4, 1, 0]),
            ('RET-07',  8, 'single',    False, [8, 4, 1, 0]),
            ('RET-08',  8, 'single',    False, [8, 4, 2, 0]),
            ('RET-09', 10, 'binary',    False, [10, 0]),
            ('RET-10', 10, 'multi',     True,  [4, 3, 3, 0]),    # sum=10
            ('RET-11', 10, 'multi',     True,  [4, 3, 3, 0]),    # sum=10
            ('RET-12', 12, 'single',    False, [12, 7, 3, 0]),
        ],
    },
}

# G16 fix: allowed layers (should be P, I, M, R only - no CONDITIONAL)
G16_ALLOWED_LAYERS = ['P', 'I', 'M', 'R']

# E14 fix: allowed layers (GATE, P, I, CONDITIONAL, M, R - exactly 6 questions)
E14_ALLOWED_LAYERS = ['GATE', 'P', 'I', 'CONDITIONAL', 'M', 'R']

# Numerical thresholds templates for sector questions that need them
NUMERICAL_THRESHOLDS = {
    'EN-04': [{'min': 50, 'max': 100, 'score': 10}, {'min': 25, 'max': 49, 'score': 7},
              {'min': 5, 'max': 24, 'score': 3}, {'min': 0, 'max': 4, 'score': 0}],
    'EN-06': [{'min': 10, 'max': 100, 'score': 6}, {'min': 5, 'max': 9, 'score': 4},
              {'min': 1, 'max': 4, 'score': 2}, {'min': 0, 'max': 0, 'score': 0}],
    'FIN-05': [{'min': 30, 'max': 100, 'score': 8}, {'min': 15, 'max': 29, 'score': 5},
               {'min': 5, 'max': 14, 'score': 2}, {'min': 0, 'max': 4, 'score': 0}],
    'FIN-07': [{'min': 0, 'max': 0, 'score': 8}, {'min': 1, 'max': 1, 'score': 4},
               {'min': 2, 'max': 3, 'score': 1}, {'min': 4, 'max': 9999, 'score': 0}],
    'FIN-11': [{'min': 0, 'max': 20, 'score': 10}, {'min': 21, 'max': 50, 'score': 7},
               {'min': 51, 'max': 100, 'score': 3}, {'min': 101, 'max': 9999, 'score': 0}],
    'MFG-02': [{'min': 30, 'max': 100, 'score': 10}, {'min': 10, 'max': 29, 'score': 7},
               {'min': 1, 'max': 9, 'score': 3}, {'min': 0, 'max': 0, 'score': 0}],
    'MFG-04': [{'min': 15, 'max': 100, 'score': 8}, {'min': 5, 'max': 14, 'score': 5},
               {'min': 1, 'max': 4, 'score': 2}, {'min': 0, 'max': 0, 'score': 0}],
    'MFG-08': [{'min': 10, 'max': 100, 'score': 6}, {'min': 5, 'max': 9, 'score': 4},
               {'min': 1, 'max': 4, 'score': 2}, {'min': 0, 'max': 0, 'score': 0}],
    'CON-01': [{'min': 60, 'max': 100, 'score': 15}, {'min': 40, 'max': 59, 'score': 9},
               {'min': 20, 'max': 39, 'score': 4}, {'min': 0, 'max': 19, 'score': 0}],
    'CON-03': [{'min': 75, 'max': 100, 'score': 10}, {'min': 50, 'max': 74, 'score': 7},
               {'min': 25, 'max': 49, 'score': 3}, {'min': 0, 'max': 24, 'score': 0}],
    'CON-05': [{'min': 90, 'max': 100, 'score': 8}, {'min': 70, 'max': 89, 'score': 5},
               {'min': 50, 'max': 69, 'score': 2}, {'min': 0, 'max': 49, 'score': 0}],
    'HC-03': [{'min': 95, 'max': 100, 'score': 10}, {'min': 80, 'max': 94, 'score': 6},
              {'min': 60, 'max': 79, 'score': 2}, {'min': 0, 'max': 59, 'score': 0}],
    'HC-07': [{'min': 80, 'max': 100, 'score': 6}, {'min': 60, 'max': 79, 'score': 4},
              {'min': 40, 'max': 59, 'score': 2}, {'min': 0, 'max': 39, 'score': 0}],
    'TECH-03': [{'min': 80, 'max': 100, 'score': 10}, {'min': 50, 'max': 79, 'score': 6},
                {'min': 20, 'max': 49, 'score': 2}, {'min': 0, 'max': 19, 'score': 0}],
    'RET-02': [{'min': 100, 'max': 100, 'score': 12}, {'min': 75, 'max': 99, 'score': 8},
               {'min': 50, 'max': 74, 'score': 4}, {'min': 0, 'max': 49, 'score': 0}],
}


class Command(BaseCommand):
    help = 'Master fix/validation for GRI v5 questionnaire data.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix', action='store_true',
            help='Apply fixes (without this flag, only validation report is shown)',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        # Set SKIP_AUTO_TRANSLATE to suppress translation signals during bulk ops
        os.environ['SKIP_AUTO_TRANSLATE'] = '1'

        do_fix = options['fix']
        dry_run = options['dry_run']

        if dry_run:
            do_fix = False

        self.stdout.write(self.style.MIGRATE_HEADING(
            '\n═══════════════════════════════════════════════════════'
        ))
        self.stdout.write(self.style.MIGRATE_HEADING(
            '  GRI MASTER SEED — Fix & Validate'
        ))
        self.stdout.write(self.style.MIGRATE_HEADING(
            '═══════════════════════════════════════════════════════\n'
        ))

        if do_fix:
            self.stdout.write(self.style.WARNING('MODE: FIX (applying changes)\n'))
        else:
            self.stdout.write(self.style.NOTICE('MODE: VALIDATE ONLY (no changes)\n'))

        with transaction.atomic():
            # Step 1: Delete legacy surveys (IDs 1-17)
            self._step1_delete_legacy(do_fix)

            # Step 2: Fix G16 (remove extra CONDITIONAL layers)
            self._step2_fix_g16(do_fix)

            # Step 3: Fix E14 (remove extra CONDITIONAL)
            self._step3_fix_e14(do_fix)

            # Step 4: Fix sector modules
            self._step4_fix_sectors(do_fix)

            # Step 5: Validation report
            self._step5_validation_report()

        # Clean up env var
        if 'SKIP_AUTO_TRANSLATE' in os.environ:
            del os.environ['SKIP_AUTO_TRANSLATE']

        self.stdout.write(self.style.SUCCESS('\n[DONE] seed_gri_master complete.\n'))

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 1: Delete legacy surveys (IDs 1-17)
    # ═══════════════════════════════════════════════════════════════════════════

    def _step1_delete_legacy(self, do_fix):
        self.stdout.write(self.style.MIGRATE_HEADING(
            '─── STEP 1: Delete Legacy Surveys (IDs 1-17) ───'
        ))

        legacy_surveys = Survey.objects.filter(id__lte=17)
        count = legacy_surveys.count()

        if count == 0:
            self.stdout.write('  No legacy surveys found (IDs 1-17). Already clean.\n')
            return

        self.stdout.write(f'  Found {count} legacy survey(s):')
        for s in legacy_surveys:
            q_count = Question.objects.filter(survey=s).count()
            self.stdout.write(f'    ID={s.id}: "{s.name}" ({q_count} questions)')

        if do_fix:
            # Cascade delete will remove categories, questions, choices, answers
            deleted_count, deleted_details = legacy_surveys.delete()
            self.stdout.write(self.style.SUCCESS(
                f'  ✓ Deleted {count} legacy surveys ({deleted_count} total objects)'
            ))
            for model_name, del_count in deleted_details.items():
                self.stdout.write(f'    - {model_name}: {del_count}')
        else:
            self.stdout.write(self.style.WARNING(
                f'  [DRY] Would delete {count} legacy surveys'
            ))
        self.stdout.write('')

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: Fix G16 — remove extra CONDITIONAL layers
    # ═══════════════════════════════════════════════════════════════════════════

    def _step2_fix_g16(self, do_fix):
        self.stdout.write(self.style.MIGRATE_HEADING(
            '─── STEP 2: Fix G16 (remove extra CONDITIONAL layers) ───'
        ))

        g16_questions = Question.objects.filter(
            criterion_code='G16',
            is_active=True
        ).order_by('order')

        if not g16_questions.exists():
            self.stdout.write('  No G16 questions found. Skipping.\n')
            return

        self.stdout.write(f'  G16 currently has {g16_questions.count()} questions:')
        for q in g16_questions:
            self.stdout.write(f'    order={q.order}, layer="{q.layer}", id={q.id}')

        # Find questions with CONDITIONAL layer (these are the extras to remove)
        conditional_qs = g16_questions.filter(layer='CONDITIONAL')

        if conditional_qs.count() == 0:
            self.stdout.write(self.style.SUCCESS('  ✓ G16 is already correct (no CONDITIONAL layers).\n'))
            return

        self.stdout.write(f'  Found {conditional_qs.count()} CONDITIONAL question(s) to remove:')
        for q in conditional_qs:
            self.stdout.write(f'    ID={q.id}, order={q.order}')

        if do_fix:
            del_count, _ = conditional_qs.delete()
            self.stdout.write(self.style.SUCCESS(
                f'  ✓ Deleted {del_count} extra CONDITIONAL question(s) from G16'
            ))

            remaining = Question.objects.filter(
                criterion_code='G16', is_active=True
            ).order_by('order')
            self.stdout.write(f'  G16 now has {remaining.count()} questions: '
                             f'{[q.layer for q in remaining]}')
        else:
            self.stdout.write(self.style.WARNING(
                f'  [DRY] Would delete {conditional_qs.count()} CONDITIONAL questions from G16'
            ))
        self.stdout.write('')

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 3: Fix E14 — remove extra CONDITIONAL
    # ═══════════════════════════════════════════════════════════════════════════

    def _step3_fix_e14(self, do_fix):
        self.stdout.write(self.style.MIGRATE_HEADING(
            '─── STEP 3: Fix E14 (should have GATE, P, I, CONDITIONAL, M, R) ───'
        ))

        e14_questions = Question.objects.filter(
            criterion_code='E14',
            is_active=True
        ).order_by('order')

        if not e14_questions.exists():
            self.stdout.write('  No E14 questions found. Skipping.\n')
            return

        self.stdout.write(f'  E14 currently has {e14_questions.count()} questions:')
        for q in e14_questions:
            self.stdout.write(f'    order={q.order}, layer="{q.layer}", id={q.id}')

        # E14 should have exactly 6 questions: GATE, P, I, CONDITIONAL, M, R
        conditional_qs = list(e14_questions.filter(layer='CONDITIONAL'))

        if len(conditional_qs) <= 1:
            if e14_questions.count() == 6:
                self.stdout.write(self.style.SUCCESS(
                    '  ✓ E14 is already correct (6 questions, 1 CONDITIONAL).\n'
                ))
                return
            else:
                self.stdout.write(self.style.WARNING(
                    f'  E14 has {e14_questions.count()} questions (expected 6) but CONDITIONAL count is OK.'
                ))
                self.stdout.write('')
                return

        # Keep the first CONDITIONAL, delete the rest
        extras_to_delete = conditional_qs[1:]
        extra_ids = [q.id for q in extras_to_delete]

        self.stdout.write(f'  Found {len(extras_to_delete)} extra CONDITIONAL question(s) to remove:')
        for q in extras_to_delete:
            self.stdout.write(f'    ID={q.id}, order={q.order}')

        if do_fix:
            del_count, _ = Question.objects.filter(id__in=extra_ids).delete()
            self.stdout.write(self.style.SUCCESS(
                f'  ✓ Deleted {del_count} extra CONDITIONAL question(s) from E14'
            ))

            remaining = Question.objects.filter(
                criterion_code='E14', is_active=True
            ).order_by('order')
            self.stdout.write(f'  E14 now has {remaining.count()} questions: '
                             f'{[q.layer for q in remaining]}')
        else:
            self.stdout.write(self.style.WARNING(
                f'  [DRY] Would delete {len(extras_to_delete)} CONDITIONAL questions from E14'
            ))
        self.stdout.write('')

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 4: Fix sector module scores
    # ═══════════════════════════════════════════════════════════════════════════

    def _step4_fix_sectors(self, do_fix):
        self.stdout.write(self.style.MIGRATE_HEADING(
            '─── STEP 4: Fix Sector Module Scores ───'
        ))

        for sector_code, spec in SECTOR_MASTER.items():
            sector_name = spec['name']
            survey_id = spec['survey_id']
            expected_max = spec['max_points']
            expected_count = spec['question_count']
            q_specs = spec['questions']

            self.stdout.write(f'\n  [{sector_code.upper()}] {sector_name} (Survey ID={survey_id})')
            self.stdout.write(f'    Expected: {expected_count} questions, {expected_max}pt max')

            # Find sector questions by survey ID
            sector_qs = Question.objects.filter(
                survey_id=survey_id,
                is_active=True,
            ).order_by('order')

            current_count = sector_qs.count()
            self.stdout.write(f'    Current: {current_count} questions')

            if current_count == 0:
                self.stdout.write(self.style.WARNING(
                    f'    [!] No questions found in survey {survey_id}. Skipping.'
                ))
                continue

            # Identify "main" questions (non-CONDITIONAL) and CONDITIONAL ones
            main_qs = list(sector_qs.exclude(layer='CONDITIONAL'))
            conditional_qs = list(sector_qs.filter(layer='CONDITIONAL'))

            self.stdout.write(f'    Main questions: {len(main_qs)}, Conditional: {len(conditional_qs)}')

            # If main questions exceed expected count, delete extras
            if len(main_qs) > expected_count:
                extras = main_qs[expected_count:]
                extra_ids = [q.id for q in extras]
                self.stdout.write(self.style.WARNING(
                    f'    [!] {len(extras)} extra main question(s) to delete'
                ))

                if do_fix:
                    del_count, _ = Question.objects.filter(id__in=extra_ids).delete()
                    self.stdout.write(self.style.SUCCESS(
                        f'    ✓ Deleted {del_count} extra main question(s)'
                    ))
                    main_qs = main_qs[:expected_count]

            # Now fix choice scores and question types for each main question
            fixes_applied = 0
            for idx, q_obj in enumerate(main_qs[:expected_count]):
                if idx >= len(q_specs):
                    break

                q_code, expected_q_max, expected_type, is_multi, expected_scores = q_specs[idx]

                # Fix question type if needed
                type_changed = False
                if expected_type == 'numerical' and q_obj.question_type != 'numerical':
                    if do_fix:
                        q_obj.question_type = 'numerical'
                        q_obj.allow_multiple = False
                        type_changed = True
                elif expected_type == 'multi' and (q_obj.question_type != 'multi' or not q_obj.allow_multiple):
                    if do_fix:
                        q_obj.question_type = 'multi'
                        q_obj.allow_multiple = True
                        type_changed = True
                elif expected_type == 'binary' and q_obj.question_type not in ('binary', 'single'):
                    if do_fix:
                        q_obj.question_type = 'binary'
                        q_obj.allow_multiple = False
                        type_changed = True
                elif expected_type == 'single' and q_obj.question_type not in ('single', 'choice'):
                    if do_fix:
                        q_obj.question_type = 'single'
                        q_obj.allow_multiple = False
                        type_changed = True

                if is_multi and not q_obj.allow_multiple:
                    if do_fix:
                        q_obj.allow_multiple = True
                        type_changed = True

                # Fix numerical thresholds
                if expected_type == 'numerical':
                    thresholds = NUMERICAL_THRESHOLDS.get(q_code)
                    if thresholds:
                        if q_obj.numerical_thresholds != thresholds:
                            if do_fix:
                                q_obj.numerical_thresholds = thresholds
                                type_changed = True
                    else:
                        # Generate thresholds from expected_scores
                        generated = []
                        for i, score in enumerate(expected_scores):
                            generated.append({'min': 0, 'max': 100, 'score': score})
                        # Only set if no proper thresholds exist
                        if not q_obj.numerical_thresholds or q_obj.get_max_possible_score() != expected_q_max:
                            if do_fix:
                                # Use a simple threshold that yields correct max
                                q_obj.numerical_thresholds = [
                                    {'min': 0, 'max': 100, 'score': expected_q_max}
                                ]
                                type_changed = True

                if type_changed:
                    q_obj.save(update_fields=[
                        'question_type', 'allow_multiple', 'numerical_thresholds'
                    ])
                    fixes_applied += 1

                # Fix choices for non-numerical questions (or numerical that use choices)
                if expected_type in ('single', 'multi', 'binary') or (
                    expected_type == 'numerical' and q_obj.choices.exists()
                ):
                    self._fix_choices(q_obj, expected_scores, is_multi, do_fix)
                elif expected_type == 'numerical' and not q_obj.choices.exists():
                    # Numerical questions use thresholds, not choices - ensure no stale choices
                    pass

            # Also handle CONDITIONAL questions that should NOT count toward the 12
            # They are bonus/follow-up and their score should stay as-is

            if do_fix and fixes_applied > 0:
                self.stdout.write(self.style.SUCCESS(
                    f'    ✓ Fixed {fixes_applied} question type(s)/thresholds'
                ))

            # Validate final max score
            self._validate_sector_max(survey_id, expected_count, expected_max)

    def _fix_choices(self, q_obj, expected_scores, is_multi, do_fix):
        """Fix choice scores for a question to match expected_scores."""
        choices = list(q_obj.choices.all().order_by('order'))
        current_scores = [c.score for c in choices]

        if current_scores == expected_scores:
            return  # Already correct

        if not do_fix:
            return

        if len(choices) == len(expected_scores):
            # Same number of choices - just update scores
            for i, choice in enumerate(choices):
                if choice.score != expected_scores[i]:
                    choice.score = expected_scores[i]
                    choice.save(update_fields=['score'])
        elif len(choices) > len(expected_scores):
            # More choices than expected - update existing, delete extras
            for i in range(len(expected_scores)):
                if choices[i].score != expected_scores[i]:
                    choices[i].score = expected_scores[i]
                    choices[i].save(update_fields=['score'])
            extra_ids = [c.id for c in choices[len(expected_scores):]]
            Choice.objects.filter(id__in=extra_ids).delete()
        elif len(choices) < len(expected_scores):
            # Fewer choices than expected - update existing, create missing
            for i in range(len(choices)):
                if choices[i].score != expected_scores[i]:
                    choices[i].score = expected_scores[i]
                    choices[i].save(update_fields=['score'])
            # Create missing choices
            for i in range(len(choices), len(expected_scores)):
                score = expected_scores[i]
                # Generate appropriate text
                if is_multi:
                    text = f'Option {i+1}'
                elif len(expected_scores) == 2:
                    text = 'Yes' if i == 0 else 'No'
                else:
                    text = f'Option {i+1}'
                Choice.objects.create(
                    question=q_obj,
                    text=text,
                    text_en=text,
                    text_tr=text,
                    score=score,
                    order=i + 1,
                )

    def _validate_sector_max(self, survey_id, expected_count, expected_max):
        """Validate the total max score for a sector survey."""
        # Count only non-CONDITIONAL questions for the sector max
        sector_qs = Question.objects.filter(
            survey_id=survey_id,
            is_active=True,
        ).exclude(layer='CONDITIONAL').order_by('order')[:expected_count]

        actual_max = 0
        for q in sector_qs.prefetch_related('choices'):
            actual_max += q.get_max_possible_score()

        status = '✓' if actual_max == expected_max else '✗'
        style = self.style.SUCCESS if actual_max == expected_max else self.style.ERROR
        self.stdout.write(style(
            f'    {status} Max score: {actual_max}pt (expected {expected_max}pt)'
        ))

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 5: Validation Report
    # ═══════════════════════════════════════════════════════════════════════════

    def _step5_validation_report(self):
        self.stdout.write(self.style.MIGRATE_HEADING(
            '\n═══════════════════════════════════════════════════════'
        ))
        self.stdout.write(self.style.MIGRATE_HEADING(
            '  VALIDATION REPORT'
        ))
        self.stdout.write(self.style.MIGRATE_HEADING(
            '═══════════════════════════════════════════════════════\n'
        ))

        # 1. Survey count
        total_surveys = Survey.objects.count()
        v5_surveys = Survey.objects.filter(id__gte=18, id__lte=29).count()
        legacy_remaining = Survey.objects.filter(id__lte=17).count()

        self.stdout.write(f'  Total surveys: {total_surveys}')
        self.stdout.write(f'  v5 surveys (18-29): {v5_surveys}')
        if legacy_remaining > 0:
            self.stdout.write(self.style.ERROR(
                f'  ✗ Legacy surveys remaining: {legacy_remaining}'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                '  ✓ No legacy surveys remaining'
            ))

        # 2. G16 status
        g16_count = Question.objects.filter(
            criterion_code='G16', is_active=True
        ).count()
        g16_layers = list(
            Question.objects.filter(criterion_code='G16', is_active=True)
            .order_by('order').values_list('layer', flat=True)
        )
        g16_ok = set(g16_layers) <= set(G16_ALLOWED_LAYERS) and len(g16_layers) == 4
        status = '✓' if g16_ok else '✗'
        style = self.style.SUCCESS if g16_ok else self.style.ERROR
        self.stdout.write(style(
            f'\n  {status} G16: {g16_count} questions, layers={g16_layers}'
        ))
        if not g16_ok:
            self.stdout.write(f'    Expected: 4 questions with layers {G16_ALLOWED_LAYERS}')

        # 3. E14 status
        e14_count = Question.objects.filter(
            criterion_code='E14', is_active=True
        ).count()
        e14_layers = list(
            Question.objects.filter(criterion_code='E14', is_active=True)
            .order_by('order').values_list('layer', flat=True)
        )
        e14_ok = (e14_layers == E14_ALLOWED_LAYERS)
        status = '✓' if e14_ok else '✗'
        style = self.style.SUCCESS if e14_ok else self.style.ERROR
        self.stdout.write(style(
            f'  {status} E14: {e14_count} questions, layers={e14_layers}'
        ))
        if not e14_ok:
            self.stdout.write(f'    Expected: 6 questions with layers {E14_ALLOWED_LAYERS}')

        # 4. Sector modules
        self.stdout.write(self.style.MIGRATE_HEADING(
            '\n  ─── Sector Module Summary ───'
        ))

        all_sectors_ok = True
        for sector_code, spec in SECTOR_MASTER.items():
            sector_name = spec['name']
            survey_id = spec['survey_id']
            expected_max = spec['max_points']
            expected_count = spec['question_count']

            # Count non-CONDITIONAL questions
            sector_qs = Question.objects.filter(
                survey_id=survey_id,
                is_active=True,
            ).exclude(layer='CONDITIONAL').order_by('order')[:expected_count]

            actual_count = sector_qs.count()
            actual_max = 0
            for q in sector_qs.prefetch_related('choices'):
                actual_max += q.get_max_possible_score()

            count_ok = (actual_count == expected_count)
            score_ok = (actual_max == expected_max)
            both_ok = count_ok and score_ok

            if not both_ok:
                all_sectors_ok = False

            status = '✓' if both_ok else '✗'
            style = self.style.SUCCESS if both_ok else self.style.ERROR
            self.stdout.write(style(
                f'  {status} {sector_name:30s} '
                f'Q: {actual_count}/{expected_count}  '
                f'Max: {actual_max}/{expected_max}pt'
            ))

        # Final summary
        self.stdout.write('')
        if all_sectors_ok and g16_ok and e14_ok and legacy_remaining == 0:
            self.stdout.write(self.style.SUCCESS(
                '  ══════════════════════════════════════════'
            ))
            self.stdout.write(self.style.SUCCESS(
                '  ✓ ALL CHECKS PASSED — Data is correct!'
            ))
            self.stdout.write(self.style.SUCCESS(
                '  ══════════════════════════════════════════'
            ))
        else:
            self.stdout.write(self.style.ERROR(
                '  ══════════════════════════════════════════'
            ))
            self.stdout.write(self.style.ERROR(
                '  ✗ SOME CHECKS FAILED — Review above'
            ))
            self.stdout.write(self.style.ERROR(
                '  ══════════════════════════════════════════'
            ))
            if not all_sectors_ok:
                self.stdout.write(self.style.WARNING(
                    '    → Run with --fix to correct sector scores'
                ))
