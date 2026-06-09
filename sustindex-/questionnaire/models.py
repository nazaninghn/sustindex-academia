from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from ckeditor.fields import RichTextField
from django.utils.translation import gettext_lazy as _
from django.utils import timezone


class Survey(models.Model):
    """
    Different sustainability assessment surveys
    Each survey can have multiple sessions
    """
    name = models.CharField(max_length=200, verbose_name=_('Survey Name'))
    name_tr = models.CharField(max_length=200, blank=True, verbose_name=_('Survey Name (Turkish)'))
    name_en = models.CharField(max_length=200, blank=True, verbose_name=_('Survey Name (English)'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    description_tr = models.TextField(blank=True, verbose_name=_('Description (Turkish)'))
    description_en = models.TextField(blank=True, verbose_name=_('Description (English)'))
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created At'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Updated At'))
    
    # Fix START-1: default True so all GRI phase surveys allow the Retry button.
    # Admins can override per-survey via the admin panel.
    allow_multiple_attempts = models.BooleanField(default=True, verbose_name=_('Allow Multiple Attempts'))
    show_results_immediately = models.BooleanField(default=True, verbose_name=_('Show Results Immediately'))
    
    class Meta:
        verbose_name = _('Survey')
        verbose_name_plural = _('Surveys')
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
    
    def get_total_questions(self):
        """Get total number of active questions in this survey"""
        return self.questions.filter(is_active=True).count()
    
    def get_active_sessions(self):
        """Get active sessions for this survey"""
        return self.sessions.filter(is_active=True)


class SurveySession(models.Model):
    """Assessment sessions with specific time periods"""
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='sessions', verbose_name=_('Survey'), null=True, blank=True)
    name = models.CharField(max_length=200, verbose_name=_('Session Name'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    start_date = models.DateTimeField(verbose_name=_('Start Date'))
    end_date = models.DateTimeField(verbose_name=_('End Date'))
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created At'))
    
    class Meta:
        verbose_name = _('Survey Session')
        verbose_name_plural = _('Survey Sessions')
        ordering = ['-start_date']
    
    def __str__(self):
        survey_name = self.survey.name if self.survey else 'No Survey'
        return f"{survey_name} - {self.name}"
    
    def is_open(self):
        """Check if session is currently open"""
        now = timezone.now()
        return self.is_active and self.start_date <= now <= self.end_date
    
    def get_status(self):
        """Get session status"""
        now = timezone.now()
        if not self.is_active:
            return 'inactive'
        elif now < self.start_date:
            return 'upcoming'
        elif now > self.end_date:
            return 'closed'
        else:
            return 'open'
    
    def get_status_label(self):
        """Get human-readable status (Fix BUG-21: renamed to avoid Django's auto-generated name)"""
        status = self.get_status()
        status_map = {
            'inactive': _('Inactive'),
            'upcoming': _('Upcoming'),
            'closed': _('Closed'),
            'open': _('Open')
        }
        return status_map.get(status, _('Unknown'))


class Category(models.Model):
    """Question categories for organizing questionnaire - each survey has its own categories"""
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='categories', verbose_name=_('Survey'), null=True, blank=True)
    name = models.CharField(max_length=200, verbose_name=_('Name'))
    name_tr = models.CharField(max_length=200, blank=True, verbose_name=_('Name (Turkish)'))
    name_en = models.CharField(max_length=200, blank=True, verbose_name=_('Name (English)'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    description_tr = models.TextField(blank=True, verbose_name=_('Description (Turkish)'))
    description_en = models.TextField(blank=True, verbose_name=_('Description (English)'))
    order = models.IntegerField(default=0, verbose_name=_('Display Order'))
    # Fix #40: enforce 0–1 range per weight field at the DB/model level.
    environmental_weight = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        verbose_name=_('Environmental Weight'),
    )
    social_weight = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        verbose_name=_('Social Weight'),
    )
    governance_weight = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        verbose_name=_('Governance Weight'),
    )
    max_score = models.IntegerField(default=100, verbose_name=_('Maximum Score'))
    
    class Meta:
        verbose_name = _('Category')
        verbose_name_plural = _('Categories')
        ordering = ['order', 'name']
    
    def clean(self):
        super().clean()
        # Fix #40: when at least one weight is non-zero the three must sum to 1.0
        # (allowing 0/0/0 for un-weighted categories that don't participate in pillar scoring).
        total = (
            (self.environmental_weight or 0.0)
            + (self.social_weight or 0.0)
            + (self.governance_weight or 0.0)
        )
        if total > 0 and not (0.99 <= total <= 1.01):
            raise ValidationError(
                _('The sum of environmental, social and governance weights must equal 1.0 (currently %(total).2f).'),
                params={'total': total},
            )

    def save(self, *args, **kwargs):
        # Fix H-04: run clean() on every save so weight validation fires even
        # for bulk admin operations (queryset.update() bypasses clean() entirely,
        # but individual .save() calls do run this).
        # Fix MED-01: also run full_clean() when update_fields includes any weight
        # field — the old guard skipped validation for partial saves, allowing
        # invalid weight sums to be stored via update_fields=['environmental_weight'].
        update_fields = kwargs.get('update_fields')
        weight_fields = {'environmental_weight', 'social_weight', 'governance_weight'}
        if update_fields is None or weight_fields & set(update_fields):
            self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        survey_name = self.survey.name if self.survey else 'Global'
        return f"{survey_name} - {self.name}"

    def get_category_score(self, attempt):
        """Calculate category percentage score for an attempt.

        .. deprecated::
            Fix R7-06: this method issues at minimum 3 DB queries per category
            (questions.filter, answers.filter, questions.prefetch_related) and
            is called in a loop in the legacy admin report view, creating an N+1
            pattern.  Prefer attempt.get_category_breakdown() which resolves the
            entire breakdown in 2 queries total (one for questions, one for
            answers) using pre-fetched in-memory data.
            This method is retained only for backward compatibility with any
            external code that calls it directly.
        """
        if attempt.survey:
            questions = self.questions.filter(is_active=True, survey=attempt.survey)
        else:
            questions = self.questions.filter(is_active=True)

        if not questions.exists():
            return 0

        total_score = 0
        total_possible = 0

        answers_by_qid = {
            a.question_id: a
            for a in attempt.answers.filter(
                question__in=questions
            ).select_related('choice').prefetch_related('choices')
        }

        for question in questions.prefetch_related('choices'):
            answer = answers_by_qid.get(question.id)
            if answer:
                total_score += answer.get_total_score()
            total_possible += question.get_max_possible_score()

        if total_possible == 0:
            return 0

        percentage = (total_score / total_possible) * 100
        return min(round(percentage, 2), 100)


class Question(models.Model):
    """Questionnaire questions"""
    QUESTION_TYPE_CHOICES = [
        ('choice', _('Choice (select from options)')),
        ('text', _('Text (open-ended answer)')),
        ('mixed', _('Mixed (choices + text)')),
    ]

    # Branching by sector: blank = universal (shown to every respondent);
    # a specific value = shown only when the attempt's selected_sector matches.
    SECTOR_CHOICES = [
        ('',             _('Universal (all sectors)')),
        ('agri',         _('Agriculture & Food')),
        ('energy',       _('Energy & Utilities')),
        ('finance',      _('Financial Services')),
        ('construction', _('Construction & Real Estate')),
        ('manufacturing',_('Manufacturing & Industry')),
        ('health',       _('Healthcare & Pharma')),
        ('tech',         _('Technology & IT')),
        ('retail',       _('Retail & Trade')),
    ]

    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='questions', verbose_name=_('Survey'), null=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='questions', verbose_name=_('Category'))
    text = RichTextField(verbose_name=_('Question Text'))
    text_tr = RichTextField(blank=True, verbose_name=_('Question Text (Turkish)'))
    text_en = RichTextField(blank=True, verbose_name=_('Question Text (English)'))
    question_type = models.CharField(max_length=10, choices=QUESTION_TYPE_CHOICES, default='choice', verbose_name=_('Question Type'))
    order = models.IntegerField(default=0, verbose_name=_('Display Order'))
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))
    allow_multiple = models.BooleanField(default=False, verbose_name=_('Allow Multiple Choices'), help_text=_('Allow users to select multiple answers'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created At'))
    attachment = models.FileField(upload_to='question_attachments/', blank=True, verbose_name=_('Question Attachment'))
    # Branching field — Feature: sector-specific questionnaire routing.
    # Empty string = universal; a sector code = visible only to that sector.
    sector = models.CharField(
        max_length=20,
        choices=SECTOR_CHOICES,
        blank=True,
        default='',
        verbose_name=_('Sector'),
        help_text=_(
            "Leave blank for universal questions (shown to all respondents). "
            "Set to a specific sector to show this question only to respondents "
            "who selected that sector when starting their attempt."
        ),
    )
    
    class Meta:
        verbose_name = _('Question')
        verbose_name_plural = _('Questions')
        ordering = ['survey', 'category', 'order']
        # Fix M-3: composite index covering the most common hot-path filter:
        #   Question.objects.filter(is_active=True, survey=x)
        #                   .filter(Q(sector='') | Q(sector=selected_sector))
        # survey_id already has an index (FK), but the engine can't use it
        # together with is_active / sector without these additional indexes.
        indexes = [
            models.Index(fields=['survey', 'is_active', 'sector'],
                         name='q_survey_active_sector_idx'),
        ]
    
    def __str__(self):
        survey_name = self.survey.name if self.survey else 'No Survey'
        return f"{survey_name} - {self.category.name} - Q{self.order}"

    def clean(self):
        super().clean()
        if self.category_id and self.survey_id:
            # Ensure category belongs to the same survey
            if self.category.survey_id and self.category.survey_id != self.survey_id:
                raise ValidationError({
                    'category': _('Selected category belongs to a different survey.')
                })
        # Auto-set survey from category if not set
        if self.category_id and self.category.survey_id and not self.survey_id:
            self.survey = self.category.survey

    def save(self, *args, **kwargs):
        # Fix 9: guard full_clean so it doesn't break bulk_create, data migrations,
        # or partial update() calls (where update_fields is passed).
        # Callers that truly want to bypass validation pass skip_validation=True.
        if 'update_fields' not in kwargs and not kwargs.pop('skip_validation', False):
            self.full_clean()
        return super().save(*args, **kwargs)

    def get_max_possible_score(self):
        """Calculate max possible score based on question type.

        Fix BUG-05: use list() so the prefetch_related cache is used instead of
        issuing .exists() + extra queryset evaluation (N+1 in scoring hot path).
        """
        choices = list(self.choices.all())  # hits prefetch cache, not DB
        if not choices:
            return 0
        if self.allow_multiple:
            return sum(c.score for c in choices if c.score > 0)
        return max((c.score for c in choices), default=0)


class Choice(models.Model):
    """Answer choices for each question"""
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='choices', verbose_name=_('Question'))
    text = models.CharField(max_length=500, verbose_name=_('Choice Text'))
    text_tr = models.CharField(max_length=500, blank=True, verbose_name=_('Choice Text (Turkish)'))
    text_en = models.CharField(max_length=500, blank=True, verbose_name=_('Choice Text (English)'))
    score = models.IntegerField(default=0, verbose_name=_('Score'))
    order = models.IntegerField(default=0, verbose_name=_('Display Order'))
    
    class Meta:
        verbose_name = _('Choice')
        verbose_name_plural = _('Choices')
        ordering = ['order']
    
    def __str__(self):
        return f"{self.text} (Score: {self.score})"


class QuestionnaireAttempt(models.Model):
    """User attempts to complete questionnaire"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attempts', verbose_name=_('User'))
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='attempts', verbose_name=_('Survey'), null=True, blank=True)
    session = models.ForeignKey(SurveySession, on_delete=models.SET_NULL, null=True, blank=True, related_name='attempts', verbose_name=_('Survey Session'))
    started_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Started At'))
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Completed At'))
    is_completed = models.BooleanField(default=False, verbose_name=_('Completed'))
    total_score = models.IntegerField(default=0, verbose_name=_('Total Score'))
    
    environmental_score = models.FloatField(default=0.0, null=True, blank=True, verbose_name=_('Environmental Score'))
    social_score = models.FloatField(default=0.0, null=True, blank=True, verbose_name=_('Social Score'))
    governance_score = models.FloatField(default=0.0, null=True, blank=True, verbose_name=_('Governance Score'))
    overall_grade = models.CharField(max_length=2, blank=True, verbose_name=_('Overall Grade'))
    # Branching field — the sector the user selected when starting this attempt.
    # Empty string = no sector selected (universal / backward-compatible).
    selected_sector = models.CharField(
        max_length=20,
        blank=True,
        default='',
        verbose_name=_('Selected Sector'),
        help_text=_('Industry sector chosen by the user at the start of this attempt.'),
    )
    
    class Meta:
        verbose_name = _('Questionnaire Attempt')
        verbose_name_plural = _('Questionnaire Attempts')
        ordering = ['-started_at']
        # Fix START-2: removed unique_completed_attempt constraint (BH-2).
        # That constraint prevented users from completing a *second* attempt
        # for the same survey, which is exactly what the GRI Retry flow needs.
        # Race-condition protection is already handled by select_for_update()
        # inside transaction.atomic() in the complete action — the DB constraint
        # was belt-and-suspenders that became actively harmful.
        constraints = []
    
    def __str__(self):
        # Fix LOW-03: avoid lazy-loading self.survey.name and self.user.username
        # on every admin list row (2 extra queries per row → N+1 in admin).
        # Use PK only — zero extra DB queries.
        return f"Attempt #{self.pk}"
    
    def calculate_score(self):
        """
        Backward-compatible wrapper.
        Uses canonical dynamic scoring logic everywhere.
        """
        results = self.calculate_scores()
        return results['total_percentage']

    def get_survey_categories(self):
        """Return categories for the current survey in display order.

        Fix R5-L-09: prefer the prefetch_related('survey__categories') cache
        set up by QuestionnaireAttemptViewSet._base_queryset() before falling
        back to a fresh DB query.  This avoids a redundant SELECT per attempt
        in serializer hot paths.

        Fix R6-09: replaced the private _result_cache probe (a Django ORM
        internal that could vanish in a future Django version) with a public
        approach: calling .all() on a prefetched relation returns the cached
        queryset, and list() forces evaluation either way.
        """
        if self.survey:
            # .all() on a prefetched Manager returns the in-memory cache when
            # prefetch_related('survey__categories') was used; otherwise it
            # issues a fresh DB query — both paths are handled transparently.
            # IMPORTANT: do NOT chain .order_by() after .all() — that creates
            # a new queryset that bypasses the prefetch cache.  Sort in Python
            # instead so the prefetch optimisation is preserved.
            cats = sorted(self.survey.categories.all(), key=lambda c: c.order)
            if cats:
                return cats
            # Fallback for surveys where categories are linked via questions
            # (used in admin / management commands without prefetching).
            cats = list(
                Category.objects.filter(
                    questions__survey=self.survey,
                    questions__is_active=True,
                ).distinct().order_by('order')
            )
            return cats
        return list(
            Category.objects.filter(
                questions__is_active=True,
            ).distinct().order_by('order')
        )

    def get_category_breakdown(self):
        """Build dynamic category breakdown for the current attempt.

        Fix BB: previously issued 2 DB queries per category (filter + prefetch).
        Now uses a single bulk query for all questions, grouped in Python.
        """
        from collections import defaultdict

        categories = list(self.get_survey_categories())  # 1-2 queries max

        # ── Fix BB: one query for ALL questions in this survey ────────────────
        # Sector filtering: universal questions (sector='') are always included;
        # sector-specific questions are included only when the attempt's
        # selected_sector matches.  Empty selected_sector = universal-only mode
        # (backward-compatible with all pre-branching attempts).
        if self.survey:
            from django.db.models import Q as _Q
            _sector = self.selected_sector or ''
            all_questions = list(
                Question.objects
                .filter(is_active=True, survey=self.survey)
                .filter(_Q(sector='') | _Q(sector=_sector))
                .prefetch_related('choices')
                .select_related('category')
            )
        else:
            # Fix BUG-12: no survey FK — restrict to answered questions only to
            # avoid mixing questions from completely unrelated surveys.
            import logging as _logging
            _logging.getLogger(__name__).warning(
                'QuestionnaireAttempt(pk=%s) has no survey FK; '
                'breakdown restricted to answered questions.', self.pk
            )
            answered_qids = list(self.answers.values_list('question_id', flat=True))
            all_questions = list(
                Question.objects
                .filter(is_active=True, id__in=answered_qids)
                .prefetch_related('choices')
                .select_related('category')
            )

        # Group questions by category id (no extra queries)
        questions_by_cat: dict = defaultdict(list)
        for q in all_questions:
            questions_by_cat[q.category_id].append(q)

        # Fix R7-02: calling .select_related().prefetch_related() on self.answers
        # creates a NEW queryset that bypasses any prefetch_related cache already
        # populated by QuestionnaireAttemptViewSet._base_queryset() (which prefetches
        # answers__choice, answers__choices, answers__question__choices).  Using
        # .all() instead returns the in-memory cache when prefetching was done,
        # or falls back to a single DB query when it wasn't — both are correct.
        all_answers = list(self.answers.all())
        answers_by_qid = {a.question_id: a for a in all_answers}

        category_scores = []
        total_score_sum = 0
        total_possible_sum = 0

        for category in categories:
            cat_questions = questions_by_cat.get(category.id, [])

            cat_score = 0
            cat_possible = 0

            for question in cat_questions:
                answer = answers_by_qid.get(question.id)
                if answer:
                    cat_score += answer.get_total_score()
                cat_possible += question.get_max_possible_score()

            percentage = min(
                round((cat_score / cat_possible) * 100, 2), 100
            ) if cat_possible > 0 else 0

            category_scores.append({
                'id': category.id,
                'key': category.name,
                'name': category.name,
                'score': cat_score,
                'max_score': cat_possible,
                'percentage': percentage,
                # Fix BUG-02: include weights so calculate_scores() can derive
                # pillar scores without a second DB query.
                'environmental_weight': category.environmental_weight,
                'social_weight':        category.social_weight,
                'governance_weight':    category.governance_weight,
            })

            total_score_sum += cat_score
            total_possible_sum += cat_possible

        total_percentage = min(
            round((total_score_sum / total_possible_sum) * 100, 2), 100
        ) if total_possible_sum > 0 else 0

        return {
            'categories': category_scores,
            'total_score': total_score_sum,
            'total_possible': total_possible_sum,
            'total_percentage': total_percentage,
        }

    @staticmethod
    def _grade_for_score(score: int) -> str:
        """Map a numeric score (0-100) to a letter grade."""
        if score >= 80: return 'A+'
        if score >= 70: return 'A'
        if score >= 60: return 'B+'
        if score >= 50: return 'B'
        if score >= 40: return 'C+'
        if score >= 30: return 'C'
        return 'D'

    def calculate_scores(self, save: bool = True):
        """Calculate scores per category dynamically.

        Fix #28: dirty check — skip the DB write when nothing changed.
        Fix #29 (called from complete action): accepts save=False so the
        caller can batch the completion fields into a single save.
        """
        results = self.get_category_breakdown()
        cat_list = results['categories']

        # Fix BUG-02: compute weighted ESG pillar scores from category weights.
        # Falls back to an equal average of all categories when no weights are set,
        # avoiding the old hard-coded positional [0]/[1]/[2] mapping.
        env_n = env_d = soc_n = soc_d = gov_n = gov_d = 0.0
        for c in cat_list:
            pct = c['percentage']
            e_w = c.get('environmental_weight', 0.0)
            s_w = c.get('social_weight', 0.0)
            g_w = c.get('governance_weight', 0.0)
            env_n += e_w * pct;  env_d += e_w
            soc_n += s_w * pct;  soc_d += s_w
            gov_n += g_w * pct;  gov_d += g_w
        avg = round(sum(c['percentage'] for c in cat_list) / len(cat_list), 2) if cat_list else 0.0

        new_env   = round(env_n / env_d, 2) if env_d else avg
        new_soc   = round(soc_n / soc_d, 2) if soc_d else avg
        new_gov   = round(gov_n / gov_d, 2) if gov_d else avg
        # Fix R7-13: round() to integer is intentional — total_score is stored
        # as an IntegerField on the model (0-100 range), so fractional percentages
        # must be truncated.  The raw float is still available via get_category_breakdown().
        new_total = round(results['total_percentage'])
        new_grade = self._grade_for_score(new_total)

        # Fix #28: only write to DB when at least one field has changed.
        dirty = (
            self.environmental_score != new_env
            or self.social_score     != new_soc
            or self.governance_score != new_gov
            or self.total_score      != new_total
            or self.overall_grade    != new_grade
        )

        self.environmental_score = new_env
        self.social_score        = new_soc
        self.governance_score    = new_gov
        self.total_score         = new_total
        self.overall_grade       = new_grade

        if save and dirty:
            self.save(update_fields=[
                'environmental_score',
                'social_score',
                'governance_score',
                'total_score',
                'overall_grade',
            ])

        return {
            **results,
            'grade': self.overall_grade,
        }

    def get_overall_grade(self):
        """Determine grade based on total score."""
        return self._grade_for_score(self.total_score)
    
    def get_recommendations(self):
        """Provide GRI-aligned recommendations based on category scores.

        Uses the gri_recommendations module to generate specific, actionable
        recommendations with GRI standard references, timelines, and quick wins.
        Only generates recommendations for categories scoring below 80%.
        """
        if not self.is_completed:
            return []
        from .gri_recommendations import get_recommendations_for_category
        breakdown = self.get_category_breakdown()
        recommendations = []
        for cat in breakdown['categories']:
            pct  = cat['percentage']
            name = cat['name']
            # Only recommend for categories below excellent (80%)
            if pct < 80:
                recs = get_recommendations_for_category(name, pct)
                recommendations.extend(recs)
        # Sort: High priority first, then by score ascending
        priority_order = {'High': 0, 'Medium': 1, 'Low': 2}
        recommendations.sort(key=lambda r: (
            priority_order.get(r.get('priority', 'Low'), 2),
            r.get('score_pct', 50),
        ))
        return recommendations


class Answer(models.Model):
    """User answers to questions"""
    attempt = models.ForeignKey(QuestionnaireAttempt, on_delete=models.CASCADE, related_name='answers', verbose_name=_('Attempt'))
    question = models.ForeignKey(Question, on_delete=models.CASCADE, verbose_name=_('Question'))
    choice = models.ForeignKey(Choice, on_delete=models.CASCADE, null=True, blank=True, verbose_name=_('Selected Choice (Single)'))
    choices = models.ManyToManyField(Choice, related_name='answers_multiple', blank=True, verbose_name=_('Selected Choices (Multiple)'))
    text_answer = models.TextField(blank=True, null=True, verbose_name=_('Text Answer'), help_text=_('Open-ended text answer for text-type questions'))
    notes = models.TextField(blank=True, null=True, verbose_name=_('Notes/Comments'), help_text=_('Additional notes or comments for this answer'))
    answered_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Answered At'))
    
    class Meta:
        verbose_name = _('Answer')
        verbose_name_plural = _('Answers')
        unique_together = ['attempt', 'question']
    
    def __str__(self):
        # Fix R11-04: avoid chaining attempt.user.username AND self.question.__str__
        # (which itself lazy-loads survey + category) — up to 4 extra DB queries per
        # row in admin list views. Use cached FK integers only — zero extra queries.
        return f"Answer #{self.pk} — Q{self.question_id}"
    
    def get_total_score(self):
        """Calculate total score for this answer.

        Fix #32: use list() so the prefetch_related cache is hit instead of
        issuing a fresh queryset on every call (avoids N+1 in scoring hot path).
        """
        if self.question.allow_multiple:
            return sum(c.score for c in list(self.choices.all()))
        return self.choice.score if self.choice else 0
    
    def is_cannot_answer(self):
        """Check if user selected 'cannot answer'.

        M1: use list() so the prefetch_related cache is hit instead of
        issuing a fresh .exists() query (avoids N+1 in display hot path).
        """
        return not self.choice and not list(self.choices.all()) and not self.text_answer

    def get_selected_choices_display(self):
        """Display selected choices or text answer.

        M1: evaluate choices once with list() so the prefetch cache is used
        for all subsequent accesses — avoids multiple .exists()/.all() calls.
        """
        selected = list(self.choices.all())   # single hit on prefetch cache

        if self.text_answer and self.text_answer.strip():
            if self.choice or selected:
                # Mixed: show both choices and text
                if self.question.allow_multiple:
                    choice_text = ", ".join([c.text for c in selected])
                else:
                    choice_text = self.choice.text if self.choice else ""
                return f"{choice_text} | {self.text_answer}" if choice_text else self.text_answer
            return self.text_answer

        if not self.choice and not selected and not self.text_answer:
            return "No answer provided"

        if self.question.allow_multiple:
            return ", ".join([c.text for c in selected])
        return self.choice.text if self.choice else "-"



class UserDocument(models.Model):
    """User uploaded documents for questions"""
    answer = models.ForeignKey(Answer, on_delete=models.CASCADE, related_name='documents', verbose_name=_('Answer'))
    title = models.CharField(max_length=200, verbose_name=_('Document Title'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    file = models.FileField(upload_to='user_documents/', verbose_name=_('Document File'))
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Uploaded At'))
    file_size = models.IntegerField(default=0, verbose_name=_('File Size (bytes)'))

    class Meta:
        verbose_name = _('User Document')
        verbose_name_plural = _('User Documents')
        ordering = ['-uploaded_at']

    def __str__(self):
        # Fix R11-03: avoid chaining answer.attempt.user.username (3 lazy-load queries
        # per row in admin list views). Use local fields only — zero extra DB queries.
        return f"{self.title} (#{self.pk})"

    def save(self, *args, **kwargs):
        # Fix M-3: auto-populate file_size from the uploaded file so the field
        # is never left at the default 0.  The DRF serializer returns
        # file_size_display to the frontend; without this the display was always
        # "0 B" even after a successful upload.
        if self.file and not self.file_size:
            try:
                self.file_size = self.file.size
            except (OSError, AttributeError):
                pass  # file not yet written to storage; size will be set by storage backend
        super().save(*args, **kwargs)

    def get_file_size_display(self):
        """Return human readable file size"""
        if self.file_size < 1024:
            return f"{self.file_size} B"
        elif self.file_size < 1024 * 1024:
            return f"{self.file_size // 1024} KB"
        else:
            return f"{self.file_size // (1024 * 1024)} MB"


