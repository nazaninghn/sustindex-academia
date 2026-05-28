from rest_framework import serializers
from .models import (
    Survey, SurveySession, Category, Question, Choice, 
    QuestionnaireAttempt, Answer, UserDocument
)


class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ['id', 'text', 'text_tr', 'text_en', 'score', 'order']
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        # Get language from request header or query param
        language = None
        if request:
            language = request.query_params.get('lang') or request.headers.get('Accept-Language', '').split(',')[0].split('-')[0]
        
        # Return appropriate language text
        if language == 'tr' and instance.text_tr:
            representation['text'] = instance.text_tr
        elif language == 'en' and instance.text_en:
            representation['text'] = instance.text_en
        # else keep default text
        
        return representation


class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = Question
        fields = ['id', 'survey', 'category', 'category_name', 'text', 'text_tr', 'text_en',
                  'question_type', 'order', 'is_active', 'allow_multiple', 'attachment', 'choices']
    
    def to_representation(self, instance):
        # Fix P: super() already serializes `choices` via the field definition AND
        # DRF automatically propagates context to nested serializers — the explicit
        # re-instantiation of ChoiceSerializer issued a new DB query every time,
        # bypassing any prefetch cache.  Removed.
        representation = super().to_representation(instance)
        request = self.context.get('request')

        language = None
        if request:
            language = (
                request.query_params.get('lang')
                or request.headers.get('Accept-Language', '').split(',')[0].split('-')[0]
            )

        if language == 'tr' and instance.text_tr:
            representation['text'] = instance.text_tr
        elif language == 'en' and instance.text_en:
            representation['text'] = instance.text_en

        if language == 'tr' and instance.category.name_tr:
            representation['category_name'] = instance.category.name_tr
        elif language == 'en' and instance.category.name_en:
            representation['category_name'] = instance.category.name_en

        return representation


class CategorySerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Category
        fields = ['id', 'survey', 'name', 'name_tr', 'name_en', 'description', 'description_tr', 'description_en', 'order', 
                  'environmental_weight', 'social_weight', 'governance_weight', 
                  'max_score', 'questions']
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        # Get language from request header or query param
        language = None
        if request:
            language = request.query_params.get('lang') or request.headers.get('Accept-Language', '').split(',')[0].split('-')[0]
        
        # Return appropriate language text
        if language == 'tr':
            if instance.name_tr:
                representation['name'] = instance.name_tr
            if instance.description_tr:
                representation['description'] = instance.description_tr
        elif language == 'en':
            if instance.name_en:
                representation['name'] = instance.name_en
            if instance.description_en:
                representation['description'] = instance.description_en
        
        return representation

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


class SurveySerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    sessions = SurveySessionSerializer(many=True, read_only=True)
    total_questions = serializers.IntegerField(source='get_total_questions', read_only=True)
    
    class Meta:
        model = Survey
        fields = ['id', 'name', 'name_tr', 'name_en', 'description', 'description_tr', 'description_en', 
                  'is_active', 'created_at', 'updated_at', 'allow_multiple_attempts', 
                  'show_results_immediately', 'total_questions', 'questions', 'sessions']
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get('request')
        
        # Get language from request header or query param
        language = None
        if request:
            language = request.query_params.get('lang') or request.headers.get('Accept-Language', '').split(',')[0].split('-')[0]
        
        # Return appropriate language text
        if language == 'tr':
            if instance.name_tr:
                representation['name'] = instance.name_tr
            if instance.description_tr:
                representation['description'] = instance.description_tr
        elif language == 'en':
            if instance.name_en:
                representation['name'] = instance.name_en
            if instance.description_en:
                representation['description'] = instance.description_en
        
        # Fix P: removed the re-instantiation of QuestionSerializer — it issued a
        # fresh DB query that bypassed the prefetch cache on `questions__choices`.
        # DRF already serializes `questions` via the field definition with full
        # context propagation, so the override was only causing N+1.
        return representation


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
                  'choices', 'choices_display', 'text_answer', 'notes', 'answered_at', 'total_score', 'documents']
    
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
        fields = ['id', 'attempt', 'question', 'choice', 'choices_ids', 'text_answer', 'notes']
        read_only_fields = ['id']
    
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


class QuestionnaireAttemptSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    survey_name = serializers.CharField(source='survey.name', read_only=True)
    session_name = serializers.CharField(source='session.name', read_only=True)
    recommendations = serializers.SerializerMethodField()
    category_scores = serializers.SerializerMethodField()
    total_score = serializers.SerializerMethodField()
    overall_grade = serializers.SerializerMethodField()

    class Meta:
        model = QuestionnaireAttempt
        fields = [
            'id', 'user', 'user_name', 'survey', 'survey_name',
            'session', 'session_name', 'started_at', 'completed_at',
            'is_completed', 'total_score', 'overall_grade',
            'answers', 'recommendations', 'category_scores',
        ]

    # ---- helpers ----

    def _breakdown(self, obj):
        cache_attr = f'_cached_breakdown_{obj.id}'
        if hasattr(self, cache_attr):
            return getattr(self, cache_attr)

        if not obj.is_completed:
            empty = {'categories': [], 'total_score': 0, 'total_possible': 0, 'total_percentage': 0}
            setattr(self, cache_attr, empty)
            return empty

        result = obj.get_category_breakdown()
        setattr(self, cache_attr, result)
        return result

    def _get_language(self):
        request = self.context.get('request')
        if request:
            return (
                request.query_params.get('lang')
                or request.headers.get('Accept-Language', '').split(',')[0].split('-')[0]
            )
        return None

    # ---- fields ----

    def get_total_score(self, obj):
        return self._breakdown(obj)['total_percentage']

    def get_overall_grade(self, obj):
        if not obj.is_completed:
            return None
        # H1: delegate to model's single source of truth for grade thresholds.
        score = self._breakdown(obj)['total_percentage']
        return QuestionnaireAttempt._grade_for_score(score)

    def get_recommendations(self, obj):
        return obj.get_recommendations() if obj.is_completed else []

    def get_category_scores(self, obj):
        breakdown = self._breakdown(obj)
        categories = breakdown.get('categories', [])
        language = self._get_language()

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


class QuestionnaireAttemptListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing attempts — delegates to model."""
    user_name = serializers.CharField(source='user.username', read_only=True)
    survey_name = serializers.CharField(source='survey.name', read_only=True)
    session_name = serializers.CharField(source='session.name', read_only=True)
    category_scores = serializers.SerializerMethodField()
    total_score = serializers.SerializerMethodField()
    overall_grade = serializers.SerializerMethodField()

    class Meta:
        model = QuestionnaireAttempt
        fields = [
            'id', 'user', 'user_name', 'survey', 'survey_name',
            'session', 'session_name', 'started_at', 'completed_at',
            'is_completed', 'total_score', 'overall_grade',
            'category_scores',
        ]

    def _breakdown(self, obj):
        cache_attr = f'_cached_breakdown_{obj.id}'
        if hasattr(self, cache_attr):
            return getattr(self, cache_attr)

        if not obj.is_completed:
            empty = {'categories': [], 'total_score': 0, 'total_possible': 0, 'total_percentage': 0}
            setattr(self, cache_attr, empty)
            return empty

        result = obj.get_category_breakdown()
        setattr(self, cache_attr, result)
        return result

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
        fields = ['id', 'survey', 'session']
        read_only_fields = ['id']
