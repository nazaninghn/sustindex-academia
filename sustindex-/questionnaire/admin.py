from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from django.utils.html import format_html, strip_tags
from django.db import transaction
from django.utils import timezone
from django.urls import reverse
from django.utils.safestring import mark_safe

try:
    from dal import autocomplete
    DAL_AVAILABLE = True
except ImportError:
    DAL_AVAILABLE = False
    
from import_export.admin import ImportExportModelAdmin
from simple_history.admin import SimpleHistoryAdmin

# Dropdown filter disabled due to template issues
DROPDOWN_FILTER_AVAILABLE = False
RelatedDropdownFilter = None

from .models import Survey, SurveySession, Category, Question, Choice, QuestionnaireAttempt, Answer, UserDocument
from .services import recalc_attempt_score, attempt_stats, get_category_performance


# ========== Survey Admin ==========

@admin.register(Survey)
class SurveyAdmin(ImportExportModelAdmin, SimpleHistoryAdmin):
    list_display = ['id', 'name', 'is_active', 'questions_count', 'sessions_count', 'attempts_count', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    list_editable = ['is_active']
    date_hierarchy = 'created_at'
    list_per_page = 50
    
    fieldsets = (
        (_('Survey Information'), {
            'fields': ('name', 'description', 'is_active')
        }),
        (_('Settings'), {
            'fields': ('allow_multiple_attempts', 'show_results_immediately')
        }),
    )
    
    actions = ['duplicate_survey', 'activate_surveys', 'deactivate_surveys']
    
    @admin.display(description=_('Questions'))
    def questions_count(self, obj):
        count = obj.get_total_questions()
        return format_html('<strong>{}</strong> questions', count)
    
    @admin.display(description=_('Sessions'))
    def sessions_count(self, obj):
        total = obj.sessions.count()
        active = obj.get_active_sessions().count()
        return format_html(
            '<strong>{}</strong> total<br>'
            '<small style="color: #28A745;">{} active</small>',
            total, active
        )
    
    @admin.display(description=_('Attempts'))
    def attempts_count(self, obj):
        total = obj.attempts.count()
        completed = obj.attempts.filter(is_completed=True).count()
        return format_html(
            '<strong>{}</strong> total<br>'
            '<small style="color: #28A745;">{} completed</small>',
            total, completed
        )
    
    @admin.action(description=_('Duplicate selected surveys'))
    def duplicate_survey(self, request, queryset):
        for survey in queryset:
            new_survey = Survey.objects.create(
                name=f"{survey.name} (Copy)",
                description=survey.description,
                is_active=False,
                allow_multiple_attempts=survey.allow_multiple_attempts,
                show_results_immediately=survey.show_results_immediately
            )
            
            # Duplicate categories and build old->new mapping
            category_map = {}
            for category in survey.categories.all():
                old_id = category.pk
                category.pk = None
                category.survey = new_survey
                category.save()
                category_map[old_id] = category
            
            for question in survey.questions.all():
                old_choices = list(question.choices.all())
                old_cat_id = question.category_id
                question.pk = None
                question.survey = new_survey
                # Map to the new category
                if old_cat_id in category_map:
                    question.category = category_map[old_cat_id]
                question.save()
                
                for choice in old_choices:
                    choice.pk = None
                    choice.question = question
                    choice.save()
        
        self.message_user(request, _('Surveys duplicated successfully.'))
    
    @admin.action(description=_('Activate selected surveys'))
    def activate_surveys(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, _(f'{updated} surveys activated.'))
    
    @admin.action(description=_('Deactivate selected surveys'))
    def deactivate_surveys(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, _(f'{updated} surveys deactivated.'))


# ========== Survey Session Admin ==========

@admin.register(SurveySession)
class SurveySessionAdmin(ImportExportModelAdmin, SimpleHistoryAdmin):
    list_display = ['id', 'survey', 'name', 'start_date', 'end_date', 'status_badge', 'attempts_count', 'is_active']
    list_filter = ['survey' if not DROPDOWN_FILTER_AVAILABLE else ('survey', RelatedDropdownFilter), 'is_active', 'start_date', 'end_date']
    search_fields = ['name', 'description', 'survey__name']
    date_hierarchy = 'start_date'
    list_per_page = 50
    
    fieldsets = (
        (_('Session Information'), {
            'fields': ('survey', 'name', 'description')
        }),
        (_('Schedule'), {
            'fields': ('start_date', 'end_date', 'is_active')
        }),
    )
    
    actions = ['activate_sessions', 'deactivate_sessions']
    
    @admin.display(description=_('Status'))
    def status_badge(self, obj):
        status = obj.get_status()
        colors = {
            'open': '#28A745',
            'upcoming': '#4C6EF5',
            'closed': '#FF6B35',
            'inactive': '#6c757d'
        }
        icons = {
            'open': '🟢',
            'upcoming': '🔵',
            'closed': '🔴',
            'inactive': '⚫'
        }
        color = colors.get(status, '#666')
        icon = icons.get(status, '⚪')
        
        return format_html(
            '<span style="background: {}; color: white; padding: 5px 12px; border-radius: 15px; font-weight: bold;">'
            '{} {}'
            '</span>',
            color, icon, obj.get_status_display()
        )
    
    @admin.display(description=_('Attempts'))
    def attempts_count(self, obj):
        count = obj.attempts.count()
        completed = obj.attempts.filter(is_completed=True).count()
        return format_html(
            '<strong>{}</strong> total<br>'
            '<small style="color: #28A745;">{} completed</small>',
            count, completed
        )
    
    @admin.action(description=_('Activate selected sessions'))
    def activate_sessions(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, _(f'{updated} sessions activated.'))
    
    @admin.action(description=_('Deactivate selected sessions'))
    def deactivate_sessions(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, _(f'{updated} sessions deactivated.'))


# ========== Inlines ==========

class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 1
    fields = ['order', 'text', 'score']
    ordering = ['order']
    show_change_link = True
    
    class Media:
        css = {
            'all': ('admin/css/custom_admin.css',)
        }


class UserDocumentInline(admin.TabularInline):
    model = UserDocument
    extra = 0
    readonly_fields = ['title', 'file_link', 'uploaded_at', 'get_file_size_display']
    fields = ['title', 'file_link', 'uploaded_at', 'get_file_size_display']
    can_delete = True
    
    def file_link(self, obj):
        if obj.file:
            return format_html('<a href="{}" target="_blank">📄 {}</a>', obj.file.url, obj.file.name.split('/')[-1])
        return '-'
    file_link.short_description = _('File')


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 0
    readonly_fields = ['question', 'choice', 'answered_at', 'document_count']
    fields = ['question', 'choice', 'answered_at', 'document_count']
    can_delete = False
    
    def document_count(self, obj):
        count = obj.documents.count()
        if count > 0:
            return format_html('<span style="color: green;">📎 {} files</span>', count)
        return '-'
    document_count.short_description = _('Documents')


# ========== Category Admin ==========

@admin.register(Category)
class CategoryAdmin(ImportExportModelAdmin, SimpleHistoryAdmin):
    list_display = ['id', 'name', 'survey', 'order', 'max_score', 'question_count']
    list_editable = ['order']
    list_filter = ['survey']
    search_fields = ['name', 'description']
    ordering = ['survey', 'order', 'name']
    list_per_page = 50
    
    fieldsets = (
        (_('Basic Information'), {
            'fields': ('survey', 'name', 'name_tr', 'name_en', 'description', 'description_tr', 'description_en', 'order')
        }),
        (_('Scoring'), {
            'fields': ('max_score',)
        }),
    )
    
    @admin.display(description=_('Weights'))
    def score_weights(self, obj):
        return format_html(
            '<span style="color: #28A745;">E: {}</span> | '
            '<span style="color: #4C6EF5;">S: {}</span> | '
            '<span style="color: #FF6B35;">G: {}</span>',
            obj.environmental_weight,
            obj.social_weight,
            obj.governance_weight
        )
    
    @admin.display(description=_('Questions'))
    def question_count(self, obj):
        count = obj.questions.filter(is_active=True).count()
        return format_html('<strong>{}</strong> questions', count)


# ========== Question Admin ==========

@admin.register(Question)
class QuestionAdmin(ImportExportModelAdmin, SimpleHistoryAdmin):
    list_display = ['id', 'survey', 'category', 'order', 'question_type', 'text_preview', 'allow_multiple', 'choice_count', 'is_active', 'created_at']
    list_filter = ['survey' if not DROPDOWN_FILTER_AVAILABLE else ('survey', RelatedDropdownFilter), 'category' if not DROPDOWN_FILTER_AVAILABLE else ('category', RelatedDropdownFilter), 'is_active', 'allow_multiple', 'question_type', 'created_at']
    list_editable = ['order', 'is_active', 'allow_multiple', 'question_type']
    search_fields = ['text']
    ordering = ['survey', 'category', 'order']
    inlines = [ChoiceInline]
    list_per_page = 50
    
    fieldsets = (
        (_('Structure'), {
            'fields': ('survey', 'category', 'order', 'is_active')
        }),
        (_('Question Type'), {
            'fields': ('question_type', 'allow_multiple',),
            'description': _('Choose question type: Choice for options, Text for open-ended, Mixed for both')
        }),
        (_('Content'), {
            'fields': ('text',)
        }),
        (_('Attachments'), {
            'fields': ('attachment',),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['activate_questions', 'deactivate_questions', 'duplicate_questions']
    
    @admin.display(description=_('Question Text'))
    def text_preview(self, obj):
        plain = strip_tags(obj.text or "").strip()
        preview = (plain[:80] + '...') if len(plain) > 80 else plain
        return format_html('<span title="{}">{}</span>', plain, preview)
    
    @admin.display(description=_('Choices'))
    def choice_count(self, obj):
        count = obj.choices.count()
        if count > 0:
            return format_html('<span style="color: green;">✓ {}</span>', count)
        return format_html('<span style="color: red;">⚠ 0</span>')
    
    @admin.action(description=_('Activate selected questions'))
    def activate_questions(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, _(f'{updated} questions activated successfully.'))
    
    @admin.action(description=_('Deactivate selected questions'))
    def deactivate_questions(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, _(f'{updated} questions deactivated successfully.'))
    
    @admin.action(description=_('Duplicate selected questions (with choices)'))
    def duplicate_questions(self, request, queryset):
        duplicated = 0
        with transaction.atomic():
            for question in queryset.prefetch_related('choices'):
                old_choices = list(question.choices.all())
                question.pk = None
                question.text = f"{question.text} (Copy)"
                question.is_active = False
                question.save()
                
                for choice in old_choices:
                    choice.pk = None
                    choice.question = question
                    choice.save()
                
                duplicated += 1
        
        self.message_user(request, _(f'{duplicated} questions duplicated successfully.'))


# ========== Choice Admin ==========

@admin.register(Choice)
class ChoiceAdmin(ImportExportModelAdmin, SimpleHistoryAdmin):
    list_display = ['id', 'question', 'text_preview', 'score', 'order']
    list_filter = ['question__category']
    list_editable = ['score', 'order']
    search_fields = ['text', 'question__text']
    ordering = ['question', 'order']
    list_per_page = 50
    
    @admin.display(description=_('Choice Text'))
    def text_preview(self, obj):
        return (obj.text[:60] + '...') if len(obj.text) > 60 else obj.text


# ========== QuestionnaireAttempt Admin ==========

@admin.register(QuestionnaireAttempt)
class QuestionnaireAttemptAdmin(ImportExportModelAdmin, SimpleHistoryAdmin):
    list_display = [
        'id', 'user_info', 'survey', 'session', 'started_at', 'completion_status', 
        'progress_bar', 'grade_display', 'total_score'
    ]
    list_filter = ['survey' if not DROPDOWN_FILTER_AVAILABLE else ('survey', RelatedDropdownFilter), 'session' if not DROPDOWN_FILTER_AVAILABLE else ('session', RelatedDropdownFilter), 'is_completed', 'overall_grade', 'started_at']
    search_fields = ['user__username', 'user__email', 'user__company_name']
    readonly_fields = [
        'started_at', 'total_score', 'environmental_score', 
        'social_score', 'governance_score', 'overall_grade',
        'progress_display', 'score_breakdown', 'dynamic_category_breakdown'
    ]
    inlines = [AnswerInline]
    date_hierarchy = 'started_at'
    list_per_page = 50
    
    fieldsets = (
        (_('User Information'), {
            'fields': ('user', 'survey', 'session')
        }),
        (_('Assessment Status'), {
            'fields': ('started_at', 'completed_at', 'is_completed', 'progress_display')
        }),
        (_('Scores'), {
            'fields': ('dynamic_category_breakdown', 'total_score', 'overall_grade'),
            'classes': ('wide',)
        }),
        (_('Legacy ESG Scores'), {
            'fields': ('score_breakdown', 'environmental_score', 'social_score', 'governance_score'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['recalculate_scores', 'mark_as_completed', 'export_results']
    
    @admin.display(description=_('User'))
    def user_info(self, obj):
        company = getattr(obj.user, 'company_name', 'N/A')
        return format_html(
            '<strong>{}</strong><br><small>{}</small>',
            obj.user.username,
            company
        )
    
    @admin.display(description=_('Status'))
    def completion_status(self, obj):
        if obj.is_completed:
            return format_html(
                '<span style="color: white; background: #28A745; padding: 3px 8px; border-radius: 3px;">✓ Completed</span>'
            )
        return format_html(
            '<span style="color: white; background: #FFC107; padding: 3px 8px; border-radius: 3px;">⏳ In Progress</span>'
        )
    
    @admin.display(description=_('Progress'))
    def progress_bar(self, obj):
        stats = attempt_stats(obj)
        percent = stats['progress_percent']
        answered = stats['answered_questions']
        cannot = stats['cannot_answer_count']
        total = stats['total_questions']
        
        color = '#28A745' if percent == 100 else '#4C6EF5' if percent >= 50 else '#FFC107'
        
        return format_html(
            '<div style="width: 100px; background: #f0f0f0; border-radius: 3px; overflow: hidden;">'
            '<div style="width: {}%; background: {}; color: white; text-align: center; padding: 2px; font-size: 11px;">'
            '{}%'
            '</div>'
            '</div>'
            '<small>{}/{} answered</small><br>'
            '<small style="color: #FFA000;">{} cannot answer</small>',
            percent, color, percent, answered, total, cannot
        )
    
    @admin.display(description=_('Grade'))
    def grade_display(self, obj):
        if not obj.overall_grade:
            return '-'
        
        colors = {
            'A+': '#28A745', 'A': '#28A745', 'A-': '#28A745',
            'B+': '#4C6EF5', 'B': '#4C6EF5', 'B-': '#4C6EF5',
            'C+': '#FFC107', 'C': '#FFC107', 'C-': '#FFC107',
            'D': '#FF6B35'
        }
        color = colors.get(obj.overall_grade, '#666')
        
        return format_html(
            '<span style="background: {}; color: white; padding: 5px 10px; border-radius: 5px; font-weight: bold;">{}</span>',
            color, obj.overall_grade
        )
    
    @admin.display(description=_('Progress Details'))
    def progress_display(self, obj):
        stats = attempt_stats(obj)
        return format_html(
            '<div style="padding: 10px; background: #f8f9fa; border-radius: 5px;">'
            '<strong>Progress:</strong> {}%<br>'
            '<strong>Answered:</strong> {}/{} questions<br>'
            '<strong style="color: #FFA000;">Cannot Answer:</strong> {} questions'
            '</div>',
            stats['progress_percent'],
            stats['answered_questions'],
            stats['total_questions'],
            stats['cannot_answer_count']
        )
    
    @admin.display(description=_('Legacy ESG Breakdown'))
    def score_breakdown(self, obj):
        env = obj.environmental_score or 0
        soc = obj.social_score or 0
        gov = obj.governance_score or 0
        return format_html(
            '<div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">'
            '<div style="margin-bottom: 10px;"><strong>Environmental:</strong> {:.1f}%</div>'
            '<div style="margin-bottom: 10px;"><strong>Social:</strong> {:.1f}%</div>'
            '<div><strong>Governance:</strong> {:.1f}%</div>'
            '</div>',
            env, soc, gov
        )

    @admin.display(description=_('Category Breakdown'))
    def dynamic_category_breakdown(self, obj):
        results = obj.get_category_breakdown()
        categories = results.get('categories', {})

        if not categories:
            return format_html('<div style="padding:10px;">No category data</div>')

        rows = []
        for name, data in categories.items():
            rows.append(
                '<div style="margin-bottom:10px; padding:10px; background:#f8f9fa; border-radius:8px;">'
                '<div style="font-weight:600;">{}</div>'
                '<div>Raw score: <strong>{}</strong> / {}</div>'
                '<div>Percentage: <strong>{}%</strong></div>'
                '</div>'.format(name, data['score'], data['max_score'], data['percentage'])
            )

        rows_html = ''.join(rows)
        footer = (
            '<div style="margin-top:12px; padding-top:12px; border-top:1px solid #ddd;">'
            '<div><strong>Total raw:</strong> {} / {}</div>'
            '<div><strong>Total percentage:</strong> {}%</div>'
            '</div>'.format(
                results['total_score'],
                results['total_possible'],
                results['total_percentage']
            )
        )

        return mark_safe('<div style="padding:15px;">{}{}</div>'.format(rows_html, footer))
    
    @admin.action(description=_('Recalculate scores'))
    def recalculate_scores(self, request, queryset):
        count = 0
        for attempt in queryset:
            recalc_attempt_score(attempt)
            count += 1
        self.message_user(request, _(f'{count} attempts recalculated successfully.'))
    
    @admin.action(description=_('Mark as completed'))
    def mark_as_completed(self, request, queryset):
        updated = queryset.update(is_completed=True, completed_at=timezone.now())
        self.message_user(request, _(f'{updated} attempts marked as completed.'))
    
    @admin.action(description=_('Export results to CSV'))
    def export_results(self, request, queryset):
        self.message_user(request, _('Export functionality coming soon!'))


# ========== Answer Admin ==========

@admin.register(Answer)
class AnswerAdmin(ImportExportModelAdmin, SimpleHistoryAdmin):
    list_display = ['id', 'attempt', 'question', 'selected_choices_display', 'is_cannot_display', 'answered_at']
    list_filter = ['answered_at']
    search_fields = ['attempt__user__username', 'question__text']
    readonly_fields = ['answered_at', 'selected_choices_display', 'is_cannot_display']
    filter_horizontal = ['choices']
    inlines = [UserDocumentInline]
    date_hierarchy = 'answered_at'
    list_per_page = 50
    
    fieldsets = (
        (_('Answer Information'), {
            'fields': ('attempt', 'question', 'answered_at')
        }),
        (_('Single Choice'), {
            'fields': ('choice',),
            'description': _('For single-choice questions')
        }),
        (_('Multiple Choices'), {
            'fields': ('choices',),
            'description': _('For multiple-choice questions')
        }),
        (_('Selected Choices'), {
            'fields': ('selected_choices_display', 'is_cannot_display'),
            'classes': ('collapse',)
        }),
    )
    
    @admin.display(description=_('Selected Choices'))
    def selected_choices_display(self, obj):
        return obj.get_selected_choices_display()
    
    @admin.display(description=_('Cannot Answer'))
    def is_cannot_display(self, obj):
        if obj.is_cannot_answer():
            return format_html('<span style="color: #FFA000;">⚠️ Cannot Answer</span>')
        return format_html('<span style="color: #28A745;">✓ Answered</span>')


# ========== UserDocument Admin ==========

@admin.register(UserDocument)
class UserDocumentAdmin(ImportExportModelAdmin, SimpleHistoryAdmin):
    list_display = ['id', 'answer', 'title', 'file_link', 'uploaded_at', 'get_file_size_display']
    list_filter = ['uploaded_at']
    search_fields = ['title', 'answer__attempt__user__username']
    readonly_fields = ['uploaded_at', 'file_size']
    date_hierarchy = 'uploaded_at'
    list_per_page = 50
    
    @admin.display(description=_('File'))
    def file_link(self, obj):
        if obj.file:
            return format_html('<a href="{}" target="_blank">📄 Download</a>', obj.file.url)
        return '-'

