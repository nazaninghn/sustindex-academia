# Fix START-2: drop the unique_completed_attempt partial-unique constraint.
#
# Background
# ──────────
# Migration 0019 added a UniqueConstraint(fields=['user','survey'],
# condition=Q(is_completed=True)) as a DB-level guard against concurrent
# double-completions (BH-2).  However, after enabling allow_multiple_attempts
# (migration 0020) and removing attempt limits (settings.py), users can now
# start a *second* attempt for the same survey — yet completing it is blocked
# by the very constraint that was meant to protect them.
#
# The select_for_update() + transaction.atomic() in the complete action already
# serialises concurrent requests on the same attempt row, so the DB constraint
# is redundant.  Removing it lets the GRI Retry flow work end-to-end.
#
# Reverse: re-adds the constraint (safe because re-adding a partial unique
# index only fails if duplicate rows already exist; DBA should verify first).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0020_survey_allow_multiple_attempts_default_true'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='questionnaireAttempt',
            name='unique_completed_attempt',
        ),
    ]
