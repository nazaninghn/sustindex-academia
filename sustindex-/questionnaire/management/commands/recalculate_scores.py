"""
recalculate_scores.py
─────────────────────
Recalculates and saves total_score / environmental_score / social_score /
governance_score / overall_grade for every completed QuestionnaireAttempt.

Run this once after fix_choice_scores --apply to bring stored scores in sync
with the corrected choice.score values.

Usage:
    python manage.py recalculate_scores           # dry-run (shows changes, saves nothing)
    python manage.py recalculate_scores --apply   # persist updated scores to database
"""

from django.core.management.base import BaseCommand
from questionnaire.models import QuestionnaireAttempt


class Command(BaseCommand):
    help = 'Recalculate stored scores for all completed attempts after choice score fix'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            default=False,
            help='Actually save recalculated scores to the database (default: dry-run)',
        )

    def handle(self, *args, **options):
        apply = options['apply']
        mode = 'APPLY' if apply else 'DRY-RUN'
        self.stdout.write(f'\n=== recalculate_scores [{mode}] ===\n')

        attempts = (
            QuestionnaireAttempt.objects
            .filter(is_completed=True)
            .select_related('survey', 'user')
            .prefetch_related(
                'answers',
                'answers__choice',
                'answers__choices',
                'answers__question__choices',
            )
        )

        total        = attempts.count()
        changed      = 0
        unchanged    = 0
        errors       = 0

        self.stdout.write(f'Processing {total} completed attempts...\n')

        for attempt in attempts:
            try:
                old_total = attempt.total_score
                old_grade = attempt.overall_grade

                # calculate_scores(save=False) computes new values without saving.
                attempt.calculate_scores(save=False)
                new_total = attempt.total_score
                new_grade = attempt.overall_grade

                if old_total != new_total or old_grade != new_grade:
                    changed += 1
                    user_label = getattr(attempt.user, 'username', str(attempt.user_id))
                    survey_label = attempt.survey.name if attempt.survey else '?'
                    self.stdout.write(
                        f'  Attempt #{attempt.id}  user={user_label}  survey={survey_label}\n'
                        f'    Score: {old_total} -> {new_total}  |  Grade: {old_grade} -> {new_grade}\n'
                    )
                    if apply:
                        attempt.calculate_scores(save=True)
                else:
                    unchanged += 1

            except Exception as exc:
                errors += 1
                self.stderr.write(
                    self.style.ERROR(f'  ERROR on attempt #{attempt.id}: {exc}')
                )

        self.stdout.write('\n' + '-' * 60)
        self.stdout.write(f'  Total attempts:    {total}')
        self.stdout.write(self.style.SUCCESS(f'  Unchanged:         {unchanged}'))

        if apply:
            self.stdout.write(self.style.SUCCESS(f'  Updated and saved: {changed}'))
            if errors:
                self.stdout.write(self.style.ERROR(f'  Errors:            {errors}'))
            self.stdout.write(
                self.style.SUCCESS(f'\nDone. {changed} attempt scores recalculated and saved.\n')
            )
        else:
            self.stdout.write(self.style.WARNING(f'  Would update:      {changed}'))
            if errors:
                self.stdout.write(self.style.ERROR(f'  Errors:            {errors}'))
            self.stdout.write(
                self.style.WARNING(
                    '\nDry-run complete - no changes saved.\n'
                    'Run with --apply to save recalculated scores:\n'
                    '    python manage.py recalculate_scores --apply\n'
                )
            )
