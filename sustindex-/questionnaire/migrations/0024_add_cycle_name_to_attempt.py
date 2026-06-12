from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('questionnaire', '0023_add_question_types_gate_numerical_conditional'),
    ]
    operations = [
        migrations.AddField(
            model_name='questionnaireattempt',
            name='cycle_name',
            field=models.CharField(
                blank=True,
                default='',
                help_text='User-defined label for this assessment cycle (e.g. "Q1 2026"). All 5 phases started in one cycle share this name.',
                max_length=200,
                verbose_name='Cycle Name',
            ),
        ),
    ]
