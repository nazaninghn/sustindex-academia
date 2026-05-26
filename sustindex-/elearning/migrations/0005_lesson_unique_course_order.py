from django.db import migrations


class Migration(migrations.Migration):
    """Fix #42: enforce unique (course, order) on Lesson so duplicate order
    values within the same course are rejected at the database level."""

    dependencies = [
        ('elearning', '0004_alter_course_options_alter_course_description_en_and_more'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='lesson',
            unique_together={('course', 'order')},
        ),
    ]
