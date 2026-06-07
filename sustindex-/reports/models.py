from django.db import models
from django.conf import settings
from questionnaire.models import QuestionnaireAttempt
from django.utils.translation import gettext_lazy as _


class Report(models.Model):
    """Generated reports from questionnaire attempts"""
    attempt = models.OneToOneField(QuestionnaireAttempt, on_delete=models.CASCADE, related_name='report', verbose_name=_('Attempt'))
    generated_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Generated At'))
    pdf_file = models.FileField(upload_to='reports/', blank=True, verbose_name=_('PDF File'))
    
    class Meta:
        verbose_name = _('Report')
        verbose_name_plural = _('Reports')
        ordering = ['-generated_at']
    
    def __str__(self):
        # Fix R10-04: avoid chaining attempt.user.username (2 lazy-load queries
        # per row in admin list views).  attempt_id is a cached FK integer —
        # no extra DB round-trip required.
        return f"Report #{self.attempt_id} — {self.generated_at.strftime('%Y-%m-%d')}"


class ReportSection(models.Model):
    """Sections within a report"""
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name='sections', verbose_name=_('Report'))
    title = models.CharField(max_length=200, verbose_name=_('Section Title'))
    content = models.TextField(verbose_name=_('Content'))
    order = models.IntegerField(default=0, verbose_name=_('Order'))
    
    class Meta:
        verbose_name = _('Report Section')
        verbose_name_plural = _('Report Sections')
        ordering = ['order']
    
    def __str__(self):
        return f"{self.report} - {self.title}"
