"""
Migration 0023: Extend questionnaire models for Phase A

Adds to Question:
  - criterion_code, layer, is_gate, numerical_thresholds
  - conditional_on_question (self-FK), conditional_on_min_score, bonus_points

Adds to Answer:
  - numerical_value

Alters Question.question_type choices to include new types while keeping
legacy 'choice'/'text'/'mixed' values for backward compatibility.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0022_add_answer_not_applicable'),
    ]

    operations = [
        # ── Question: new fields ─────────────────────────────────────────────
        migrations.AddField(
            model_name='question',
            name='criterion_code',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='e.g. G1, E3, S12 — groups questions belonging to the same PDCA criterion',
                max_length=20,
                verbose_name='Criterion Code',
            ),
        ),
        migrations.AddField(
            model_name='question',
            name='layer',
            field=models.CharField(
                blank=True,
                default='',
                help_text='GATE | P | I | M | R | CONDITIONAL',
                max_length=12,
                verbose_name='PDCA Layer',
            ),
        ),
        migrations.AddField(
            model_name='question',
            name='is_gate',
            field=models.BooleanField(
                default=False,
                help_text=(
                    'If Yes/high-score → criterion continues; if No/0 → all other '
                    'questions in the criterion are skipped (score 0, excluded from max).'
                ),
                verbose_name='Gate Question',
            ),
        ),
        migrations.AddField(
            model_name='question',
            name='numerical_thresholds',
            field=models.JSONField(
                blank=True,
                null=True,
                help_text=(
                    'For numerical questions: list of {min, max, score} bands. '
                    'Evaluated top-to-bottom; first match wins.'
                ),
                verbose_name='Numerical Thresholds',
            ),
        ),
        migrations.AddField(
            model_name='question',
            name='conditional_on_question',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='conditional_questions',
                to='questionnaire.question',
                help_text='This question is shown only when the referenced question has a qualifying answer.',
                verbose_name='Conditional On Question',
            ),
        ),
        migrations.AddField(
            model_name='question',
            name='conditional_on_min_score',
            field=models.PositiveSmallIntegerField(
                default=1,
                help_text='Show this question only when the parent question scores ≥ this value (default 1 = any non-zero answer).',
                verbose_name='Conditional Min Score',
            ),
        ),
        migrations.AddField(
            model_name='question',
            name='bonus_points',
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text='Extra points awarded when this conditional follow-up is answered correctly (added on top of the layer max).',
                verbose_name='Bonus Points',
            ),
        ),
        # ── Question: alter question_type choices ────────────────────────────
        migrations.AlterField(
            model_name='question',
            name='question_type',
            field=models.CharField(
                choices=[
                    ('single',    'Single Choice'),
                    ('choice',    'Single Choice (legacy)'),
                    ('binary',    'Binary (Yes / No)'),
                    ('multi',     'Multi-select'),
                    ('numerical', 'Numerical Input'),
                    ('text',      'Text (open-ended)'),
                    ('mixed',     'Mixed'),
                ],
                default='choice',
                max_length=10,
                verbose_name='Question Type',
            ),
        ),
        # ── Answer: numerical_value ──────────────────────────────────────────
        migrations.AddField(
            model_name='answer',
            name='numerical_value',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Stored answer for numerical-type questions. Score is derived via question.numerical_thresholds.',
                max_digits=12,
                null=True,
                verbose_name='Numerical Value',
            ),
        ),
    ]
