"""
Staff-only API for the admin console.

Every view here requires ``is_staff`` (DRF ``IsAdminUser``).  The endpoints are
read-mostly: they aggregate what already exists in accounts / questionnaire /
elearning.  The few writes are deliberately narrow (membership tier, account
active flag, survey / course visibility) — anything deeper stays in the Django
admin, which keeps its own audit history.
"""
import csv
import datetime

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Avg, Count, F, Max, OuterRef, Q, Subquery
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import MembershipHistory
from elearning.models import Course, Lesson, LessonProgress
from questionnaire.models import (
    ActionTask, Answer, Category, Question, QuestionnaireAttempt, Survey, UserDocument,
)

User = get_user_model()

GRADE_ORDER = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D']
SECTOR_LABELS = {code: str(label) for code, label in Question.SECTOR_CHOICES if code}
MEMBERSHIP_TYPES = [code for code, _label in User.MEMBERSHIP_CHOICES]
# An unfinished assessment with no new answer for this long counts as stalled.
STALLED_AFTER_DAYS = 14
ALLOWED_RANGES = (30, 90, 365, 0)          # 0 = all time
PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX = 20, 100
EXPORT_ROW_LIMIT = 10000


# ── helpers ──────────────────────────────────────────────────────────────────

def _round(value, digits=1):
    return round(float(value), digits) if value is not None else None


def _pct_delta(current, previous):
    """Relative change in percent, or None when there is no baseline."""
    if not previous:
        return None
    return round((current - previous) / previous * 100, 1)


def _iso(dt):
    return dt.isoformat() if dt else None


def _display_name(user):
    full = f'{user.first_name} {user.last_name}'.strip()
    return full or user.username


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str) and value.lower() in ('true', 'false'):
        return value.lower() == 'true'
    return None


def _paginate(request, queryset, serialize):
    try:
        page = max(int(request.query_params.get('page', 1)), 1)
    except (TypeError, ValueError):
        page = 1
    try:
        size = int(request.query_params.get('page_size', PAGE_SIZE_DEFAULT))
    except (TypeError, ValueError):
        size = PAGE_SIZE_DEFAULT
    size = min(max(size, 1), PAGE_SIZE_MAX)
    total = queryset.count()
    pages = max((total + size - 1) // size, 1)
    page = min(page, pages)
    rows = queryset[(page - 1) * size: page * size]
    return Response({
        'count': total, 'page': page, 'pages': pages, 'page_size': size,
        'results': [serialize(r) for r in rows],
    })


def _csv_cell(value):
    """Neutralise spreadsheet formula injection in exported user-controlled text."""
    if value is None:
        return ''
    text = str(value)
    if text and text[0] in ('=', '+', '-', '@', '\t', '\r'):
        return "'" + text
    return text


def _csv_response(filename, header, rows):
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.write('﻿')                 # BOM so Excel reads UTF-8 (Turkish characters)
    writer = csv.writer(response)
    writer.writerow(header)
    for row in rows:
        writer.writerow([_csv_cell(c) for c in row])
    return response


def _daily_counts(queryset, field, since):
    rows = (
        queryset.filter(**{f'{field}__gte': since})
        .annotate(day=TruncDate(field))
        .values('day').annotate(n=Count('id'))
    )
    return {r['day']: r['n'] for r in rows}


class StaffAPIView(APIView):
    permission_classes = [IsAdminUser]


# ── overview ─────────────────────────────────────────────────────────────────

class OverviewView(StaffAPIView):
    """
    GET /api/v1/admin/overview/?days=30|90|365|0

    Platform-wide numbers for the selected period (0 = all time).  KPI tiles
    carry the previous period of equal length so the UI can show a change.
    """

    def get(self, request):
        try:
            days = int(request.query_params.get('days', 30))
        except (TypeError, ValueError):
            days = 30
        if days not in ALLOWED_RANGES:
            days = 30

        now = timezone.now()
        today = timezone.localdate()
        start = now - datetime.timedelta(days=days) if days else None
        prev_start = now - datetime.timedelta(days=days * 2) if days else None

        users = User.objects.all()
        attempts = QuestionnaireAttempt.objects.all()
        completed = attempts.filter(is_completed=True)

        def in_period(qs, field):
            return qs.filter(**{f'{field}__gte': start}) if start else qs

        def in_previous(qs, field):
            return qs.filter(**{f'{field}__gte': prev_start, f'{field}__lt': start})

        period_completed = in_period(completed, 'completed_at')
        period_started = in_period(attempts, 'started_at')
        period_signups = in_period(users, 'date_joined')

        n_signups = period_signups.count()
        n_started = period_started.count()
        n_completed = period_completed.count()
        avg_score = period_completed.aggregate(a=Avg('total_score'))['a']
        # Of the assessments started in the period, how many are finished by now.
        n_started_done = period_started.filter(is_completed=True).count()
        completion_rate = round(n_started_done / n_started * 100, 1) if n_started else None

        prev = {}
        if days:
            p_started = in_previous(attempts, 'started_at')
            p_n_started = p_started.count()
            prev = {
                'signups': in_previous(users, 'date_joined').count(),
                'completed': in_previous(completed, 'completed_at').count(),
                'avg_score': in_previous(completed, 'completed_at').aggregate(a=Avg('total_score'))['a'],
                'completion_rate': (
                    round(p_started.filter(is_completed=True).count() / p_n_started * 100, 1)
                    if p_n_started else None
                ),
            }

        stalled_cutoff = now - datetime.timedelta(days=STALLED_AFTER_DAYS)
        open_attempts = attempts.filter(is_completed=False).annotate(last_answer=Max('answers__answered_at'))
        stalled = open_attempts.filter(
            Q(last_answer__lt=stalled_cutoff) | Q(last_answer__isnull=True, started_at__lt=stalled_cutoff)
        ).count()

        kpis = {
            'total_users': users.count(),
            'signups': {'value': n_signups, 'previous': prev.get('signups'),
                        'delta_pct': _pct_delta(n_signups, prev.get('signups'))},
            'completed': {'value': n_completed, 'previous': prev.get('completed'),
                          'delta_pct': _pct_delta(n_completed, prev.get('completed'))},
            'avg_score': {'value': _round(avg_score), 'previous': _round(prev.get('avg_score')),
                          'delta_pts': (_round(avg_score - prev['avg_score'])
                                        if avg_score is not None and prev.get('avg_score') is not None else None)},
            'completion_rate': {'value': completion_rate, 'previous': prev.get('completion_rate'),
                                'delta_pts': (round(completion_rate - prev['completion_rate'], 1)
                                              if completion_rate is not None and prev.get('completion_rate') is not None
                                              else None)},
            'in_progress': attempts.filter(is_completed=False).count(),
            'stalled': stalled,
            'open_tasks': ActionTask.objects.filter(
                status__in=[ActionTask.STATUS_TODO, ActionTask.STATUS_IN_PROGRESS]).count(),
            'documents': UserDocument.objects.count(),
            'inactive_accounts': users.filter(is_active=False).count(),
        }

        # Daily series — zero-filled so the chart has one point per day.
        if days:
            series_days = days
        else:
            first = users.order_by('date_joined').values_list('date_joined', flat=True).first()
            series_days = min(max((now - first).days + 1, 30), 730) if first else 30
        series_start = today - datetime.timedelta(days=series_days - 1)
        series_since = timezone.make_aware(datetime.datetime.combine(series_start, datetime.time.min))
        d_signups = _daily_counts(users, 'date_joined', series_since)
        d_started = _daily_counts(attempts, 'started_at', series_since)
        d_completed = _daily_counts(completed, 'completed_at', series_since)
        series = []
        for i in range(series_days):
            day = series_start + datetime.timedelta(days=i)
            series.append({
                'date': day.isoformat(),
                'signups': d_signups.get(day, 0),
                'started': d_started.get(day, 0),
                'completed': d_completed.get(day, 0),
            })

        # Activity calendar: answers saved per day over the last 26 weeks.
        cal_start = today - datetime.timedelta(days=26 * 7 - 1)
        cal_since = timezone.make_aware(datetime.datetime.combine(cal_start, datetime.time.min))
        d_answers = _daily_counts(Answer.objects.all(), 'answered_at', cal_since)
        calendar = [
            {'date': (cal_start + datetime.timedelta(days=i)).isoformat(),
             'count': d_answers.get(cal_start + datetime.timedelta(days=i), 0)}
            for i in range(26 * 7)
        ]

        esg = period_completed.aggregate(
            e=Avg('environmental_score'), s=Avg('social_score'), g=Avg('governance_score'))

        grade_counts = dict(
            period_completed.values_list('overall_grade').annotate(n=Count('id')).values_list('overall_grade', 'n'))
        grades = [{'grade': g, 'count': grade_counts.get(g, 0)} for g in GRADE_ORDER]

        score_distribution = []
        for lo in range(0, 100, 10):
            hi = lo + 10
            q = period_completed.filter(total_score__gte=lo)
            q = q.filter(total_score__lt=hi) if hi < 100 else q
            score_distribution.append({'from': lo, 'to': hi, 'count': q.count()})

        sectors = [
            {'sector': r['selected_sector'],
             'label': SECTOR_LABELS.get(r['selected_sector'], r['selected_sector']),
             'count': r['n'], 'avg_score': _round(r['avg'])}
            for r in period_completed.exclude(selected_sector='')
            .values('selected_sector').annotate(n=Count('id'), avg=Avg('total_score')).order_by('-n')
        ]

        membership_counts = dict(
            users.values_list('membership_type').annotate(n=Count('id')).values_list('membership_type', 'n'))
        memberships = [{'type': m, 'count': membership_counts.get(m, 0)} for m in MEMBERSHIP_TYPES]

        # Funnel over the accounts registered in the period.
        funnel_users = period_signups
        funnel = [
            {'key': 'registered', 'count': n_signups},
            {'key': 'started', 'count': funnel_users.filter(attempts__isnull=False).distinct().count()},
            {'key': 'completed', 'count': funnel_users.filter(attempts__is_completed=True).distinct().count()},
            {'key': 'action_plan', 'count': funnel_users.filter(action_tasks__isnull=False).distinct().count()},
        ]

        surveys = [
            {'id': r['survey_id'], 'name': r['survey__name'] or '—', 'completed': r['n'],
             'avg_score': _round(r['avg'])}
            for r in period_completed.values('survey_id', 'survey__name')
            .annotate(n=Count('id'), avg=Avg('total_score')).order_by('-n')[:8]
        ]

        recent = []
        for a in completed.select_related('user', 'survey').order_by('-completed_at')[:8]:
            recent.append({
                'type': 'completed', 'at': _iso(a.completed_at), 'user_id': a.user_id,
                'user': _display_name(a.user), 'company': a.user.company_name,
                'survey': a.survey.name if a.survey else '—',
                'score': a.total_score, 'grade': a.overall_grade,
            })
        for u in users.order_by('-date_joined')[:8]:
            recent.append({
                'type': 'signup', 'at': _iso(u.date_joined), 'user_id': u.pk,
                'user': _display_name(u), 'company': u.company_name,
            })
        recent.sort(key=lambda r: r['at'] or '', reverse=True)

        return Response({
            'range_days': days,
            'generated_at': _iso(now),
            'stalled_after_days': STALLED_AFTER_DAYS,
            'kpis': kpis,
            'series': series,
            'calendar': calendar,
            'esg': {'environmental': _round(esg['e']), 'social': _round(esg['s']), 'governance': _round(esg['g'])},
            'grades': grades,
            'score_distribution': score_distribution,
            'sectors': sectors,
            'memberships': memberships,
            'funnel': funnel,
            'surveys': surveys,
            'recent': recent[:10],
        })


# ── users ────────────────────────────────────────────────────────────────────

USER_ORDERINGS = {
    'joined': 'date_joined', 'last_login': 'last_login', 'username': 'username',
    'company': 'company_name', 'attempts': 'attempts_count', 'score': 'last_score',
}


def _user_queryset(request):
    qs = _annotated_users()
    p = request.query_params
    search = (p.get('search') or '').strip()
    if search:
        qs = qs.filter(
            Q(username__icontains=search) | Q(email__icontains=search) | Q(company_name__icontains=search)
            | Q(first_name__icontains=search) | Q(last_name__icontains=search)
        )
    if p.get('membership') in MEMBERSHIP_TYPES:
        qs = qs.filter(membership_type=p['membership'])
    state = p.get('status')
    if state == 'active':
        qs = qs.filter(is_active=True)
    elif state == 'inactive':
        qs = qs.filter(is_active=False)
    elif state == 'staff':
        qs = qs.filter(is_staff=True)
    elif state == 'no_assessment':
        qs = qs.filter(attempts_count=0)

    ordering = p.get('ordering') or '-joined'
    desc = ordering.startswith('-')
    field = USER_ORDERINGS.get(ordering.lstrip('-'), 'date_joined')
    expr = F(field).desc(nulls_last=True) if desc else F(field).asc(nulls_last=True)
    return qs.order_by(expr, '-pk')


def _user_row(u):
    return {
        'id': u.pk, 'username': u.username, 'email': u.email, 'name': _display_name(u),
        'company_name': u.company_name, 'membership_type': u.membership_type,
        'is_active': u.is_active, 'is_staff': u.is_staff, 'is_superuser': u.is_superuser,
        'date_joined': _iso(u.date_joined), 'last_login': _iso(u.last_login),
        'attempts_count': u.attempts_count, 'completed_count': u.completed_count,
        'last_score': u.last_score, 'last_grade': u.last_grade or None,
    }


class UserListView(StaffAPIView):
    """GET /api/v1/admin/users/?search=&membership=&status=&ordering=&page="""

    def get(self, request):
        return _paginate(request, _user_queryset(request), _user_row)


class UserExportView(StaffAPIView):
    """GET /api/v1/admin/users/export/ — CSV of the current filter."""

    def get(self, request):
        rows = (
            [u.pk, u.username, u.email, _display_name(u), u.company_name, u.membership_type,
             'yes' if u.is_active else 'no', 'yes' if u.is_staff else 'no',
             u.date_joined.date().isoformat(), u.last_login.date().isoformat() if u.last_login else '',
             u.attempts_count, u.completed_count,
             u.last_score if u.last_score is not None else '', u.last_grade or '']
            for u in _user_queryset(request)[:EXPORT_ROW_LIMIT]
        )
        return _csv_response(
            f'sustindex-users-{timezone.localdate().isoformat()}.csv',
            ['id', 'username', 'email', 'name', 'company', 'membership', 'active', 'staff',
             'joined', 'last_login', 'assessments', 'completed', 'latest_score', 'latest_grade'],
            rows,
        )


class UserDetailView(StaffAPIView):
    """
    GET   /api/v1/admin/users/{id}/ — profile, assessments, activity counts.
    PATCH /api/v1/admin/users/{id}/ — {membership_type?, is_active?}
    """

    def _payload(self, pk):
        user = get_object_or_404(_annotated_users().select_related('profile'), pk=pk)
        profile = getattr(user, 'profile', None)
        attempts = (
            QuestionnaireAttempt.objects.filter(user=user).select_related('survey')
            .annotate(answers_count=Count('answers')).order_by('-started_at')[:25]
        )
        task_counts = dict(
            ActionTask.objects.filter(user=user).values_list('status').annotate(n=Count('id'))
            .values_list('status', 'n'))
        row = _user_row(user)
        row.update({
            'phone': user.phone,
            'profile': {
                'industry': profile.industry, 'employee_count': profile.employee_count,
                'website': profile.website, 'registration_number': profile.registration_number,
            } if profile else None,
            'has_google': user.google_identities.exists(),
            'documents': UserDocument.objects.filter(answer__attempt__user=user).count(),
            'lessons_completed': LessonProgress.objects.filter(user=user, is_completed=True).count(),
            'tasks': {s: task_counts.get(s, 0) for s, _l in ActionTask.STATUS_CHOICES},
            'attempts': [_attempt_row(a, with_user=False) for a in attempts],
            'membership_history': [
                {'membership_type': m.membership_type, 'start_date': _iso(m.start_date),
                 'end_date': _iso(m.end_date), 'is_active': m.is_active}
                for m in user.membership_history.all()[:10]
            ],
        })
        return row

    def get(self, request, pk):
        return Response(self._payload(pk))

    def patch(self, request, pk):
        target = get_object_or_404(User, pk=pk)
        allowed = {'membership_type', 'is_active'}
        unknown = set(request.data.keys()) - allowed
        if unknown:
            return Response({'detail': f'Unsupported field(s): {", ".join(sorted(unknown))}.'},
                            status=status.HTTP_400_BAD_REQUEST)
        # Privileged accounts are managed by superusers only.
        if (target.is_superuser or target.is_staff) and not request.user.is_superuser and target.pk != request.user.pk:
            return Response({'detail': 'Only a superuser can change a staff account.'},
                            status=status.HTTP_403_FORBIDDEN)

        update_fields = []
        new_membership = None
        if 'membership_type' in request.data:
            value = request.data['membership_type']
            if value not in MEMBERSHIP_TYPES:
                return Response({'membership_type': f'Must be one of: {", ".join(MEMBERSHIP_TYPES)}.'},
                                status=status.HTTP_400_BAD_REQUEST)
            if value != target.membership_type:
                target.membership_type = new_membership = value
                update_fields.append('membership_type')
        if 'is_active' in request.data:
            value = _parse_bool(request.data['is_active'])
            if value is None:
                return Response({'is_active': 'Must be true or false.'}, status=status.HTTP_400_BAD_REQUEST)
            if not value and target.pk == request.user.pk:
                return Response({'detail': 'You cannot deactivate your own account.'},
                                status=status.HTTP_400_BAD_REQUEST)
            if value != target.is_active:
                target.is_active = value
                update_fields.append('is_active')

        if update_fields:
            with transaction.atomic():
                target.save(update_fields=update_fields)
                if new_membership:
                    MembershipHistory.objects.filter(user=target, is_active=True).update(
                        is_active=False, end_date=timezone.now())
                    MembershipHistory.objects.create(user=target, membership_type=new_membership)
        return Response(self._payload(pk))


def _annotated_users():
    latest = QuestionnaireAttempt.objects.filter(user=OuterRef('pk'), is_completed=True).order_by('-completed_at')
    return User.objects.annotate(
        attempts_count=Count('attempts', distinct=True),
        completed_count=Count('attempts', filter=Q(attempts__is_completed=True), distinct=True),
        last_score=Subquery(latest.values('total_score')[:1]),
        last_grade=Subquery(latest.values('overall_grade')[:1]),
    )


# ── assessments ──────────────────────────────────────────────────────────────

ATTEMPT_ORDERINGS = {
    'started': 'started_at', 'completed': 'completed_at', 'score': 'total_score', 'user': 'user__username',
}


def _attempt_queryset(request):
    qs = QuestionnaireAttempt.objects.select_related('user', 'survey').annotate(
        answers_count=Count('answers'), last_answer=Max('answers__answered_at'))
    p = request.query_params
    state = p.get('status')
    if state == 'completed':
        qs = qs.filter(is_completed=True)
    elif state == 'in_progress':
        qs = qs.filter(is_completed=False)
    elif state == 'stalled':
        cutoff = timezone.now() - datetime.timedelta(days=STALLED_AFTER_DAYS)
        qs = qs.filter(is_completed=False).filter(
            Q(last_answer__lt=cutoff) | Q(last_answer__isnull=True, started_at__lt=cutoff))
    if (p.get('survey') or '').isdigit():
        qs = qs.filter(survey_id=int(p['survey']))
    if (p.get('user') or '').isdigit():
        qs = qs.filter(user_id=int(p['user']))
    if p.get('grade') in GRADE_ORDER:
        qs = qs.filter(is_completed=True, overall_grade=p['grade'])
    if p.get('sector') in SECTOR_LABELS:
        qs = qs.filter(selected_sector=p['sector'])
    search = (p.get('search') or '').strip()
    if search:
        qs = qs.filter(
            Q(user__username__icontains=search) | Q(user__email__icontains=search)
            | Q(user__company_name__icontains=search) | Q(survey__name__icontains=search)
            | Q(cycle_name__icontains=search)
        )
    ordering = p.get('ordering') or '-started'
    desc = ordering.startswith('-')
    field = ATTEMPT_ORDERINGS.get(ordering.lstrip('-'), 'started_at')
    expr = F(field).desc(nulls_last=True) if desc else F(field).asc(nulls_last=True)
    return qs.order_by(expr, '-pk')


def _attempt_row(a, with_user=True):
    row = {
        'id': a.pk,
        'survey_id': a.survey_id, 'survey': a.survey.name if a.survey else '—',
        'is_completed': a.is_completed,
        'score': a.total_score if a.is_completed else None,
        'grade': (a.overall_grade or None) if a.is_completed else None,
        'environmental': _round(a.environmental_score) if a.is_completed else None,
        'social': _round(a.social_score) if a.is_completed else None,
        'governance': _round(a.governance_score) if a.is_completed else None,
        'sector': a.selected_sector, 'sector_label': SECTOR_LABELS.get(a.selected_sector, ''),
        'cycle_name': a.cycle_name,
        'started_at': _iso(a.started_at), 'completed_at': _iso(a.completed_at),
        'answers_count': a.answers_count,
    }
    if with_user:
        row.update({
            'user_id': a.user_id, 'username': a.user.username, 'user': _display_name(a.user),
            'company_name': a.user.company_name,
            'last_answer_at': _iso(getattr(a, 'last_answer', None)),
        })
    return row


class AssessmentListView(StaffAPIView):
    """GET /api/v1/admin/assessments/?status=&survey=&grade=&sector=&user=&search=&ordering=&page="""

    def get(self, request):
        response = _paginate(request, _attempt_queryset(request), _attempt_row)
        response.data['filters'] = {
            'surveys': list(Survey.objects.order_by('name').values('id', 'name')),
            'sectors': [{'value': k, 'label': v} for k, v in SECTOR_LABELS.items()],
            'grades': GRADE_ORDER,
        }
        return response


class AssessmentExportView(StaffAPIView):
    """GET /api/v1/admin/assessments/export/ — CSV of the current filter."""

    def get(self, request):
        rows = (
            [a.pk, a.user.username, a.user.email, a.user.company_name,
             a.survey.name if a.survey else '', a.cycle_name, a.selected_sector,
             'completed' if a.is_completed else 'in_progress',
             a.total_score if a.is_completed else '', a.overall_grade if a.is_completed else '',
             _round(a.environmental_score) if a.is_completed else '',
             _round(a.social_score) if a.is_completed else '',
             _round(a.governance_score) if a.is_completed else '',
             a.answers_count, a.started_at.date().isoformat(),
             a.completed_at.date().isoformat() if a.completed_at else '']
            for a in _attempt_queryset(request)[:EXPORT_ROW_LIMIT]
        )
        return _csv_response(
            f'sustindex-assessments-{timezone.localdate().isoformat()}.csv',
            ['id', 'username', 'email', 'company', 'survey', 'cycle', 'sector', 'status', 'score', 'grade',
             'environmental', 'social', 'governance', 'answers', 'started', 'completed'],
            rows,
        )


# ── content (surveys + courses) ──────────────────────────────────────────────

class ContentView(StaffAPIView):
    """GET /api/v1/admin/content/ — surveys and courses with usage numbers."""

    def get(self, request):
        q_counts = dict(Question.objects.filter(is_active=True).values_list('survey_id')
                        .annotate(n=Count('id')).values_list('survey_id', 'n'))
        c_counts = dict(Category.objects.values_list('survey_id')
                        .annotate(n=Count('id')).values_list('survey_id', 'n'))
        a_stats = {
            r['survey_id']: r for r in QuestionnaireAttempt.objects.values('survey_id').annotate(
                total=Count('id'),
                completed=Count('id', filter=Q(is_completed=True)),
                avg=Avg('total_score', filter=Q(is_completed=True)),
                last=Max('started_at'),
            )
        }
        surveys = []
        for s in Survey.objects.order_by('name'):
            st = a_stats.get(s.pk, {})
            total, done = st.get('total', 0), st.get('completed', 0)
            surveys.append({
                'id': s.pk, 'name': s.name, 'is_active': s.is_active,
                'questions': q_counts.get(s.pk, 0), 'categories': c_counts.get(s.pk, 0),
                'attempts': total, 'completed': done,
                'completion_rate': round(done / total * 100, 1) if total else None,
                'avg_score': _round(st.get('avg')),
                'last_activity': _iso(st.get('last')),
                'updated_at': _iso(s.updated_at),
            })

        lesson_counts = dict(Lesson.objects.values_list('course_id')
                             .annotate(n=Count('id')).values_list('course_id', 'n'))
        progress = {
            r['lesson__course_id']: r for r in LessonProgress.objects.filter(is_completed=True)
            .values('lesson__course_id').annotate(learners=Count('user', distinct=True), completions=Count('id'))
        }
        courses = []
        for c in Course.objects.all():
            lessons = lesson_counts.get(c.pk, 0)
            pr = progress.get(c.pk, {})
            learners, completions = pr.get('learners', 0), pr.get('completions', 0)
            courses.append({
                'id': c.pk, 'title': c.title, 'tag': c.tag, 'level': c.level, 'is_active': c.is_active,
                'lessons': lessons, 'learners': learners, 'lesson_completions': completions,
                # Share of lessons finished, averaged over the people who started the course.
                'avg_progress': round(completions / (learners * lessons) * 100, 1) if learners and lessons else None,
                'created_at': _iso(c.created_at),
            })

        return Response({
            'surveys': surveys,
            'courses': courses,
            'totals': {
                'surveys': len(surveys), 'active_surveys': sum(1 for s in surveys if s['is_active']),
                'questions': sum(s['questions'] for s in surveys),
                'courses': len(courses), 'active_courses': sum(1 for c in courses if c['is_active']),
                'lessons': sum(c['lessons'] for c in courses),
            },
        })


class _ToggleView(StaffAPIView):
    model = None

    def patch(self, request, pk):
        obj = get_object_or_404(self.model, pk=pk)
        if set(request.data.keys()) != {'is_active'}:
            return Response({'detail': 'Only is_active can be changed here.'}, status=status.HTTP_400_BAD_REQUEST)
        value = _parse_bool(request.data['is_active'])
        if value is None:
            return Response({'is_active': 'Must be true or false.'}, status=status.HTTP_400_BAD_REQUEST)
        if obj.is_active != value:
            obj.is_active = value
            obj.save(update_fields=['is_active'] + (['updated_at'] if hasattr(obj, 'updated_at') else []))
        return Response({'id': obj.pk, 'is_active': obj.is_active})


class SurveyToggleView(_ToggleView):
    """PATCH /api/v1/admin/surveys/{id}/ — {is_active}"""
    model = Survey


class CourseToggleView(_ToggleView):
    """PATCH /api/v1/admin/courses/{id}/ — {is_active}"""
    model = Course
