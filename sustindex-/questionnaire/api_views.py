from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import (
    Survey, SurveySession, Category, Question, Choice,
    QuestionnaireAttempt, Answer, UserDocument
)
from .serializers import (
    SurveySerializer, SurveySessionSerializer, CategorySerializer,
    QuestionSerializer, ChoiceSerializer, QuestionnaireAttemptSerializer,
    QuestionnaireAttemptCreateSerializer, QuestionnaireAttemptListSerializer,
    AnswerSerializer, AnswerCreateSerializer, UserDocumentSerializer
)

# Fix O (Round 4): try python-magic for magic-bytes MIME validation;
# fall back to header-only check if the package isn't installed.
try:
    import magic as _magic
    _MAGIC_AVAILABLE = True
except ImportError:
    _magic = None           # type: ignore
    _MAGIC_AVAILABLE = False

_ALLOWED_CONTENT_TYPES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
}


class SurveyViewSet(viewsets.ReadOnlyModelViewSet):
    # Fix N: prefetch nested relations up-front — avoids N+1 when serializing
    # questions and their choices in a single request.
    queryset = (
        Survey.objects.filter(is_active=True)
        .prefetch_related('questions__choices', 'sessions')
    )
    serializer_class = SurveySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        survey = self.get_object()
        questions = (
            survey.questions
            .filter(is_active=True)
            .select_related('category', 'survey')
            .prefetch_related('choices')
            .order_by('category', 'order')
        )
        serializer = QuestionSerializer(questions, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def sessions(self, request, pk=None):
        survey = self.get_object()
        sessions = survey.sessions.filter(is_active=True).select_related('survey')
        serializer = SurveySessionSerializer(sessions, many=True)
        return Response(serializer.data)


class SurveySessionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SurveySession.objects.filter(is_active=True).select_related('survey')  # Fix N
    serializer_class = SurveySessionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    @action(detail=False, methods=['get'])
    def open_sessions(self, request):
        now = timezone.now()
        sessions = (
            SurveySession.objects
            .filter(is_active=True, start_date__lte=now, end_date__gte=now)
            .select_related('survey')                                        # Fix N
        )
        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Category.objects.all()
        .order_by('order')
        .prefetch_related('questions__choices')                              # Fix N
    )
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class QuestionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Question.objects.filter(is_active=True)
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = (
            Question.objects.filter(is_active=True)
            .select_related('category', 'survey')   # Fix N
            .prefetch_related('choices')            # Fix N
        )
        survey_id = self.request.query_params.get('survey')
        category_id = self.request.query_params.get('category')
        if survey_id:
            queryset = queryset.filter(survey_id=survey_id)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        return queryset.order_by('category', 'order')


class QuestionnaireAttemptViewSet(viewsets.ModelViewSet):
    queryset = QuestionnaireAttempt.objects.all()
    serializer_class = QuestionnaireAttemptSerializer
    permission_classes = [IsAuthenticated]

    def _base_queryset(self):
        # Fix N: single queryset definition with all joins — reused by every action.
        return (
            QuestionnaireAttempt.objects
            .select_related('user', 'survey', 'session')
            .prefetch_related(
                'answers__question__choices',
                'answers__choice',
                'answers__choices',
                'answers__documents',
            )
        )

    def get_queryset(self):
        if self.request.user.is_staff:
            return self._base_queryset()
        return self._base_queryset().filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'create':
            return QuestionnaireAttemptCreateSerializer
        if self.action in ['list', 'my_attempts']:
            return QuestionnaireAttemptListSerializer
        return QuestionnaireAttemptSerializer

    def perform_create(self, serializer):
        survey = serializer.validated_data.get('survey')
        if survey and not survey.allow_multiple_attempts:
            already_done = QuestionnaireAttempt.objects.filter(
                user=self.request.user, survey=survey, is_completed=True
            ).exists()
            if already_done:
                raise DRFValidationError({
                    'detail': 'Multiple attempts are not allowed for this survey.'
                })
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
        attempt.save()
        scores = attempt.calculate_scores()
        serializer = self.get_serializer(attempt)
        return Response({
            'attempt': serializer.data,
            'summary': {
                'total_score': scores['total_score'],
                'total_possible': scores['total_possible'],
                'total_percentage': scores['total_percentage'],
                'grade': scores['grade'],
            }
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
        # Fix N: join all relations used by AnswerSerializer in one query.
        qs = (
            Answer.objects
            .select_related('attempt__user', 'attempt__survey', 'question__category', 'choice')
            .prefetch_related('choices', 'documents')
        )
        if self.request.user.is_staff:
            return qs
        return qs.filter(attempt__user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'create':
            return AnswerCreateSerializer
        return AnswerSerializer

    def perform_create(self, serializer):
        attempt_id = self.request.data.get('attempt')
        if not attempt_id:
            raise DRFValidationError({'attempt': 'This field is required.'})

        attempt = get_object_or_404(QuestionnaireAttempt, id=attempt_id)

        if attempt.user != self.request.user:
            raise PermissionDenied("Cannot answer for another user's attempt.")

        if attempt.is_completed:
            raise DRFValidationError({'detail': 'Cannot modify a completed attempt.'})

        question_id = self.request.data.get('question')
        existing = Answer.objects.filter(attempt=attempt, question_id=question_id).first()
        if existing:
            choice = self.request.data.get('choice')
            text_answer = self.request.data.get('text_answer', '')
            notes = self.request.data.get('notes', '')
            choices_ids = self.request.data.get('choices_ids', [])

            existing.choice_id = choice
            existing.text_answer = text_answer
            existing.notes = notes
            existing.save()

            # Fix D (Round 2): always sync M2M — empty list clears stale multi-select choices.
            existing.choices.set(Choice.objects.filter(id__in=choices_ids) if choices_ids else [])

            serializer.instance = existing
            return

        serializer.save(attempt=attempt)


class UserDocumentViewSet(viewsets.ModelViewSet):
    queryset = UserDocument.objects.all()
    serializer_class = UserDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = UserDocument.objects.select_related('answer__attempt__user')   # Fix N
        if self.request.user.is_staff:
            return qs
        return qs.filter(answer__attempt__user=self.request.user)

    def perform_create(self, serializer):
        file = self.request.FILES.get('file')
        if not file:
            raise DRFValidationError({'file': 'A file is required.'})

        # Fix E (Round 2): enforce 10 MB server-side limit
        MAX_BYTES = 10 * 1024 * 1024
        if file.size > MAX_BYTES:
            raise DRFValidationError({'file': 'File too large. Maximum size is 10 MB.'})

        # Fix O (Round 4): magic-bytes check when python-magic is installed;
        # fall back to Content-Type header check otherwise.
        if _MAGIC_AVAILABLE:
            header = file.read(2048)
            file.seek(0)
            detected_mime = _magic.from_buffer(header, mime=True)
            if detected_mime not in _ALLOWED_CONTENT_TYPES:
                raise DRFValidationError(
                    {'file': f'Unsupported file type detected by magic bytes: {detected_mime}.'}
                )
        else:
            if file.content_type not in _ALLOWED_CONTENT_TYPES:
                raise DRFValidationError(
                    {'file': f'Unsupported file type: {file.content_type}.'}
                )

        serializer.save(file_size=file.size)
