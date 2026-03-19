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
        
        # Return appropriate category name
        if language == 'tr' and instance.category.name_tr:
            representation['category_name'] = instance.category.name_tr
        elif language == 'en' and instance.category.name_en:
            representation['category_name'] = instance.category.name_en
        
        # Pass context to nested serializers
        representation['choices'] = ChoiceSerializer(
            instance.choices.all(), 
            many=True, 
            context=self.context
        ).data
        
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


class SurveySessionSerializer(serializers.ModelSerializer):
    status = serializers.CharField(source='get_status_display', read_only=True)
    is_open = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = SurveySession
        fields = ['id', 'survey', 'name', 'description', 'start_date', 
                  'end_date', 'is_active', 'status', 'is_open', 'created_at']


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
        
        # Pass context to nested serializers
        representation['questions'] = QuestionSerializer(
            instance.questions.filter(is_active=True), 
            many=True, 
            context=self.context
        ).data
        
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
        required=False
    )
    
    class Meta:
        model = Answer
        fields = ['question', 'choice', 'choices_ids', 'text_answer', 'notes']
    
    def create(self, validated_data):
        choices_ids = validated_data.pop('choices_ids', [])
        answer = Answer.objects.create(**validated_data)
        
        if choices_ids:
            answer.choices.set(Choice.objects.filter(id__in=choices_ids))
        
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
        fields = ['id', 'user', 'user_name', 'survey', 'survey_name', 
                  'session', 'session_name', 'started_at', 'completed_at', 
                  'is_completed', 'total_score', 'environmental_score', 
                  'social_score', 'governance_score', 'overall_grade', 
                  'answers', 'recommendations', 'category_scores']
    
    def get_total_score(self, obj):
        """Compute total score dynamically from category scores"""
        if not obj.is_completed:
            return 0
        cat_scores = self._get_category_data(obj)
        total_earned = sum(c['score'] for c in cat_scores.values())
        total_possible = sum(c['max_score'] for c in cat_scores.values())
        if total_possible == 0:
            return 0
        return min(round(total_earned / total_possible * 100, 2), 100)
    
    def get_overall_grade(self, obj):
        """Compute grade dynamically"""
        score = self.get_total_score(obj)
        if score >= 80: return 'A+'
        elif score >= 70: return 'A'
        elif score >= 60: return 'B+'
        elif score >= 50: return 'B'
        elif score >= 40: return 'C+'
        elif score >= 30: return 'C'
        else: return 'D'
    
    def get_recommendations(self, obj):
        if obj.is_completed:
            return obj.get_recommendations()
        return []
    
    def get_category_scores(self, obj):
        """Return dynamic category scores"""
        return self._get_category_data(obj)
    
    def _get_category_data(self, obj):
        """Shared helper to compute category scores"""
        # Cache to avoid recomputation
        cache_attr = f'_cached_cat_scores_{obj.id}'
        if hasattr(self, cache_attr):
            return getattr(self, cache_attr)
        
        if not obj.is_completed:
            setattr(self, cache_attr, {})
            return {}
        
        from .models import Category
        from django.db import models as db_models
        
        if obj.survey:
            categories = Category.objects.filter(
                survey=obj.survey
            ).order_by('order')
            if not categories.exists():
                categories = Category.objects.filter(
                    questions__survey=obj.survey,
                    questions__is_active=True
                ).distinct().order_by('order')
        else:
            categories = Category.objects.filter(
                questions__is_active=True
            ).distinct().order_by('order')
        
        result = {}
        for category in categories:
            if obj.survey:
                questions = category.questions.filter(is_active=True, survey=obj.survey)
            else:
                questions = category.questions.filter(is_active=True)
            
            cat_score = 0
            cat_possible = 0
            
            for question in questions:
                answer = obj.answers.filter(question=question).first()
                if answer:
                    cat_score += answer.get_total_score()
                max_choice_score = question.choices.aggregate(db_models.Max('score'))['score__max'] or 0
                cat_possible += max_choice_score
            
            # Get translated name
            request = self.context.get('request')
            language = None
            if request:
                language = request.query_params.get('lang') or request.headers.get('Accept-Language', '').split(',')[0].split('-')[0]
            
            name = category.name
            if language == 'tr' and category.name_tr:
                name = category.name_tr
            elif language == 'en' and category.name_en:
                name = category.name_en
            
            result[category.name] = {
                'name': name,
                'score': cat_score,
                'max_score': cat_possible,
                'percentage': min(round((cat_score / cat_possible * 100), 2), 100) if cat_possible > 0 else 0,
            }
        
        setattr(self, cache_attr, result)
        return result


class QuestionnaireAttemptListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing attempts with dynamic scores"""
    user_name = serializers.CharField(source='user.username', read_only=True)
    survey_name = serializers.CharField(source='survey.name', read_only=True)
    session_name = serializers.CharField(source='session.name', read_only=True)
    category_scores = serializers.SerializerMethodField()
    total_score = serializers.SerializerMethodField()
    overall_grade = serializers.SerializerMethodField()
    
    class Meta:
        model = QuestionnaireAttempt
        fields = ['id', 'user', 'user_name', 'survey', 'survey_name', 
                  'session', 'session_name', 'started_at', 'completed_at', 
                  'is_completed', 'total_score', 'environmental_score', 
                  'social_score', 'governance_score', 'overall_grade',
                  'category_scores']
    
    def get_total_score(self, obj):
        """Compute total score dynamically"""
        if not obj.is_completed:
            return 0
        cat_scores = self.get_category_scores(obj)
        total_earned = sum(c['score'] for c in cat_scores.values())
        total_possible = sum(c['max_score'] for c in cat_scores.values())
        if total_possible == 0:
            return 0
        return min(round(total_earned / total_possible * 100, 2), 100)
    
    def get_overall_grade(self, obj):
        """Compute grade dynamically"""
        score = self.get_total_score(obj)
        if score >= 80: return 'A+'
        elif score >= 70: return 'A'
        elif score >= 60: return 'B+'
        elif score >= 50: return 'B'
        elif score >= 40: return 'C+'
        elif score >= 30: return 'C'
        else: return 'D'
    
    def get_category_scores(self, obj):
        """Return dynamic category scores for list view too"""
        cache_attr = f'_cached_cat_scores_{obj.id}'
        if hasattr(self, cache_attr):
            return getattr(self, cache_attr)
        
        if not obj.is_completed:
            setattr(self, cache_attr, {})
            return {}
        
        from .models import Category
        from django.db import models as db_models
        
        if obj.survey:
            categories = Category.objects.filter(
                survey=obj.survey
            ).order_by('order')
            if not categories.exists():
                categories = Category.objects.filter(
                    questions__survey=obj.survey,
                    questions__is_active=True
                ).distinct().order_by('order')
        else:
            categories = Category.objects.filter(
                questions__is_active=True
            ).distinct().order_by('order')
        
        result = {}
        for category in categories:
            if obj.survey:
                questions = category.questions.filter(is_active=True, survey=obj.survey)
            else:
                questions = category.questions.filter(is_active=True)
            
            cat_score = 0
            cat_possible = 0
            
            for question in questions:
                answer = obj.answers.filter(question=question).first()
                if answer:
                    cat_score += answer.get_total_score()
                max_choice_score = question.choices.aggregate(db_models.Max('score'))['score__max'] or 0
                cat_possible += max_choice_score
            
            request = self.context.get('request')
            language = None
            if request:
                language = request.query_params.get('lang') or request.headers.get('Accept-Language', '').split(',')[0].split('-')[0]
            
            name = category.name
            if language == 'tr' and category.name_tr:
                name = category.name_tr
            elif language == 'en' and category.name_en:
                name = category.name_en
            
            result[category.name] = {
                'name': name,
                'score': cat_score,
                'max_score': cat_possible,
                'percentage': min(round((cat_score / cat_possible * 100), 2), 100) if cat_possible > 0 else 0,
            }
        
        setattr(self, cache_attr, result)
        return result


class QuestionnaireAttemptCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionnaireAttempt
        fields = ['id', 'survey', 'session']
        read_only_fields = ['id']
