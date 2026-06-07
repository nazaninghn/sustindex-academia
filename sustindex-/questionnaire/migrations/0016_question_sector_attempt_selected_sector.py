"""
Migration 0016 — Branching questionnaire by sector.

Adds:
  - Question.sector            (CharField, blank=True, default='')
  - QuestionnaireAttempt.selected_sector  (CharField, blank=True, default='')

Universal questions have sector='' and are shown to every respondent.
Sector-specific questions are shown only when the attempt's selected_sector
matches the question's sector value.

Existing data is unaffected: all existing questions default to sector=''
(universal) and all existing attempts default to selected_sector=''
(no sector selected — backward-compatible).
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0015_make_legacy_scores_optional'),
    ]

    operations = [
        # Add sector to Question
        migrations.AddField(
            model_name='question',
            name='sector',
            field=models.CharField(
                blank=True,
                choices=[
                    ('',             'Universal (all sectors)'),
                    ('agri',         'Agriculture'),
                    ('finance',      'Financial Services'),
                    ('construction', 'Construction'),
                    ('manufacturing','Manufacturing'),
                    ('health',       'Healthcare'),
                    ('tech',         'Technology'),
                    ('retail',       'Retail & Trade'),
                ],
                default='',
                help_text=(
                    "Leave blank for universal questions (shown to all respondents). "
                    "Set to a specific sector to show this question only to respondents "
                    "who selected that sector when starting their attempt."
                ),
                max_length=20,
                verbose_name='Sector',
            ),
        ),
        # Add selected_sector to QuestionnaireAttempt
        migrations.AddField(
            model_name='questionnaireattempt',
            name='selected_sector',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Industry sector chosen by the user at the start of this attempt.',
                max_length=20,
                verbose_name='Selected Sector',
            ),
        ),
    ]
