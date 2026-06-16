from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0025_attempt_bookmarked_questions'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ActionTask',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=500, verbose_name='Title')),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('category', models.CharField(blank=True, max_length=200, verbose_name='GRI Category')),
                ('priority', models.CharField(blank=True, max_length=20, verbose_name='Priority')),
                ('status', models.CharField(
                    choices=[
                        ('todo',        'To Do'),
                        ('in_progress', 'In Progress'),
                        ('done',        'Done'),
                        ('wont_do',     "Won't Do"),
                    ],
                    default='todo', max_length=20, verbose_name='Status',
                )),
                ('due_date', models.DateField(blank=True, null=True, verbose_name='Due Date')),
                ('notes', models.TextField(blank=True, verbose_name='Notes')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created At')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated At')),
                ('attempt', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='action_tasks',
                    to='questionnaire.questionnaireattempt',
                    verbose_name='Assessment Attempt',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='action_tasks',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='User',
                )),
            ],
            options={
                'verbose_name': 'Action Task',
                'verbose_name_plural': 'Action Tasks',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='actiontask',
            index=models.Index(fields=['user', 'status'], name='at_user_status_idx'),
        ),
    ]
