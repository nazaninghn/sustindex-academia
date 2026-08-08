from django import template
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.utils import timezone
from datetime import timedelta

from questionnaire.models import Survey, QuestionnaireAttempt

register = template.Library()


@register.inclusion_tag('admin/dashboard_stats.html')
def dashboard_stats():
    """Real usage stats for the admin index page — no fabricated numbers.

    Kept as a template tag (not an AdminSite subclass or a monkey-patched
    view) so the query logic stays isolated and easy to call directly from
    a shell/test without going through the admin view stack.
    """
    User = get_user_model()
    now = timezone.now()
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    active_surveys = Survey.objects.filter(is_active=True).count()

    # defer(): this dashboard never renders bookmarked_questions, so there's
    # no reason to pull a JSON field across the wire for every attempt.
    attempts = QuestionnaireAttempt.objects.all().defer('bookmarked_questions')
    total_attempts = attempts.count()
    completed_attempts = attempts.filter(is_completed=True).count()
    completion_rate = round((completed_attempts / total_attempts) * 100) if total_attempts else 0

    total_users = User.objects.count()

    attempts_this_week = attempts.filter(started_at__gte=week_ago).count()
    attempts_prior_week = attempts.filter(started_at__gte=two_weeks_ago, started_at__lt=week_ago).count()
    if attempts_prior_week:
        week_trend = round(((attempts_this_week - attempts_prior_week) / attempts_prior_week) * 100)
    else:
        week_trend = 100 if attempts_this_week else 0

    recent_attempts = list(
        attempts.select_related('user', 'survey').order_by('-started_at')[:5]
    )

    top_surveys = list(
        Survey.objects.annotate(attempt_count=Count('attempts'))
        .filter(attempt_count__gt=0)
        .order_by('-attempt_count')[:4]
    )
    max_survey_attempts = top_surveys[0].attempt_count if top_surveys else 0
    for survey in top_surveys:
        survey.share_percent = (
            round((survey.attempt_count / max_survey_attempts) * 100) if max_survey_attempts else 0
        )

    return {
        'active_surveys': active_surveys,
        'total_attempts': total_attempts,
        'completed_attempts': completed_attempts,
        'completion_rate': completion_rate,
        'total_users': total_users,
        'attempts_this_week': attempts_this_week,
        'week_trend': week_trend,
        'recent_attempts': recent_attempts,
        'top_surveys': top_surveys,
    }
