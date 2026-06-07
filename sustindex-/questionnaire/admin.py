import logging

from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from django.utils.html import format_html, strip_tags
from django.db import transaction
from django.utils import timezone
from django.urls import reverse
from django.utils.safestring import mark_safe

logger = logging.getLogger(__name__)

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
        # Fix M-02: i18n fields were missing — admins couldn't edit bilingual
        # name/description from the survey edit page.
        (_('Survey Information'), {
            'fields': ('name', 'name_tr', 'name_en', 'description', 'description_tr', 'description_en', 'is_active')
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
        # Fix R4-C-02: wrap each survey duplication in its own atomic transaction
        # so a failure mid-copy (e.g. IntegrityError on a question) rolls back that
        # survey's partial data and surfaces an error message instead of leaving
        # orphan categories/questions in the database.
        duplicated = 0
        for survey in queryset:
          try:
            with transaction.atomic():
                self._duplicate_one_survey(survey)
            duplicated += 1
          except Exception as exc:
            logger.exception('duplicate_survey: failed to duplicate survey pk=%s', survey.pk)
            self.message_user(
                request,
                _('Failed to duplicate survey "%(name)s": %(error)s') % {
                    'name': survey.name, 'error': str(exc)
                },
                level='error',
            )
        if duplicated:
            self.message_user(request, _('%d survey(s) duplicated successfully.') % duplicated)

    def _duplicate_one_survey(self, survey):
        """Inner helper — runs inside the caller-managed atomic block."""
        # Fix C-05: copy ALL localised fields so bilingual surveys aren't corrupted.
        # Fix M-04: use the Category/Question constructors instead of mutating in-place
        # (category.pk = None pattern leaves the original object in a dirty state).
        new_survey = Survey.objects.create(
            name=f"{survey.name} (Copy)",
            name_tr=survey.name_tr,
            name_en=survey.name_en,
            description=survey.description,
            description_tr=survey.description_tr,
            description_en=survey.description_en,
            is_active=False,
            allow_multiple_attempts=survey.allow_multiple_attempts,
            show_results_immediately=survey.show_results_immediately,
        )

        category_map = {}
        for orig_cat in survey.categories.all():
            new_cat = Category.objects.create(
                survey=new_survey,
                name=orig_cat.name,
                name_tr=orig_cat.name_tr,
                name_en=orig_cat.name_en,
                description=orig_cat.description,
                description_tr=orig_cat.description_tr,
                description_en=orig_cat.description_en,
                order=orig_cat.order,
                max_score=orig_cat.max_score,
                environmental_weight=orig_cat.environmental_weight,
                social_weight=orig_cat.social_weight,
                governance_weight=orig_cat.governance_weight,
            )
            category_map[orig_cat.pk] = new_cat

        for orig_q in survey.questions.prefetch_related('choices').all():
            # Fix R8-C: look up the new category strictly.  The old fallback
            # `category_map.get(category_id, orig_q.category)` silently reused
            # a category from the ORIGINAL survey when the question was orphaned
            # (category not in map) — bypassing Question.clean() via
            # skip_validation=True and creating a cross-survey FK reference.
            new_cat = category_map.get(orig_q.category_id)
            if new_cat is None:
                logger.warning(
                    '_duplicate_one_survey: question pk=%s has category_id=%s '
                    'not found in new survey — skipping question.',
                    orig_q.pk, orig_q.category_id,
                )
                continue
            new_q = Question.objects.create(
                survey=new_survey,
                category=new_cat,
                text=orig_q.text,
                text_tr=orig_q.text_tr,
                text_en=orig_q.text_en,
                question_type=orig_q.question_type,
                order=orig_q.order,
                is_active=False,
                allow_multiple=orig_q.allow_multiple,
                skip_validation=True,   # survey FK already set correctly
            )
            for orig_c in orig_q.choices.all():
                Choice.objects.create(
                    question=new_q,
                    text=orig_c.text,
                    text_tr=orig_c.text_tr,
                    text_en=orig_c.text_en,
                    score=orig_c.score,
                    order=orig_c.order,
                )
    
    @admin.action(description=_('Activate selected surveys'))
    def activate_surveys(self, request, queryset):
        # Fix M-19: f-strings inside _() are never translated — _() looks up the
        # already-interpolated string as a key and finds nothing.  Use % formatting.
        updated = queryset.update(is_active=True)
        self.message_user(request, _('%d surveys activated.') % updated)

    @admin.action(description=_('Deactivate selected surveys'))
    def deactivate_surveys(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, _('%d surveys deactivated.') % updated)


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
        
        # Fix H-8: get_status_display() is the Django auto-method for a field
        # with choices — SurveySession has no such field.  Use the correct
        # model method get_status_label() which returns the localised string.
        return format_html(
            '<span style="background: {}; color: white; padding: 5px 12px; border-radius: 15px; font-weight: bold;">'
            '{} {}'
            '</span>',
            color, icon, obj.get_status_label()
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
        self.message_user(request, _('%d sessions activated.') % updated)

    @admin.action(description=_('Deactivate selected sessions'))
    def deactivate_sessions(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, _('%d sessions deactivated.') % updated)


# ========== Inlines ==========

class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 1
    # Fix M-03: add text_tr and text_en so admins can fill bilingual choice labels
    # from within the Question edit page without needing a separate Choice admin view.
    fields = ['order', 'text', 'text_tr', 'text_en', 'score']
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
        # Fix R6-04: use authenticated DRF download endpoint instead of raw
        # /media/ URL so media files are not served unauthenticated.
        if obj.file:
            download_url = f'/api/v1/documents/{obj.pk}/download/'
            return format_html('<a href="{}" target="_blank">📄 {}</a>', download_url, obj.file.name.split('/')[-1])
        return '-'
    file_link.short_description = _('File')


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 0
    # Fix L-03: question and choice must be in readonly_fields — otherwise they
    # are rendered as editable dropdowns, letting admins accidentally reassign
    # an answer to a different question or choice.
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
    # Fix L-04: add score_weights to list_display — it was defined but never shown.
    list_display = ['id', 'name', 'survey', 'order', 'max_score', 'question_count', 'score_weights']
    list_editable = ['order']
    list_filter = ['survey']
    search_fields = ['name', 'description']
    ordering = ['survey', 'order', 'name']
    list_per_page = 50
    
    fieldsets = (
        (_('Basic Information'), {
            'fields': ('survey', 'name', 'name_tr', 'name_en', 'description', 'description_tr', 'description_en', 'order')
        }),
        # Fix H-01: environmental_weight, social_weight, governance_weight were
        # missing from the Scoring fieldset — admins had no way to set pillar
        # weights from the category edit page.
        (_('Scoring'), {
            'fields': ('max_score', 'environmental_weight', 'social_weight', 'governance_weight')
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
    list_display = ['id', 'survey', 'category', 'order', 'question_type', 'sector', 'text_preview', 'allow_multiple', 'choice_count', 'is_active', 'created_at']
    list_filter = ['survey' if not DROPDOWN_FILTER_AVAILABLE else ('survey', RelatedDropdownFilter), 'category' if not DROPDOWN_FILTER_AVAILABLE else ('category', RelatedDropdownFilter), 'sector', 'is_active', 'allow_multiple', 'question_type', 'created_at']
    list_editable = ['order', 'sector', 'is_active', 'allow_multiple', 'question_type']
    search_fields = ['text']
    ordering = ['survey', 'category', 'order']
    inlines = [ChoiceInline]
    list_per_page = 50

    fieldsets = (
        (_('Structure'), {
            'fields': ('survey', 'category', 'order', 'is_active'),
        }),
        (_('Sector (Branching)'), {
            'fields': ('sector',),
            'description': _(
                'Leave blank for universal questions (shown to all respondents). '
                'Select a sector to show this question only to respondents who chose that sector.'
            ),
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
        self.message_user(request, _('%d questions activated successfully.') % updated)

    @admin.action(description=_('Deactivate selected questions'))
    def deactivate_questions(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, _('%d questions deactivated successfully.') % updated)

    @admin.action(description=_('Duplicate selected questions (with choices)'))
    def duplicate_questions(self, request, queryset):
        # Fix H-02: use Question() constructor + skip_validation=True instead of
        # question.pk = None + question.save().  The pk=None pattern mutates the
        # original object, and Question.save() calls full_clean() which raises
        # ValidationError when duplicating across survey boundaries — leaving
        # partial state with no rollback.  Constructor + skip_validation=True is
        # clean, explicit, and safe inside the transaction.
        duplicated = 0
        with transaction.atomic():
            for orig_q in queryset.prefetch_related('choices'):
                new_q = Question(
                    survey=orig_q.survey,
                    category=orig_q.category,
                    text=f"{orig_q.text} (Copy)",
                    text_tr=orig_q.text_tr,
                    text_en=orig_q.text_en,
                    question_type=orig_q.question_type,
                    order=orig_q.order,
                    is_active=False,
                    allow_multiple=orig_q.allow_multiple,
                )
                new_q.save(skip_validation=True)
                for orig_c in orig_q.choices.all():
                    Choice.objects.create(
                        question=new_q,
                        text=orig_c.text,
                        text_tr=orig_c.text_tr,
                        text_en=orig_c.text_en,
                        score=orig_c.score,
                        order=orig_c.order,
                    )
                duplicated += 1

        self.message_user(request, _('%d questions duplicated successfully.') % duplicated)


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
            'fields': ('user', 'survey', 'session', 'selected_sector'),
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
    
    # Fix R12-05: user_info() accesses obj.user (FK), and list_display exposes
    # 'survey' and 'session' FKs directly.  Without list_select_related Django
    # fires three extra SELECT queries per row in the changelist.  One JOIN covers all.
    list_select_related = ['user', 'survey', 'session']

    # Fix L-1: removed 'export_results' — it was a stub that only showed a
    # "coming soon" message.  A visible action that does nothing misleads admins.
    actions = ['recalculate_scores', 'mark_as_completed']
    
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
        
        # Fix L-05: remove 'A-','B-','C-' — _grade_for_score never produces them.
        colors = {
            'A+': '#28A745', 'A': '#28A745',
            'B+': '#4C6EF5', 'B': '#4C6EF5',
            'C+': '#FFC107', 'C': '#FFC107',
            'D':  '#FF6B35',
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
        categories = results.get('categories', [])

        if not categories:
            return format_html('<div style="padding:10px;">No category data</div>')

        # Fix C-02: data['name'] is user-supplied text — must be escaped.
        # Replaced string.format() + mark_safe() with format_html() which
        # auto-escapes every interpolated value, preventing stored XSS.
        rows = []
        for data in categories:
            rows.append(format_html(
                '<div style="margin-bottom:10px; padding:10px; background:#f8f9fa; border-radius:8px;">'
                '<div style="font-weight:600;">{}</div>'
                '<div>Raw score: <strong>{}</strong> / {}</div>'
                '<div>Percentage: <strong>{}%</strong></div>'
                '</div>',
                data['name'], data['score'], data['max_score'], data['percentage']
            ))

        # format_html() returns SafeString — joining them is safe to mark_safe().
        rows_combined = mark_safe(''.join(rows))
        footer = format_html(
            '<div style="margin-top:12px; padding-top:12px; border-top:1px solid #ddd;">'
            '<div><strong>Total raw:</strong> {} / {}</div>'
            '<div><strong>Total percentage:</strong> {}%</div>'
            '</div>',
            results['total_score'],
            results['total_possible'],
            results['total_percentage']
        )

        return format_html('<div style="padding:15px;">{}{}</div>', rows_combined, footer)
    
    @admin.action(description=_('Recalculate scores'))
    def recalculate_scores(self, request, queryset):
        # Fix R6-05: add prefetch_related so recalc_attempt_score() doesn't
        # fire per-answer / per-question / per-choice DB queries for each attempt.
        queryset = queryset.select_related('user', 'survey', 'session').prefetch_related(
            'answers__question__choices',
            'answers__choice',
            'answers__choices',
            'survey__categories',
        )
        count = 0
        for attempt in queryset:
            recalc_attempt_score(attempt)
            count += 1
        self.message_user(request, _('%d attempts recalculated successfully.') % count)

    @admin.action(description=_('Mark as completed'))
    def mark_as_completed(self, request, queryset):
        # Fix L-17: calculate scores after marking complete so total_score and
        # overall_grade are populated.  The old queryset.update() left all score
        # fields at 0 / blank, making the admin list misleading.
        # Fix R4-M-02: log and surface exceptions instead of swallowing them silently.
        # Fix R7-07: re-evaluate queryset with prefetch_related AFTER .update() so
        # calculate_scores() hits the in-memory cache instead of issuing N+1 queries
        # for each attempt's answers, choices, and categories.
        updated = queryset.update(is_completed=True, completed_at=timezone.now())
        queryset = queryset.select_related('user', 'survey', 'session').prefetch_related(
            'answers__question__choices',
            'answers__choice',
            'answers__choices',
            'survey__categories',
        )
        failed = 0
        for attempt in queryset:
            try:
                attempt.calculate_scores(save=True)
            except Exception:
                failed += 1
                logger.exception(
                    'mark_as_completed: calculate_scores failed for attempt pk=%s', attempt.pk
                )
        if failed:
            self.message_user(
                request,
                _('%d attempt(s) could not have scores recalculated — see server logs.') % failed,
                level='warning',
            )
        self.message_user(request, _('%d attempts marked as completed.') % updated)
    
    # export_results action removed (Fix L-1) — was an unimplemented stub.


# ========== Answer Admin ==========

@admin.register(Answer)
class AnswerAdmin(ImportExportModelAdmin, SimpleHistoryAdmin):
    list_display = ['id', 'attempt', 'question', 'selected_choices_display', 'is_cannot_display', 'answered_at']
    # Fix R12-05: 'attempt' and 'question' in list_display each call str(obj.fk) —
    # without list_select_related that's two extra SELECTs per row in the changelist.
    list_select_related = ['attempt__user', 'question']
    list_filter = ['answered_at']
    search_fields = ['attempt__user__username', 'question__text']
    # Fix L-03: lock question + choice in the detail view as well — they should
    # never be reassigned after creation.
    readonly_fields = ['question', 'choice', 'answered_at', 'selected_choices_display', 'is_cannot_display']
    # Fix R5-M-08: removed filter_horizontal = ['choices'] — `choices` is displayed
    # via readonly_fields (selected_choices_display), so the M2M widget was silently
    # failing to render and creating a confusing duplicate field.
    # filter_horizontal = ['choices']  ← removed
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
        # Fix R6-04: use authenticated DRF download endpoint instead of raw /media/ URL.
        if obj.file:
            download_url = f'/api/v1/documents/{obj.pk}/download/'
            return format_html('<a href="{}" target="_blank">📄 Download</a>', download_url)
        return '-'

