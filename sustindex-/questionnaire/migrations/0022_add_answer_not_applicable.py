from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0021_remove_unique_completed_attempt'),
    ]

    operations = [
        migrations.AddField(
            model_name='answer',
            name='not_applicable',
            field=models.BooleanField(
                default=False,
                help_text='User marked this question as not applicable to their organisation. Excluded from score calculation.',
                verbose_name='Not Applicable',
            ),
        ),
    ]
