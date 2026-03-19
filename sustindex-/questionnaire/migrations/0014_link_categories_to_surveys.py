"""
Data migration: Link existing categories to their surveys based on questions.
"""
from django.db import migrations


def link_categories_to_surveys(apps, schema_editor):
    Category = apps.get_model('questionnaire', 'Category')
    Question = apps.get_model('questionnaire', 'Question')
    
    for category in Category.objects.filter(survey__isnull=True):
        # Find the survey from the category's questions
        question = Question.objects.filter(category=category, survey__isnull=False).first()
        if question:
            category.survey = question.survey
            category.save()


def reverse_link(apps, schema_editor):
    # No need to reverse - just leave survey as is
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0013_add_survey_to_category'),
    ]

    operations = [
        migrations.RunPython(link_categories_to_surveys, reverse_link),
    ]
