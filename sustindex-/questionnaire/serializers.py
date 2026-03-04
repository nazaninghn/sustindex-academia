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
                  'order', 'is_active', 'allow_multiple', 'attachment', 'choices']
    
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
        fields = ['id', 'name', 'name_tr', 'name_en', 'description', 'description_tr', 'description_en', 'order', 
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
    choice_text = serializers.CharField(source='choice.text', read_only=True)
    choices_display = serializers.CharField(source='get_selected_choices_display', read_only=True)
    documents = UserDocumentSerializer(many=True, read_only=True)
    total_score = serializers.IntegerField(source='get_total_score', read_only=True)
    
    class Meta:
        model = Answer
        fields = ['id', 'question', 'question_text', 'choice', 'choice_text', 
                  'choices', 'choices_display', 'notes', 'answered_at', 'total_score', 'documents']


class AnswerCreateSerializer(serializers.ModelSerializer):
    choices_ids = serializers.ListField(
        child=serializers.IntegerField(), 
        write_only=True, 
        required=False
    )
    
    class Meta:
        model = Answer
        fields = ['question', 'choice', 'choices_ids', 'notes']
    
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
    
    class Meta:
        model = QuestionnaireAttempt
        fields = ['id', 'user', 'user_name', 'survey', 'survey_name', 
                  'session', 'session_name', 'started_at', 'completed_at', 
                  'is_completed', 'total_score', 'environmental_score', 
                  'social_score', 'governance_score', 'overall_grade', 
                  'answers', 'recommendations']
    
    def get_recommendations(self, obj):
        if obj.is_completed:
            return obj.get_recommendations()
        return []


class QuestionnaireAttemptCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionnaireAttempt
        fields = ['id', 'survey', 'session']
        read_only_fields = ['id']
