"""
Migration 0017 — Update Question.sector choices.

Changes:
  - Adds the missing 'energy' / 'Energy & Utilities' choice.
  - Updates display labels to match the full sector names used throughout
    the UI (e.g. 'Agriculture & Food' instead of 'Agriculture').

The underlying column is unchanged (VARCHAR(20), blank=True, default='').
This migration only aligns the choice list that Django stores in the
migration state; no data migration is required.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0016_question_sector_attempt_selected_sector'),
    ]

    operations = [
        migrations.AlterField(
            model_name='question',
            name='sector',
            field=models.CharField(
                blank=True,
                choices=[
                    ('',             'Universal (all sectors)'),
                    ('agri',         'Agriculture & Food'),
                    ('energy',       'Energy & Utilities'),
                    ('finance',      'Financial Services'),
                    ('construction', 'Construction & Real Estate'),
                    ('manufacturing','Manufacturing & Industry'),
                    ('health',       'Healthcare & Pharma'),
                    ('tech',         'Technology & IT'),
                    ('retail',       'Retail & Trade'),
                ],
                default='',
                help_text=(
                    'Leave blank for universal questions (shown to all respondents). '
                    'Set to a specific sector to show this question only to respondents '
                    'who selected that sector when starting their attempt.'
                ),
                max_length=20,
                verbose_name='Sector',
            ),
        ),
    ]
