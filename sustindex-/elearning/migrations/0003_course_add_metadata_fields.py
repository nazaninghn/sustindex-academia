from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('elearning', '0002_alter_course_options_alter_lesson_options_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Make company nullable
        migrations.AlterField(
            model_name='course',
            name='company',
            field=models.ForeignKey(
                blank=True,
                help_text='Leave blank for global/platform-wide courses.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='courses',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Company (optional)',
            ),
        ),

        # 2. Bilingual title
        migrations.AddField(
            model_name='course',
            name='title_tr',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='Title (TR)'),
        ),
        migrations.AddField(
            model_name='course',
            name='title_en',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='Title (EN)'),
        ),

        # 3. Bilingual description
        migrations.AddField(
            model_name='course',
            name='description_tr',
            field=models.TextField(blank=True, default='', verbose_name='Description (TR)'),
        ),
        migrations.AddField(
            model_name='course',
            name='description_en',
            field=models.TextField(blank=True, default='', verbose_name='Description (EN)'),
        ),

        # 4. Display metadata
        migrations.AddField(
            model_name='course',
            name='tag',
            field=models.CharField(blank=True, default='ESG', max_length=60, verbose_name='Tag / Framework'),
        ),
        migrations.AddField(
            model_name='course',
            name='level',
            field=models.CharField(
                choices=[('beg', 'Beginner'), ('int', 'Intermediate'), ('adv', 'Advanced')],
                default='int', max_length=3, verbose_name='Level',
            ),
        ),
        migrations.AddField(
            model_name='course',
            name='icon_emoji',
            field=models.CharField(blank=True, default='📚', max_length=10, verbose_name='Icon Emoji'),
        ),
        migrations.AddField(
            model_name='course',
            name='duration_hours',
            field=models.CharField(blank=True, default='', max_length=20, verbose_name='Duration (display)'),
        ),
        migrations.AddField(
            model_name='course',
            name='order',
            field=models.IntegerField(default=0, verbose_name='Sort Order'),
        ),

        # 5. Bilingual lesson title
        migrations.AddField(
            model_name='lesson',
            name='title_tr',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='Title (TR)'),
        ),
        migrations.AddField(
            model_name='lesson',
            name='title_en',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='Title (EN)'),
        ),
    ]
