from django.db import models
from django.conf import settings
from ckeditor.fields import RichTextField
from django.utils.translation import gettext_lazy as _


LEVEL_CHOICES = [
    ('beg', 'Beginner'),
    ('int', 'Intermediate'),
    ('adv', 'Advanced'),
]


class Course(models.Model):
    """E-learning courses — global platform content, optionally linked to a company."""
    company = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='courses',
        verbose_name=_('Company (optional)'),
        help_text=_('Leave blank for global/platform-wide courses.')
    )
    title      = models.CharField(max_length=200, verbose_name=_('Title'))
    title_tr   = models.CharField(max_length=200, blank=True, default='', verbose_name=_('Title (TR)'))
    title_en   = models.CharField(max_length=200, blank=True, default='', verbose_name=_('Title (EN)'))
    description    = RichTextField(verbose_name=_('Description'))
    description_tr = RichTextField(blank=True, default='', verbose_name=_('Description (TR)'))
    description_en = RichTextField(blank=True, default='', verbose_name=_('Description (EN)'))
    thumbnail  = models.ImageField(upload_to='course_thumbnails/', blank=True, verbose_name=_('Thumbnail'))

    # Display metadata
    tag           = models.CharField(max_length=60, blank=True, default='ESG',    verbose_name=_('Tag / Framework'))
    level         = models.CharField(max_length=3, choices=LEVEL_CHOICES, default='int', verbose_name=_('Level'))
    icon_emoji    = models.CharField(max_length=10, blank=True, default='📚',    verbose_name=_('Icon Emoji'))
    duration_hours = models.CharField(max_length=20, blank=True, default='',     verbose_name=_('Duration (display)'))
    order         = models.IntegerField(default=0,                               verbose_name=_('Sort Order'))

    is_active  = models.BooleanField(default=True, verbose_name=_('Active'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created At'))

    class Meta:
        verbose_name = _('Course')
        verbose_name_plural = _('Courses')
        ordering = ['order', '-created_at']

    def __str__(self):
        company_str = f' — {self.company.company_name}' if self.company else ''
        return f'{self.title}{company_str}'


class Lesson(models.Model):
    """Lessons within each course"""
    course    = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='lessons', verbose_name=_('Course'))
    title     = models.CharField(max_length=200, verbose_name=_('Title'))
    title_tr  = models.CharField(max_length=200, blank=True, default='', verbose_name=_('Title (TR)'))
    title_en  = models.CharField(max_length=200, blank=True, default='', verbose_name=_('Title (EN)'))
    content   = RichTextField(verbose_name=_('Content'))
    video_url = models.URLField(blank=True, verbose_name=_('Video URL'))
    order     = models.IntegerField(default=0, verbose_name=_('Order'))
    duration_minutes = models.IntegerField(default=0, verbose_name=_('Duration (minutes)'))

    class Meta:
        verbose_name = _('Lesson')
        verbose_name_plural = _('Lessons')
        ordering = ['order']
        # Fix #42: enforce uniqueness so duplicate order values within a course are rejected at DB level.
        unique_together = [('course', 'order')]

    def __str__(self):
        return f'{self.course.title} — {self.title}'


class LessonAttachment(models.Model):
    lesson      = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='attachments', verbose_name=_('Lesson'))
    title       = models.CharField(max_length=200, verbose_name=_('Title'))
    file        = models.FileField(upload_to='lesson_attachments/', verbose_name=_('File'))
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Uploaded At'))

    class Meta:
        verbose_name = _('Lesson Attachment')
        verbose_name_plural = _('Lesson Attachments')

    def __str__(self):
        return self.title


class LessonProgress(models.Model):
    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='lesson_progress', verbose_name=_('User'))
    lesson      = models.ForeignKey(Lesson, on_delete=models.CASCADE, verbose_name=_('Lesson'))
    is_completed = models.BooleanField(default=False, verbose_name=_('Completed'))
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Completed At'))

    class Meta:
        verbose_name = _('Lesson Progress')
        verbose_name_plural = _('Lesson Progress')
        unique_together = ['user', 'lesson']

    def __str__(self):
        return f'{self.user.username} — {self.lesson.title}'
