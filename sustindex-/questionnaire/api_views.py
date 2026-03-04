from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from django.utils import timezone
from .models import (
    Survey, SurveySession, Category, Question, Choice,
    QuestionnaireAttempt, Answer, UserDocument
)
from .serializers import (
    SurveySerializer, SurveySessionSerializer, CategorySerializer,
    QuestionSerializer, ChoiceSerializer, QuestionnaireAttemptSerializer,
    QuestionnaireAttemptCreateSerializer, AnswerSerializer,
    AnswerCreateSerializer, UserDocumentSerializer
)


class SurveyViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Survey.objects.filter(is_active=True)
    serializer_class = SurveySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        survey = self.get_object()
        questions = survey.questions.filter(is_active=True).order_by('category', 'order')
        serializer = QuestionSerializer(questions, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def sessions(self, request, pk=None):
        survey = self.get_object()
        sessions = survey.sessions.filter(is_active=True)
        serializer = SurveySessionSerializer(sessions, many=True)
        return Response(serializer.data)


class SurveySessionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SurveySession.objects.filter(is_active=True)
    serializer_class = SurveySessionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    @action(detail=False, methods=['get'])
    def open_sessions(self, request):
        now = timezone.now()
        sessions = SurveySession.objects.filter(
            is_active=True,
            start_date__lte=now,
            end_date__gte=now
        )
        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all().order_by('order')
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class QuestionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Question.objects.filter(is_active=True)
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        queryset = Question.objects.filter(is_active=True)
        survey_id = self.request.query_params.get('survey', None)
        category_id = self.request.query_params.get('category', None)
        
        if survey_id:
            queryset = queryset.filter(survey_id=survey_id)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        
        return queryset.order_by('category', 'order')


class QuestionnaireAttemptViewSet(viewsets.ModelViewSet):
    queryset = QuestionnaireAttempt.objects.all()
    serializer_class = QuestionnaireAttemptSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return QuestionnaireAttempt.objects.all()
        return QuestionnaireAttempt.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return QuestionnaireAttemptCreateSerializer
        return QuestionnaireAttemptSerializer
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        attempt = self.get_object()
        
        if attempt.is_completed:
            return Response(
                {'error': 'Attempt already completed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        attempt.is_completed = True
        attempt.completed_at = timezone.now()
        attempt.save()  # Save the attempt first
        scores = attempt.calculate_scores()
        
        serializer = self.get_serializer(attempt)
        return Response({
            'attempt': serializer.data,
            'scores': scores
        })
    
    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        attempt = self.get_object()
        
        if not attempt.is_completed:
            return Response(
                {'error': 'Attempt not completed yet'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(attempt)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my_attempts(self, request):
        attempts = self.get_queryset().filter(user=request.user)
        serializer = self.get_serializer(attempts, many=True)
        return Response(serializer.data)


class AnswerViewSet(viewsets.ModelViewSet):
    queryset = Answer.objects.all()
    serializer_class = AnswerSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return Answer.objects.all()
        return Answer.objects.filter(attempt__user=self.request.user)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return AnswerCreateSerializer
        return AnswerSerializer
    
    def perform_create(self, serializer):
        attempt_id = self.request.data.get('attempt')
        attempt = QuestionnaireAttempt.objects.get(id=attempt_id)
        
        if attempt.user != self.request.user:
            raise PermissionError("Cannot answer for another user's attempt")
        
        if attempt.is_completed:
            raise ValueError("Cannot modify completed attempt")
        
        serializer.save(attempt=attempt)


class UserDocumentViewSet(viewsets.ModelViewSet):
    queryset = UserDocument.objects.all()
    serializer_class = UserDocumentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return UserDocument.objects.all()
        return UserDocument.objects.filter(answer__attempt__user=self.request.user)
    
    def perform_create(self, serializer):
        file = self.request.FILES.get('file')
        file_size = file.size if file else 0
        serializer.save(file_size=file_size)
