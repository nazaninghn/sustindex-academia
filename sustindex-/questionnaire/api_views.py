import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, IsAdminUser
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from django.conf import settings as django_settings
from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone

logger = logging.getLogger(__name__)
from .models import (
    Survey, SurveySession, Category, Question, Choice,
    QuestionnaireAttempt, Answer, UserDocument
)
from .serializers import (
    SurveySerializer, SurveyListSerializer, SurveySessionSerializer, CategorySerializer,
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
    # Fix R5-H-02: require authentication — survey content must not be accessible
    # to anonymous users.
    # Fix PERF: list uses SurveyListSerializer (no nested questions/choices) to
    # avoid loading 1000+ rows per request on the surveys page.
    # Detail endpoint still uses the full SurveySerializer with all questions.
    queryset = Survey.objects.filter(is_active=True)
    serializer_class = SurveySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.action == 'list':
            # Fix MED-06: annotate with question counts in a single query so
            # SurveyListSerializer.get_question_count() can read pre-computed
            # values from the instance instead of issuing 2-3 extra queries per
            # survey (N×3 queries → 1 query for the whole list).
            from django.db.models import Count, Q
            return Survey.objects.filter(is_active=True).annotate(
                _active_total=Count(
                    'questions',
                    filter=Q(questions__is_active=True),
                    distinct=True,
                ),
                _sector_total=Count(
                    'questions',
                    filter=Q(questions__is_active=True) & ~Q(questions__sector=''),
                    distinct=True,
                ),
            )
        return (
            Survey.objects.filter(is_active=True)
            .prefetch_related('questions__choices', 'sessions')
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return SurveyListSerializer
        return SurveySerializer

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
        # Sector filtering: when ?attempt=<id> is provided, look up the
        # attempt's selected_sector and include only universal + matching questions.
        attempt_id = request.query_params.get('attempt')
        if attempt_id:
            try:
                from django.db.models import Q
                attempt = QuestionnaireAttempt.objects.only('selected_sector').get(
                    pk=int(attempt_id),
                    user=request.user,
                )
                sector = attempt.selected_sector or ''
                questions = questions.filter(Q(sector='') | Q(sector=sector))
            except (QuestionnaireAttempt.DoesNotExist, ValueError, TypeError):
                pass  # unknown/invalid attempt_id → return all active questions
        serializer = QuestionSerializer(questions, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def sessions(self, request, pk=None):
        survey = self.get_object()
        sessions = survey.sessions.filter(is_active=True).select_related('survey')
        # Fix HIGH-07: pass context so the serializer can build absolute URLs for
        # any file/hyperlink fields and access the authenticated request.
        serializer = SurveySessionSerializer(sessions, many=True, context={'request': request})
        return Response(serializer.data)


class SurveySessionViewSet(viewsets.ReadOnlyModelViewSet):
    # Fix R5-H-02: require authentication
    queryset = SurveySession.objects.filter(is_active=True).select_related('survey')  # Fix N
    serializer_class = SurveySessionSerializer
    permission_classes = [IsAuthenticated]

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
    # Fix R5-H-02: require authentication
    # Fix H-2: use .none() as the class-level queryset sentinel and override
    # get_queryset() so categories are scoped to active surveys only (previously
    # returned ALL categories, including ones from soft-deleted / inactive surveys
    # that the user should never see).
    queryset = Category.objects.none()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Fix H-2: restrict to categories that belong to an active survey.
        # This prevents leaking categories from inactive / deleted surveys and
        # keeps the response in sync with SurveyViewSet's is_active=True filter.
        return (
            Category.objects.filter(survey__is_active=True)
            .order_by('order')
            # Fix BUG-06: select_related('category') on nested questions prevents
            # QuestionSerializer.to_representation from lazy-loading category per question.
            .prefetch_related(
                Prefetch(
                    'questions',
                    queryset=Question.objects.filter(is_active=True)
                        .select_related('category')
                        .prefetch_related('choices'),
                )
            )
        )


class QuestionViewSet(viewsets.ReadOnlyModelViewSet):
    # Fix #38: .none() prevents full exposure during schema generation;
    # get_queryset() (with select_related + prefetch_related) is always used.
    # Fix R5-H-02: require authentication
    queryset = Question.objects.none()
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticated]

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
        # Sector filtering: when ?attempt=<id> is provided, look up the
        # attempt's selected_sector and include only universal + matching questions.
        attempt_id = self.request.query_params.get('attempt')
        if attempt_id:
            try:
                from django.db.models import Q
                attempt = QuestionnaireAttempt.objects.only('selected_sector').get(
                    pk=int(attempt_id),
                    user=self.request.user,
                )
                sector = attempt.selected_sector or ''
                queryset = queryset.filter(Q(sector='') | Q(sector=sector))
            except (QuestionnaireAttempt.DoesNotExist, ValueError, TypeError):
                pass  # unknown/invalid attempt_id → return all active questions
        return queryset.order_by('category', 'order')


    @action(detail=True, methods=['get'], url_path='attachment')
    def download_attachment(self, request, pk=None):
        """
        Fix R6-11: serve question attachments through an authenticated endpoint
        instead of exposing raw /media/ URLs that anyone with the link can access.
        """
        import os as _os
        from django.http import FileResponse as _FileResponse, Http404 as _Http404
        question = self.get_object()
        if not question.attachment:
            raise _Http404
        try:
            file_path = question.attachment.path
        except (ValueError, NotImplementedError):
            return Response({'url': question.attachment.url})
        if not _os.path.exists(file_path):
            raise _Http404
        try:
            fh = open(file_path, 'rb')
        except OSError:
            raise _Http404
        return _FileResponse(
            fh,
            as_attachment=True,
            filename=_os.path.basename(question.attachment.name),
        )


class QuestionnaireAttemptViewSet(viewsets.ModelViewSet):
    # Fix BUG-07: .none() prevents unfiltered exposure if get_queryset() is bypassed
    # (schema generation, router introspection, etc.)
    queryset = QuestionnaireAttempt.objects.none()
    serializer_class = QuestionnaireAttemptSerializer
    permission_classes = [IsAuthenticated]

    def _base_queryset(self):
        # Fix N: single queryset definition with all joins — reused by every action.
        # Fix #29: prefetch survey__categories so get_survey_categories() hits the
        # cache instead of issuing an extra query per completed attempt.
        return (
            QuestionnaireAttempt.objects
            .select_related('user', 'survey', 'session')
            .prefetch_related(
                'answers__question__choices',
                'answers__choice',
                'answers__choices',
                'answers__documents',
                'survey__categories',
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
        user = self.request.user

        # Fix C-02: wrap the existence check + insert in a single atomic block
        # with select_for_update so two concurrent POST requests for the same
        # (user, survey) can't both pass the `already_done` check and both
        # insert a duplicate attempt.
        # Fix R9-03: moved the silver membership check INSIDE the atomic block.
        # Previously the count() ran outside the transaction, creating a TOCTOU
        # race: two concurrent Silver users could both read completed_count=0,
        # both pass the guard, and both create an attempt — eventually yielding
        # 2 completed assessments.  select_for_update() serialises the check.
        with transaction.atomic():
            # Fix H-2: enforce membership-gating at the API layer so direct API
            # calls can't bypass the attempt limits enforced in the template view.
            # Limits are read from settings.ATTEMPT_LIMITS (same source as the
            # template view) so the two enforcement points stay in sync.
            # select_for_update locks the rows so a concurrent request is blocked
            # until this transaction commits, eliminating the race condition.
            # Fix START-1: the old hard-coded default {'free': 3} blocked the
            # 4-phase GRI flow — completing phases 1/2/3 already consumed the
            # free quota, making it impossible to start phase 4.  The default
            # is now unlimited for all tiers; set ATTEMPT_LIMITS in Django
            # settings to re-enable per-tier limits when a paywall is needed.
            _attempt_limits = getattr(
                django_settings, 'ATTEMPT_LIMITS',
                {'free': None, 'silver': None, 'gold': None},
            )
            _limit = _attempt_limits.get(user.membership_type)
            if _limit is not None:
                completed_count = (
                    QuestionnaireAttempt.objects
                    .select_for_update()
                    .filter(user=user, is_completed=True)
                    .count()
                )
                if completed_count >= _limit:
                    raise PermissionDenied(
                        f'Your {user.membership_type.capitalize()} membership '
                        f'allows {_limit} completed assessment(s). '
                        'Upgrade your membership for more access.'
                    )

            survey = serializer.validated_data.get('survey')
            if survey and not survey.allow_multiple_attempts:
                already_done = (
                    QuestionnaireAttempt.objects
                    .select_for_update()
                    .filter(user=self.request.user, survey=survey, is_completed=True)
                    .exists()
                )
                if already_done:
                    raise DRFValidationError({
                        'detail': 'Multiple attempts are not allowed for this survey.'
                    })

            # Fix START-4: enforce GRI phase ordering at the backend.
            # Phase 2 requires a completed Phase 1; Phase 3 requires Phase 2;
            # Sector requires Phase 3 (v4) OR Economic/Bolum4 (v5).
            # The UI already gates navigation but without backend enforcement
            # a direct API call can skip phases.
            PHASE_PREREQS = [
                ('GRI 2:',      'GRI 1:'),
                ('GRI 3:',      'GRI 2:'),
            ]
            survey_name = (survey.name or '') if survey else ''
            for current_prefix, required_prefix in PHASE_PREREQS:
                if survey_name.startswith(current_prefix):
                    has_prereq = QuestionnaireAttempt.objects.filter(
                        user=user,
                        survey__name__startswith=required_prefix,
                        is_completed=True,
                    ).exists()
                    if not has_prereq:
                        required_label = required_prefix.rstrip(':')
                        raise DRFValidationError({
                            'detail': (
                                f'You must complete {required_label} before '
                                f'starting this phase.'
                            ),
                            'prerequisite': required_label,
                        })
                    break  # only the first matching rule applies

            # Fix START-4b: GRI Sector requires EITHER old v4 "GRI 3:" OR
            # v5 "Bolum 4: Ekonomik" to be completed (accept both naming schemes).
            if survey_name.startswith('GRI Sector:'):
                from django.db.models import Q as _Q
                has_prereq = QuestionnaireAttempt.objects.filter(
                    user=user,
                    is_completed=True,
                ).filter(
                    _Q(survey__name__startswith='GRI 3:') |
                    _Q(survey__name__icontains='Ekonomik')
                ).exists()
                if not has_prereq:
                    raise DRFValidationError({
                        'detail': (
                            'You must complete Economic Performance before '
                            'starting the Sector Standard.'
                        ),
                        'prerequisite': 'Economic Performance',
                    })

            serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        # Fix HIGH-05: scope to request.user regardless of staff status to prevent
        # IDOR — a staff user should not be able to complete another user's attempt
        # via this endpoint (admin operations belong in the admin panel).
        # BH-4: wrap entire check-and-update in a single atomic block with
        # select_for_update() so two concurrent complete requests cannot both
        # pass the is_completed guard and race into save().
        try:
          return self._complete_attempt(request, pk)
        except Exception as exc:
            logger.error(
                '[complete] UNHANDLED ERROR pk=%s user=%s type=%s msg=%s',
                pk, getattr(request.user, 'id', '?'),
                type(exc).__name__, exc,
                exc_info=True,
            )
            return Response(
                {'error': 'complete_failed', 'detail': str(exc), 'type': type(exc).__name__},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _complete_attempt(self, request, pk):
        with transaction.atomic():
            # Fix START-3: use select_for_update(of=('self',)) instead of
            # select_for_update().  _base_queryset() uses select_related on
            # nullable FKs (survey, session) which Django translates to LEFT
            # OUTER JOINs.  PostgreSQL raises
            #   "FOR UPDATE cannot be applied to the nullable side of an outer join"
            # when select_for_update() tries to lock those joined tables too.
            # of=('self',) restricts the lock to the questionnaireattempt table
            # only — exactly what we need to serialise concurrent complete calls.
            attempt = get_object_or_404(
                self._base_queryset().filter(user=request.user).select_for_update(of=('self',)),
                pk=pk,
            )
            if attempt.is_completed:
                # BH-4: 409 Conflict — the resource is already in the completed
                # state; this is not a client input error (400).
                return Response(
                    {'error': 'Attempt already completed'},
                    status=status.HTTP_409_CONFLICT,
                )

            # Fix START-2: before marking this attempt complete, supersede any
            # previous completed attempt for the same (user, survey) pair.
            #
            # Why: migration 0019 added a partial UniqueConstraint
            # (user, survey WHERE is_completed=True).  Migration 0021 drops it,
            # but until that migration runs on Render the constraint is still
            # live in Postgres and the save() below would raise IntegrityError
            # → HTTP 500 whenever a user retries a survey they already finished.
            #
            # Superseding (is_completed=False on old rows) inside the same
            # transaction means the constraint is never violated even on
            # unpatched databases.  After migration 0021 is applied this block
            # becomes a no-op that updates 0 rows — safe to leave in place.
            if attempt.survey_id:
                QuestionnaireAttempt.objects.filter(
                    user=request.user,
                    survey_id=attempt.survey_id,
                    is_completed=True,
                ).exclude(pk=attempt.pk).update(is_completed=False)

            # Fix #29: combine completion + score fields into a single DB write.
            # calculate_scores(save=False) sets all score attrs on the instance
            # without touching the DB; we then save everything at once.
            attempt.is_completed = True
            attempt.completed_at = timezone.now()
            scores = attempt.calculate_scores(save=False)
            attempt.save(update_fields=[
                'is_completed', 'completed_at',
                'environmental_score', 'social_score', 'governance_score',
                'total_score', 'overall_grade',
            ])
        # Fix #43: reload the attempt through _base_queryset() so all prefetch
        # caches are populated before serialization (avoids N+1 on the response).
        attempt = self._base_queryset().get(pk=attempt.pk)
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

    @action(detail=False, methods=['get'])
    def combined_report(self, request):
        """
        Single endpoint for the consolidated GRI report page.

        Returns the latest completed attempt for each GRI phase (1-4)
        in ONE query + serialisation pass — replacing 4 sequential frontend
        fetches and reducing page load time significantly.

        Response:
        {
          "phases": [
            {"phase": 1, "label": "GRI 1", "attempt": <serialized | null>},
            ...
          ],
          "combined_score":   72,   // simple average of completed phase scores
          "combined_grade":   "B",
          "phases_completed": 3,
          "report_date":      "2026-06-09"
        }
        """
        PHASE_MATCHERS = [
            (1, 'GRI 1:'),
            (2, 'GRI 2:'),
            (3, 'GRI 3:'),
            (4, 'GRI Sector:'),
        ]

        # One DB round-trip for all completed attempts (prefetches answers, survey, etc.)
        all_completed = list(
            self._base_queryset()
            .filter(user=request.user, is_completed=True)
            .order_by('-completed_at')
        )

        phases_data = []
        for phase_num, matcher in PHASE_MATCHERS:
            # Find the most recent completed attempt for this phase (Python filter)
            latest = next(
                (a for a in all_completed
                 if a.survey and (a.survey.name or '').startswith(matcher)),
                None,
            )
            if latest:
                ser = QuestionnaireAttemptSerializer(latest, context={'request': request})
                phases_data.append({
                    'phase':   phase_num,
                    'label':   matcher.rstrip(':'),
                    'attempt': ser.data,
                })
            else:
                phases_data.append({
                    'phase':   phase_num,
                    'label':   matcher.rstrip(':'),
                    'attempt': None,
                })

        # Combined score — weighted average by total_questions (already serialised above)
        scored_phases = [
            p for p in phases_data
            if p['attempt'] and p['attempt'].get('total_score') is not None
        ]
        if scored_phases:
            weights      = [p['attempt'].get('total_questions') or 1 for p in scored_phases]
            total_weight = sum(weights)
            combined_score = round(
                sum(
                    (p['attempt']['total_score'] or 0) * w
                    for p, w in zip(scored_phases, weights)
                ) / total_weight
            )
        else:
            combined_score = 0

        def _grade(s: int) -> str:
            if s >= 80: return 'A'
            if s >= 65: return 'B'
            if s >= 50: return 'C'
            if s >= 35: return 'D'
            return 'F'

        return Response({
            'phases':           phases_data,
            'combined_score':   combined_score,
            'combined_grade':   _grade(combined_score),
            'phases_completed': len(scored_phases),
            'report_date':      timezone.now().date().isoformat(),
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
        # Fix R4-L-02: removed redundant .filter(user=request.user) — get_queryset()
        # already scopes results to request.user for non-staff users (see get_queryset).
        # The extra filter was harmless but misleading and created unnecessary SQL.
        attempts = self.get_queryset()
        serializer = self.get_serializer(attempts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='bookmarks')
    def update_bookmarks(self, request, pk=None):
        """
        PATCH /api/v1/attempts/{pk}/bookmarks/
        Body: { "bookmarked_questions": [1, 5, 23] }

        Saves the list of question IDs the user has flagged for review during
        this attempt.  Replaces the whole list on each call (idempotent).
        Only the attempt owner (or staff) may call this.
        """
        attempt = get_object_or_404(
            QuestionnaireAttempt.objects.filter(user=request.user),
            pk=pk,
        )
        bookmarked = request.data.get('bookmarked_questions', [])
        if not isinstance(bookmarked, list):
            return Response(
                {'detail': 'bookmarked_questions must be a list of integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            bookmarked = [int(q) for q in bookmarked]
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Each entry in bookmarked_questions must be an integer question ID.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        attempt.bookmarked_questions = bookmarked
        attempt.save(update_fields=['bookmarked_questions'])
        return Response({'bookmarked_questions': attempt.bookmarked_questions})

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def admin_analytics(self, request):
        """
        Admin-only analytics endpoint.
        Returns aggregate stats across ALL users:
          - total_users, total_attempts, completed, in_progress
          - average_score (completed only)
          - attempts_per_survey  — list: {survey_name, count, avg_score, avg_grade}
          - score_distribution   — histogram buckets: {range, count}
          - grade_breakdown      — {A+:N, A:N, ...}
          - recent_completions   — last 10 completed attempts (user, survey, score, grade, date)
          - daily_completions    — last 30 days: {date, count}
        """
        from django.db.models import Count, Avg, Max, Min
        from django.db.models.functions import TruncDate
        from django.utils import timezone as tz
        import datetime

        all_attempts = QuestionnaireAttempt.objects.select_related('user', 'survey')
        completed    = all_attempts.filter(is_completed=True)
        in_progress  = all_attempts.filter(is_completed=False)

        total_users   = all_attempts.values('user').distinct().count()
        total         = all_attempts.count()
        n_completed   = completed.count()
        n_in_progress = in_progress.count()

        avg_score_val = completed.aggregate(avg=Avg('total_score'))['avg']
        avg_score     = round(float(avg_score_val), 1) if avg_score_val else 0

        # Per-survey stats
        survey_stats = (
            completed
            .values('survey__name')
            .annotate(count=Count('id'), avg_score=Avg('total_score'))
            .order_by('-count')
        )
        attempts_per_survey = [
            {
                'survey_name': r['survey__name'] or 'Unknown',
                'count':       r['count'],
                'avg_score':   round(float(r['avg_score'] or 0), 1),
            }
            for r in survey_stats
        ]

        # Score distribution — 10-point buckets
        score_dist = []
        for lo in range(0, 100, 10):
            hi = lo + 10
            label = f'{lo}–{hi}'
            cnt   = completed.filter(total_score__gte=lo, total_score__lt=(hi if hi < 100 else 101)).count()
            score_dist.append({'range': label, 'count': cnt})

        # Grade breakdown
        grade_counts = (
            completed
            .values('overall_grade')
            .annotate(count=Count('id'))
            .order_by('overall_grade')
        )
        grade_breakdown = {r['overall_grade']: r['count'] for r in grade_counts}

        # Recent 10 completions
        recent = (
            completed
            .order_by('-completed_at')[:10]
        )
        recent_completions = [
            {
                'id':          a.pk,
                'user':        a.user.username if a.user else '—',
                'survey':      a.survey.name if a.survey else '—',
                'score':       round(a.total_score or 0),
                'grade':       a.overall_grade or '—',
                'completed_at': a.completed_at.date().isoformat() if a.completed_at else None,
            }
            for a in recent
        ]

        # Daily completions for the last 30 days
        thirty_days_ago = tz.now() - datetime.timedelta(days=30)
        daily = (
            completed
            .filter(completed_at__gte=thirty_days_ago)
            .annotate(day=TruncDate('completed_at'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )
        daily_completions = [
            {'date': str(r['day']), 'count': r['count']}
            for r in daily
        ]

        return Response({
            'total_users':         total_users,
            'total_attempts':      total,
            'completed':           n_completed,
            'in_progress':         n_in_progress,
            'average_score':       avg_score,
            'attempts_per_survey': attempts_per_survey,
            'score_distribution':  score_dist,
            'grade_breakdown':     grade_breakdown,
            'recent_completions':  recent_completions,
            'daily_completions':   daily_completions,
        })


class AnswerViewSet(viewsets.ModelViewSet):
    # Fix BUG-28: .none() prevents accidental full exposure during schema
    # generation or router introspection — same pattern as QuestionnaireAttemptViewSet.
    queryset = Answer.objects.none()
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
        # Fix M-07: read the attempt from validated_data (already a model instance
        # after serializer.is_valid()) rather than raw request.data, which would
        # crash with ValueError if the value is a non-integer string like "abc".
        attempt = serializer.validated_data.get('attempt')
        if not attempt:
            raise DRFValidationError({'attempt': 'This field is required.'})

        # Fix R9-01: compare by user_id (FK integer) instead of attempt.user to
        # avoid a lazy-load DB query.  attempt comes from PrimaryKeyRelatedField
        # (QuestionnaireAttempt.objects.all() without select_related), so
        # attempt.user would issue an extra SELECT per answer submission.
        if attempt.user_id != self.request.user.id:
            raise PermissionDenied("Cannot answer for another user's attempt.")

        if attempt.is_completed:
            raise DRFValidationError({'detail': 'Cannot modify a completed attempt.'})

        # Fix R6-08: derive question_id from validated_data instead of raw
        # request.data so we bypass the serializer's own validation (the
        # 'question' field is a PrimaryKeyRelatedField → already resolved to an
        # instance; using request.data would skip validation and could crash with
        # a non-integer string or a PK that belongs to a different user).
        question_obj = serializer.validated_data.get('question')
        question_id = question_obj.id if question_obj is not None else None

        # Fix CRITICAL: wrap in transaction.atomic + select_for_update to eliminate
        # the TOCTOU race where two concurrent requests for the same (attempt, question)
        # could both pass the .first() check and create duplicate Answer rows.
        with transaction.atomic():
            existing = (
                Answer.objects
                .select_for_update()
                .filter(attempt=attempt, question_id=question_id)
                .first()
            )

            if existing:
                # Fix #27: use validated serializer data — not raw request.data —
                # so the update path goes through the same validation as create.
                # choice is a PK-related field → resolved to a model instance.
                # choices_ids is ListField(IntegerField) → already a list of ints.
                not_applicable = serializer.validated_data.get('not_applicable', False)
                _choice_obj  = serializer.validated_data.get('choice')
                choice       = _choice_obj.id if _choice_obj else None
                text_answer  = serializer.validated_data.get('text_answer', '')
                notes        = serializer.validated_data.get('notes', '')
                choices_ids  = serializer.validated_data.get('choices_ids', [])

                # When N/A is toggled on, choices are already cleared by the serializer
                # validator; apply the same rule here for safety.
                if not_applicable:
                    choice = None
                    choices_ids = []

                # Fix BUG-04: validate choice belongs to this question before assigning
                if choice is not None:
                    if not Choice.objects.filter(id=choice, question=existing.question).exists():
                        raise DRFValidationError({'choice': 'Choice does not belong to this question.'})

                numerical_value = serializer.validated_data.get('numerical_value', None)

                existing.not_applicable = not_applicable
                existing.choice_id = choice
                existing.text_answer = text_answer
                existing.notes = notes
                existing.numerical_value = numerical_value
                # Fix R5-M-09: save only the mutated columns to avoid unnecessary
                # full-row writes and reduce the risk of concurrent-update collisions
                # on unrelated fields.
                existing.save(update_fields=['not_applicable', 'choice_id', 'text_answer', 'notes', 'numerical_value'])

                # Fix D (Round 2): always sync M2M — empty list clears stale multi-select choices.
                # Fix BUG-29: filter by question so IDs from other questions are rejected.
                existing.choices.set(
                    Choice.objects.filter(id__in=choices_ids, question=existing.question)
                    if choices_ids else []
                )

                serializer.instance = existing
                return

            try:
                serializer.save(attempt=attempt)
            except Exception as integrity_exc:
                # Handle both Django's IntegrityError and database-level IntegrityError
                from django.db import IntegrityError as DjangoIntegrityError
                import django.db
                if isinstance(integrity_exc, (DjangoIntegrityError, django.db.utils.IntegrityError)):
                    # Race condition: another request created this (attempt, question) pair simultaneously.
                    # Return the existing answer so the client can proceed.
                    existing_answer = Answer.objects.filter(
                        attempt=attempt, question_id=serializer.validated_data['question'].pk
                    ).first()
                    if existing_answer:
                        return Response(
                            AnswerSerializer(existing_answer, context={'request': request}).data,
                            status=status.HTTP_200_OK,
                        )
                raise

    def perform_update(self, serializer):
        """
        Fix BH-1: block modifications to answers belonging to completed attempts.
        The upsert logic in perform_create makes update/partial_update redundant,
        but we guard them anyway so the REST interface is consistent.
        """
        instance = serializer.instance
        if instance.attempt.is_completed:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Cannot modify answers on a completed attempt.")
        # Ownership check — ensure the attempt belongs to the requesting user
        if instance.attempt.user != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not own this answer.")
        serializer.save()


class UserDocumentViewSet(viewsets.ModelViewSet):
    # Fix HIGH: .none() prevents full data exposure during schema generation /
    # router introspection — same pattern as QuestionnaireAttemptViewSet & AnswerViewSet.
    queryset = UserDocument.objects.none()
    serializer_class = UserDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = UserDocument.objects.select_related('answer__attempt__user')   # Fix N
        if self.request.user.is_staff:
            return qs
        return qs.filter(answer__attempt__user=self.request.user)

    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        """
        Fix R5-H-03: serve the file through an authenticated endpoint instead of
        exposing raw /media/ URLs that anyone with the URL can access.
        get_object() already verifies ownership via get_queryset().
        """
        import os
        from django.http import FileResponse, Http404 as DjangoHttp404
        doc = self.get_object()
        if not doc.file:
            raise DjangoHttp404
        try:
            file_path = doc.file.path
        except (ValueError, NotImplementedError):
            # Cloud storage (e.g. S3) doesn't have a .path — return the URL directly.
            return Response({'url': doc.file.url})
        if not os.path.exists(file_path):
            raise DjangoHttp404
        # Fix R6-14: open() first and assign to a variable so that if
        # FileResponse.__init__ raises, the file descriptor is not leaked.
        # Django closes the file automatically when the streaming response ends.
        try:
            fh = open(file_path, 'rb')
        except OSError:
            raise DjangoHttp404
        return FileResponse(
            fh,
            as_attachment=True,
            filename=os.path.basename(doc.file.name),
        )

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
        # Fix UPLOAD-02: wrap the magic call in try/except to handle the case
        # where python-magic is importable but libmagic.so is not available at
        # runtime (e.g. the shared library is missing on the deploy host).
        # The original 'except ImportError' guard only caught install-time
        # failures — a runtime MagicException / OSError would bubble up as an
        # unhandled 500, causing the upload to fail with "Some documents failed
        # to upload" even for perfectly valid files like a 725 KB PDF.
        _detected_mime = None
        if _MAGIC_AVAILABLE:
            try:
                header = file.read(2048)
                file.seek(0)
                _detected_mime = _magic.from_buffer(header, mime=True)
            except Exception:
                # libmagic runtime unavailable — fall through to header check
                pass

        if _detected_mime is not None:
            if _detected_mime not in _ALLOWED_CONTENT_TYPES:
                raise DRFValidationError(
                    {'file': f'Unsupported file type detected by magic bytes: {_detected_mime}.'}
                )
        else:
            if file.content_type not in _ALLOWED_CONTENT_TYPES:
                raise DRFValidationError(
                    {'file': f'Unsupported file type: {file.content_type}.'}
                )

        # Fix BUG-01 + #34 CRITICAL: require answer, verify ownership, and pass
        # the Answer instance to serializer.save() so the non-nullable FK is set.
        # Previously serializer.save(file_size=file.size) was called without answer,
        # which caused an IntegrityError on every document upload.
        # Fix H-02: validate answer_id is an integer before passing to
        # get_object_or_404 — non-integer values caused an unhandled 500 error.
        answer_id_raw = self.request.data.get('answer')
        if not answer_id_raw:
            raise DRFValidationError({'answer': 'This field is required.'})
        try:
            answer_id = int(answer_id_raw)
        except (TypeError, ValueError):
            raise DRFValidationError({'answer': 'A valid integer is required.'})
        # Fix R7-01: IDOR — add attempt__user filter so a user can't upload a
        # document to another user's answer by guessing its integer PK.
        # get_object_or_404 returns 404 (not 403) for non-owned answers, which
        # avoids leaking the existence of other users' answer IDs.
        # Fix R9-02: get_object_or_404 already enforces attempt__user=request.user,
        # so the explicit ownership check below it was dead code AND caused 2 extra
        # DB queries per upload (lazy-load of answer_obj.attempt then .user).
        # Removed — the 404 guard is the single, correct ownership enforcement here.
        # Fix R10-01: use select_related('attempt') so the is_completed check below
        # reads from the already-fetched JOIN row instead of issuing a second query.
        answer_obj = get_object_or_404(
            Answer.objects.select_related('attempt'),
            id=answer_id,
            attempt__user=self.request.user,
        )

        # Fix R5-C-01: block uploads to completed attempts — scores are already
        # finalised at that point; allowing new documents would be misleading.
        if answer_obj.attempt.is_completed:
            raise DRFValidationError(
                {'answer': 'Cannot attach documents to a completed attempt.'}
            )

        serializer.save(file_size=file.size, answer=answer_obj)
