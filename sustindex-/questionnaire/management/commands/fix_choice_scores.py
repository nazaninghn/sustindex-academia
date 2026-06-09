"""
fix_choice_scores.py
────────────────────
Management command to fix incorrect choice scores across all questionnaire
questions.

Rule (confirmed by project owner):
  • 4 choices per question (A=order 0, B=order 1, C=order 2, D=order 3)
  • If A.score == 4  →  [4, 3, 2, 0]
  • If A.score == 6  →  [6, 4, 3, 0]
  • All other questions are skipped (not touched).

Known bugs this fixes
---------------------
Type 1 – B score > Max:   e.g. A=4, B=6, C=4, D=0  → A=4, B=3, C=2, D=0
Type 2 – Flat scores:     e.g. A=4, B=4, C=4, D=0  → A=4, B=3, C=2, D=0
Type 2b– Partial flat:    e.g. A=4, B=4, C=3, D=0  → A=4, B=3, C=2, D=0

Usage:
    python manage.py fix_choice_scores           # dry-run (shows what would change)
    python manage.py fix_choice_scores --apply   # apply changes to database
"""

from django.core.management.base import BaseCommand
from questionnaire.models import Question, Choice


# Score maps keyed by the A-choice's score (always the correct max).
SCORE_MAP = {
    4: [4, 3, 2, 0],
    6: [6, 4, 3, 0],
}


class Command(BaseCommand):
    help = 'Fix incorrect choice scores (A=max, B/C/D descending)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            default=False,
            help='Actually save changes to the database (default: dry-run only)',
        )

    def handle(self, *args, **options):
        apply = options['apply']
        mode = 'APPLY' if apply else 'DRY-RUN'
        self.stdout.write(self.style.WARNING(f'\n=== fix_choice_scores [{mode}] ===\n'))

        fixed_count   = 0
        skipped_count = 0
        ok_count      = 0

        # Prefetch choices for all active questions in one query.
        questions = (
            Question.objects
            .filter(is_active=True)
            .prefetch_related('choices')
        )

        for question in questions:
            choices = list(question.choices.order_by('order'))

            # Only process questions with exactly 4 choices.
            if len(choices) != 4:
                skipped_count += 1
                continue

            # A's score (order=0) is always the correct max.
            max_score = choices[0].score
            expected = SCORE_MAP.get(max_score)

            if expected is None:
                # Max score is not 4 or 6 — leave untouched.
                skipped_count += 1
                continue

            current_scores = [c.score for c in choices]

            if current_scores == expected:
                ok_count += 1
                continue

            # Scores differ — fix them.
            fixed_count += 1
            label = question.text[:70].replace('\n', ' ')
            self.stdout.write(
                f'  [{question.id}] {label}\n'
                f'       Before: {current_scores}\n'
                f'       After:  {expected}\n'
            )

            if apply:
                for choice, new_score in zip(choices, expected):
                    if choice.score != new_score:
                        choice.score = new_score
                        choice.save(update_fields=['score'])

        # ── Summary ────────────────────────────────────────────────────────
        self.stdout.write('\n' + '-' * 60)
        self.stdout.write(
            self.style.SUCCESS(f'  OK (already correct): {ok_count}')
        )
        self.stdout.write(
            self.style.WARNING(f'  Skipped (non-standard): {skipped_count}')
        )

        if apply:
            self.stdout.write(
                self.style.SUCCESS(f'  Fixed and saved:       {fixed_count}')
            )
            self.stdout.write(
                self.style.SUCCESS(f'\nDone. {fixed_count} questions fixed and saved to database.\n')
            )
        else:
            self.stdout.write(
                self.style.ERROR(f'  Would fix (dry-run):   {fixed_count}')
            )
            self.stdout.write(
                self.style.WARNING(
                    '\nDry-run complete - no changes saved.\n'
                    'Run with --apply to apply the fixes:\n'
                    '    python manage.py fix_choice_scores --apply\n'
                )
            )
