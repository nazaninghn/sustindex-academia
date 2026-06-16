from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0024_add_cycle_name_to_attempt'),
    ]

    operations = [
        migrations.AddField(
            model_name='questionnaireattempt',
            name='bookmarked_questions',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='List of question IDs that the user has flagged for review during this attempt.',
                verbose_name='Bookmarked Questions',
            ),
        ),
    ]
