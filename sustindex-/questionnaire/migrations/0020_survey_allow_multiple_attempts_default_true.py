# Fix START-1: change allow_multiple_attempts default from False → True.
#
# The old default blocked the GRI 4-phase flow:
#   • "Retry" on phases 1/2/3 was rejected because the survey already had a
#     completed attempt and allow_multiple_attempts was False.
#   • The Retry button in the wizard UI implied this should be allowed.
#
# Two-step migration:
#   1. Data: flip all existing surveys to allow_multiple_attempts=True so
#      current data in the DB matches the new product intent.
#   2. Schema: update the field default for surveys created in future.
#
# Reverse: surveys are set back to False (conservative rollback).

from django.db import migrations, models


def enable_multiple_attempts(apps, schema_editor):
    """Set allow_multiple_attempts=True on every existing Survey row."""
    Survey = apps.get_model('questionnaire', 'Survey')
    Survey.objects.filter(allow_multiple_attempts=False).update(allow_multiple_attempts=True)


def disable_multiple_attempts(apps, schema_editor):
    """Rollback: set every Survey back to allow_multiple_attempts=False."""
    Survey = apps.get_model('questionnaire', 'Survey')
    Survey.objects.all().update(allow_multiple_attempts=False)


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0019_add_unique_completed_attempt'),
    ]

    operations = [
        # Phase 1: update existing rows first so the schema change is safe.
        migrations.RunPython(
            enable_multiple_attempts,
            reverse_code=disable_multiple_attempts,
        ),
        # Phase 2: change the model/DB default for future surveys.
        migrations.AlterField(
            model_name='survey',
            name='allow_multiple_attempts',
            field=models.BooleanField(
                default=True,
                verbose_name='Allow Multiple Attempts',
            ),
        ),
    ]
