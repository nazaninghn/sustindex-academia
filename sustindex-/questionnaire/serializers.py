from rest_framework import serializers
from .models import (
    Survey, SurveySession, Category, Question, Choice,
    QuestionnaireAttempt, Answer, UserDocument
)


# ── Fix M-2: LocalisedRepresentationMixin ──────────────────────────────────
class LocalisedRepresentationMixin:
    """
    DRY helper that eliminates the 5× duplicated language-detection + field-
    override logic that was spread across ChoiceSerializer, QuestionSerializer,
    CategorySerializer, SurveyListSerializer, and SurveySerializer.

    Usage — in each serializer that needs localisation call:

        def to_representation(self, instance):
            rep  = super().to_representation(instance)
            lang = self._get_lang(self.context.get('request'))
            return self._localise(rep, instance, lang, {
                'name':        ('name_tr',        'name_en'),
                'description': ('description_tr', 'description_en'),
            })

    `mapping` keys are the canonical serialized field names; values are
    (tr_attr, en_attr) pairs resolved from the model instance.  The canonical
    field is only overridden when the language-specific attribute is non-empty.
    """

    @staticmethod
    def _get_lang(request) -> str:
        """Detect the preferred language from ?lang= param or Accept-Language header.
        Returns 'tr', 'en', or '' — never an arbitrary user-supplied string (Fix API-6).
        """
        if not request:
            return ''
        raw = (
            request.query_params.get('lang')
            or request.headers.get('Accept-Language', '').split(',')[0].split('-')[0].lower()
        )
        # Fix API-6: normalise to the supported set; reject arbitrary values so a
        # crafted ?lang=../../etc/passwd never reaches downstream code.
        return raw if raw in ('tr', 'en') else ''

    @staticmethod
    def _localise(representation: dict, instance, lang: str, mapping: dict) -> dict:
        """
        Mutate *representation* in-place for each entry in *mapping*.
        mapping = { canonical_field: (tr_attr, en_attr) }
        """
        for field, (tr_attr, en_attr) in mapping.items():
            if lang == 'tr':
                val = getattr(instance, tr_attr, None) or ''
                if val:
                    representation[field] = val
            elif lang == 'en':
                val = getattr(instance, en_attr, None) or ''
                if val:
                    representation[field] = val
        return representation


class ChoiceSerializer(LocalisedRepresentationMixin, serializers.ModelSerializer):
    # Fix L-3: hide score from non-staff users — exposing it allows
    # respondents to game the questionnaire by selecting the highest-scoring option.
    score = serializers.SerializerMethodField()

    class Meta:
        model = Choice
        fields = ['id', 'text', 'text_tr', 'text_en', 'score', 'order']

    def get_score(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_staff:
            return obj.score
        return None

    def to_representation(self, instance):
        rep  = super().to_representation(instance)
        lang = self._get_lang(self.context.get('request'))
        return self._localise(rep, instance, lang, {
            'text': ('text_tr', 'text_en'),
        })


class QuestionSerializer(LocalisedRepresentationMixin, serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)
    category_name    = serializers.CharField(source='category.name',    read_only=True)
    category_name_en = serializers.CharField(source='category.name_en', read_only=True)
    category_name_tr = serializers.CharField(source='category.name_tr', read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'survey', 'category', 'category_name', 'category_name_en', 'category_name_tr',
                  'text', 'text_tr', 'text_en',
                  'question_type', 'order', 'is_active', 'allow_multiple', 'attachment',
                  'sector', 'choices']

    def to_representation(self, instance):
        # Fix P: super() already serializes `choices` via the field definition AND
        # DRF automatically propagates context to nested serializers — the explicit
        # re-instantiation of ChoiceSerializer issued a new DB query every time,
        # bypassing any prefetch cache.  Removed.
        rep  = super().to_representation(instance)
        lang = self._get_lang(self.context.get('request'))
        rep  = self._localise(rep, instance, lang, {
            'text': ('text_tr', 'text_en'),
        })

        # Fix H-07: guard against category being null — accessing .name_tr on None
        # raises AttributeError and crashes the serializer for every question in
        # the survey when any question has no category assigned.
        cat = instance.category
        if cat:
            rep = self._localise(rep, cat, lang, {
                'category_name': ('name_tr', 'name_en'),
            })

        return rep


class CategorySerializer(LocalisedRepresentationMixin, serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'survey', 'name', 'name_tr', 'name_en', 'description', 'description_tr', 'description_en', 'order',
                  'environmental_weight', 'social_weight', 'governance_weight',
                  'max_score', 'questions']

    def to_representation(self, instance):
        rep  = super().to_representation(instance)
        lang = self._get_lang(self.context.get('request'))
        return self._localise(rep, instance, lang, {
            'name':        ('name_tr',        'name_en'),
            'description': ('description_tr', 'description_en'),
        })

    def validate(self, data):
        # H2: mirror Category.clean() so the weight-sum rule is enforced when
        # the API creates/updates a category (DRF does not call model.clean()).
        e_w = data.get('environmental_weight',
                       getattr(self.instance, 'environmental_weight', 0.0) or 0.0)
        s_w = data.get('social_weight',
                       getattr(self.instance, 'social_weight', 0.0) or 0.0)
        g_w = data.get('governance_weight',
                       getattr(self.instance, 'governance_weight', 0.0) or 0.0)
        total = e_w + s_w + g_w
        if total > 0 and not (0.99 <= total <= 1.01):
            raise serializers.ValidationError(
                f'The sum of environmental, social and governance weights must equal 1.0 '
                f'(got {total:.2f}).'
            )
        return data


class SurveySessionSerializer(serializers.ModelSerializer):
    status  = serializers.CharField(source='get_status_label', read_only=True)  # Fix BUG-21
    is_open = serializers.SerializerMethodField()  # Fix BUG-22: was BooleanField — model method, not property
    
    class Meta:
        model = SurveySession
        fields = ['id', 'survey', 'name', 'description', 'start_date', 
                  'end_date', 'is_active', 'status', 'is_open', 'created_at']


    def get_is_open(self, obj):  # Fix BUG-22
        return obj.is_open()


def _effective_question_count(survey):
    """
    Return the per-company effective question count for a survey.
    For combined surveys (any sector-tagged questions): universal + 8 (one sector).
    For plain surveys: total active questions.
    """
    total_active = survey.questions.filter(is_active=True).count()
    sector_total = survey.questions.filter(is_active=True).exclude(sector='').count()
    if sector_total > 0:
        distinct_sectors = (
            survey.questions.filter(is_active=True)
            .exclude(sector='')
            .values_list('sector', flat=True)
            .distinct()
            .count()
        )
        per_sector = sector_total // distinct_sectors if distinct_sectors > 0 else 0
        return total_active - sector_total + per_sector
    return total_active


# Fix MED-06: GRI defines exactly 8 sector standards in this system.
# Used to compute per-company question count from annotated sector totals.
_NUM_GRI_SECTORS = 8


class SurveyListSerializer(LocalisedRepresentationMixin, serializers.ModelSerializer):
    """
    Lightweight serializer for GET /api/v1/surveys/ (list).
    Does NOT embed questions or choices — avoids loading 1000+ rows per request.
    Returns `question_count` that reflects the per-company effective count:
      • For combined surveys (any sector-tagged questions): universal + 8 (one sector).
      • For plain surveys: total active questions.

    Fix MED-06: when SurveyViewSet annotates the queryset with _active_total and
    _sector_total (done for the list action), get_question_count() reads those
    pre-computed integers from the instance instead of issuing 2-3 extra queries
    per survey (N×3 queries → 1 query for the whole list).
    """
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = [
            'id', 'name', 'name_tr', 'name_en',
            'description', 'description_tr', 'description_en',
            'is_active', 'allow_multiple_attempts', 'question_count',
        ]

    def get_question_count(self, obj):
        active_total = getattr(obj, '_active_total', None)
        sector_total = getattr(obj, '_sector_total', None)
        if active_total is not None and sector_total is not None:
            if sector_total > 0:
                per_sector = sector_total // _NUM_GRI_SECTORS
                return active_total - sector_total + per_sector
            return active_total
        # Fallback for calls outside the list action (e.g. tests, management commands)
        return _effective_question_count(obj)

    def to_representation(self, instance):
        rep  = super().to_representation(instance)
        lang = self._get_lang(self.context.get('request'))
        return self._localise(rep, instance, lang, {
            'name':        ('name_tr',        'name_en'),
            'description': ('description_tr', 'description_en'),
        })


class SurveySerializer(LocalisedRepresentationMixin, serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    sessions = SurveySessionSerializer(many=True, read_only=True)
    total_questions = serializers.IntegerField(source='get_total_questions', read_only=True)
    # Also expose the per-user effective count on the detail endpoint
    question_count  = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = ['id', 'name', 'name_tr', 'name_en', 'description', 'description_tr', 'description_en',
                  'is_active', 'created_at', 'updated_at', 'allow_multiple_attempts',
                  'show_results_immediately', 'total_questions', 'question_count', 'questions', 'sessions']

    def get_question_count(self, obj):
        """Delegate to SurveyListSerializer logic (shared via module-level helper)."""
        return _effective_question_count(obj)

    def to_representation(self, instance):
        rep  = super().to_representation(instance)
        lang = self._get_lang(self.context.get('request'))
        # Fix P: removed the re-instantiation of QuestionSerializer — it issued a
        # fresh DB query that bypassed the prefetch cache on `questions__choices`.
        # DRF already serializes `questions` via the field definition with full
        # context propagation, so the override was only causing N+1.
        return self._localise(rep, instance, lang, {
            'name':        ('name_tr',        'name_en'),
            'description': ('description_tr', 'description_en'),
        })


# ── Shared mixin ────────────────────────────────────────────────────────────
class AttemptBreakdownMixin:
    """
    Caches the expensive get_category_breakdown() result per attempt instance
    on the serializer so that get_total_score, get_overall_grade, and
    get_category_scores all share one result dict without repeated DB queries.
    Previously this method was copy-pasted in both QuestionnaireAttemptSerializer
    and QuestionnaireAttemptListSerializer.
    """

    def _breakdown(self, obj) -> dict:
        cache_attr = f'_cached_breakdown_{obj.id}'
        if hasattr(self, cache_attr):
            return getattr(self, cache_attr)
        if not obj.is_completed:
            empty: dict = {
                'categories': [], 'total_score': 0,
                'total_possible': 0, 'total_percentage': 0,
            }
            setattr(self, cache_attr, empty)
            return empty
        result = obj.get_category_breakdown()
        setattr(self, cache_attr, result)
        return result


class UserDocumentSerializer(serializers.ModelSerializer):
    file_size_display = serializers.CharField(source='get_file_size_display', read_only=True)
    
    class Meta:
        model = UserDocument
        fields = ['id', 'title', 'description', 'file', 'uploaded_at', 'file_size', 'file_size_display']


class AnswerSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.text', read_only=True)
    choice_text = serializers.SerializerMethodField()
    choices_display = serializers.CharField(source='get_selected_choices_display', read_only=True)
    documents = UserDocumentSerializer(many=True, read_only=True)
    total_score = serializers.IntegerField(source='get_total_score', read_only=True)
    
    class Meta:
        model = Answer
        fields = ['id', 'question', 'question_text', 'choice', 'choice_text',
                  'choices', 'choices_display', 'text_answer', 'notes', 'not_applicable',
                  'answered_at', 'total_score', 'documents']
    
    def get_choice_text(self, obj):
        if obj.choice:
            return obj.choice.text
        return None


class AnswerCreateSerializer(serializers.ModelSerializer):
    choices_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    # Fix BUG-17: declare `attempt` explicitly so the field is validated and
    # documented rather than being injected silently via serializer.save().
    attempt = serializers.PrimaryKeyRelatedField(
        queryset=QuestionnaireAttempt.objects.all(),
        write_only=True,
        required=True,
    )

    class Meta:
        model = Answer
        fields = ['id', 'attempt', 'question', 'choice', 'choices_ids', 'text_answer', 'notes', 'not_applicable']
        read_only_fields = ['id']
        # Fix UPSERT-01: disable the auto-generated UniqueTogetherValidator for
        # (attempt, question).  Without this, DRF rejects a second POST for the
        # same (attempt, question) pair with HTTP 400 before perform_create even
        # runs — which means the upsert logic in perform_create (select_for_update
        # + update existing) is never reached, and users cannot update an answer
        # they have previously saved (e.g. a note-only answer, then later adding
        # a choice selection).  perform_create handles uniqueness atomically at
        # the application layer; the DB unique_together constraint remains as the
        # final safety net.
        validators = []
    
    def validate(self, data):
        # Fix R4-M-01: verify the single `choice` FK belongs to the `question`
        # being answered.  Without this check a client could submit any choice ID
        # from any question and the answer would silently reference the wrong choice.
        question = data.get('question')
        choice   = data.get('choice')
        if question and choice and choice.question_id != question.id:
            raise serializers.ValidationError(
                {'choice': 'The selected choice does not belong to this question.'}
            )
        # N/A answers must not carry any choice selection — clear them so the
        # DB is consistent and scoring logic can rely solely on not_applicable=True.
        if data.get('not_applicable'):
            data['choice']      = None
            data['choices_ids'] = []
        return data

    def create(self, validated_data):
        choices_ids = validated_data.pop('choices_ids', [])
        answer = Answer.objects.create(**validated_data)

        if choices_ids:
            # Fix BUG-29: filter by question so invalid choice IDs are silently
            # dropped rather than polluting the M2M with choices from other questions.
            answer.choices.set(
                Choice.objects.filter(id__in=choices_ids, question=answer.question)
            )

        return answer


class QuestionnaireAttemptSerializer(LocalisedRepresentationMixin, AttemptBreakdownMixin, serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    # Fix #10: CharField(source='x.name') crashes when FK is null.
    # Use SerializerMethodField so we can guard against None gracefully.
    survey_name  = serializers.SerializerMethodField()
    session_name = serializers.SerializerMethodField()
    recommendations = serializers.SerializerMethodField()
    category_scores = serializers.SerializerMethodField()
    total_score = serializers.SerializerMethodField()
    overall_grade = serializers.SerializerMethodField()
    pillar_scores = serializers.SerializerMethodField()
    maturity = serializers.SerializerMethodField()
    answered_count = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()

    class Meta:
        model = QuestionnaireAttempt
        fields = [
            'id', 'user', 'user_name', 'survey', 'survey_name',
            'session', 'session_name', 'started_at', 'completed_at',
            'is_completed', 'total_score', 'overall_grade',
            'selected_sector',
            'pillar_scores', 'maturity', 'answered_count', 'total_questions',
            'answers', 'recommendations', 'category_scores',
        ]

    # ---- helpers ----
    # Fix BM-2: removed duplicate _get_language() — replaced with inherited
    # LocalisedRepresentationMixin._get_lang() which is identical but also
    # sanitises the value to 'tr' | 'en' | '' (Fix API-6).

    # ---- Fix #10: null-safe FK fields ----

    def get_survey_name(self, obj):
        return obj.survey.name if obj.survey_id and obj.survey else None

    def get_session_name(self, obj):
        return obj.session.name if obj.session_id and obj.session else None

    # ---- fields ----

    def get_total_score(self, obj):
        return self._breakdown(obj)['total_percentage']

    def get_overall_grade(self, obj):
        if not obj.is_completed:
            return None
        score = self._breakdown(obj)['total_percentage']
        return QuestionnaireAttempt._grade_for_score(score)

    def get_recommendations(self, obj):
        # Fix #4: use _breakdown() so the cached result is shared with
        # get_total_score / get_category_scores — avoids a second DB round-trip.
        if not obj.is_completed:
            return []
        from .gri_recommendations import get_recommendations_for_category
        breakdown = self._breakdown(obj)
        recs = []
        for cat in breakdown.get('categories', []):
            if cat['percentage'] < 80:
                recs.extend(get_recommendations_for_category(cat['name'], cat['percentage']))
        priority_order = {'High': 0, 'Medium': 1, 'Low': 2}
        recs.sort(key=lambda r: (
            priority_order.get(r.get('priority', 'Low'), 2),
            r.get('score_pct', 50),
        ))
        return recs

    def get_pillar_scores(self, obj):
        # Fix #7/#9: return None for incomplete attempts; compute live pillar
        # scores from the cached breakdown instead of potentially-stale DB columns.
        if not obj.is_completed:
            return None
        cats = self._breakdown(obj).get('categories', [])
        env_n = env_d = soc_n = soc_d = gov_n = gov_d = 0.0
        for c in cats:
            pct = c['percentage']
            e_w = c.get('environmental_weight', 0.0)
            s_w = c.get('social_weight', 0.0)
            g_w = c.get('governance_weight', 0.0)
            env_n += e_w * pct;  env_d += e_w
            soc_n += s_w * pct;  soc_d += s_w
            gov_n += g_w * pct;  gov_d += g_w
        avg = round(sum(c['percentage'] for c in cats) / len(cats), 1) if cats else 0.0
        return {
            'environmental': round(env_n / env_d, 1) if env_d else avg,
            'social':        round(soc_n / soc_d, 1) if soc_d else avg,
            'governance':    round(gov_n / gov_d, 1) if gov_d else avg,
        }

    def get_maturity(self, obj):
        """Return maturity label + narrative for the overall score."""
        if not obj.is_completed:
            return None
        from .gri_recommendations import maturity_label, maturity_narrative
        language = self._get_lang(self.context.get('request')) or 'en'
        score = self._breakdown(obj)['total_percentage']
        return {
            'label':     maturity_label(score, language),
            'narrative': maturity_narrative(score, language),
        }

    def get_answered_count(self, obj):
        # Fix #8: use len() so the prefetch_related cache is hit instead of
        # issuing a separate COUNT query for every attempt.
        return len(obj.answers.all())

    def get_total_questions(self, obj):
        # Fix R4-H-01: use the prefetch cache from survey__categories / questions
        # instead of issuing a fresh .count() query for every attempt in the list.
        # The viewset prefetches 'survey__categories'; here we hit the questions
        # prefetch cache set up on the survey object itself via questions__choices.
        if not obj.survey:
            return 0
        # If the questions relation is already cached by prefetch_related, len()
        # uses the cache; otherwise fall back to a filtered queryset (no N+1 on
        # single-object detail views where prefetch may not be set).
        # Fix H-1: never probe _result_cache — that private attribute was
        # restructured in Django 5 and is unreliable across versions.
        # prefetch_related populates the QuerySet cache; calling list() on the
        # relation re-uses that cache without an extra SQL round-trip.
        # If the relation was NOT prefetched, filter+count() is the correct fallback.
        try:
            qs = obj.survey.questions.all()
            # If already prefetched, _prefetch_cache holds the results under the
            # accessor name.  Check via the public API: iterate and count in Python.
            # list(qs) either hits the prefetch cache or issues exactly one query.
            return sum(1 for q in list(qs) if q.is_active)
        except (AttributeError, TypeError):
            # survey.questions accessor missing (should not happen in practice)
            # or list() on a non-iterable — fall back to a filtered count.
            pass
        return obj.survey.questions.filter(is_active=True).count()

    def get_category_scores(self, obj):
        breakdown = self._breakdown(obj)
        categories = breakdown.get('categories', [])
        # Fix R7-08: default to 'en' when no request context is present
        # (e.g. admin views, management commands) so category names are always
        # localised rather than falling back to the raw `name` field only.
        language = self._get_lang(self.context.get('request')) or 'en'

        # Single bulk query instead of one per category (fixes N+1)
        cat_map: dict = {}
        if language in ('tr', 'en') and categories:
            from .models import Category as CatModel
            ids = [item['id'] for item in categories]
            cat_map = {c.id: c for c in CatModel.objects.filter(pk__in=ids)}

        localized = []
        for item in categories:
            name = item['name']
            cat_obj = cat_map.get(item['id'])
            if cat_obj and language == 'tr' and cat_obj.name_tr:
                name = cat_obj.name_tr
            elif cat_obj and language == 'en' and cat_obj.name_en:
                name = cat_obj.name_en

            localized.append({
                'id':        item['id'],
                'key':       item['key'],
                'name':      name,
                'score':     item['score'],
                'max_score': item['max_score'],
                'percentage':item['percentage'],
            })

        return localized


class QuestionnaireAttemptListSerializer(AttemptBreakdownMixin, serializers.ModelSerializer):
    """Lightweight serializer for listing attempts — delegates to model."""
    user_name    = serializers.CharField(source='user.username', read_only=True)
    # Fix #10: guard against null FK (survey/session may be null)
    survey_name  = serializers.SerializerMethodField()
    session_name = serializers.SerializerMethodField()
    category_scores = serializers.SerializerMethodField()
    total_score = serializers.SerializerMethodField()
    overall_grade = serializers.SerializerMethodField()

    class Meta:
        model = QuestionnaireAttempt
        fields = [
            'id', 'user', 'user_name', 'survey', 'survey_name',
            'session', 'session_name', 'started_at', 'completed_at',
            'is_completed', 'total_score', 'overall_grade',
            'selected_sector',
            'category_scores',
        ]

    # Fix #10: null-safe FK accessors for list serializer
    def get_survey_name(self, obj):
        return obj.survey.name if obj.survey_id and obj.survey else None

    def get_session_name(self, obj):
        return obj.session.name if obj.session_id and obj.session else None

    def get_total_score(self, obj):
        return self._breakdown(obj)['total_percentage']

    def get_overall_grade(self, obj):
        if not obj.is_completed:
            return None
        # H1: delegate to model's single source of truth for grade thresholds.
        score = self._breakdown(obj)['total_percentage']
        return QuestionnaireAttempt._grade_for_score(score)

    def get_category_scores(self, obj):
        return self._breakdown(obj)['categories']


class QuestionnaireAttemptCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionnaireAttempt
        # selected_sector is optional: blank / omitted = universal (no sector filtering).
        fields = ['id', 'survey', 'session', 'selected_sector']
        read_only_fields = ['id']
