from django import template
from django.urls import NoReverseMatch, reverse
from django.utils.translation import gettext_lazy as _

from adminpanel.api_views import build_overview, parse_range
from questionnaire.models import QuestionnaireAttempt, Survey

register = template.Library()

RANGES = [(30, _('30 days')), (90, _('90 days')), (365, _('12 months')), (0, _('All time'))]


def _url(name):
    try:
        return reverse(name)
    except NoReverseMatch:
        return ''


def _share(part, whole):
    return round(part / whole * 100) if whole else 0


@register.inclusion_tag('admin/dashboard_stats.html', takes_context=True)
def dashboard_stats(context):
    """Real usage numbers for the admin index page — no fabricated figures.

    Kept as a template tag (not an AdminSite subclass or a monkey-patched
    view) so the query logic stays isolated.  The aggregation itself lives in
    adminpanel.build_overview and is shared with the JSON API.
    """
    request = context.get('request')
    days = parse_range(request.GET.get('days', 30)) if request else 30
    data = build_overview(days)
    k = data['kpis']

    completed_total = sum(g['count'] for g in data['grades'])
    funnel_top = data['funnel'][0]['count'] if data['funnel'] else 0
    funnel_labels = {
        'registered': _('Registered'), 'started': _('Started an assessment'),
        'completed': _('Completed one'), 'action_plan': _('Created action tasks'),
    }
    sector_max = max([s['count'] for s in data['sectors']] or [1])
    member_total = sum(m['count'] for m in data['memberships'])

    attempts_url = _url('admin:questionnaire_questionnaireattempt_changelist')
    users_url = _url('admin:accounts_user_changelist')

    return {
        'days': days,
        'ranges': [{'days': d, 'label': label, 'active': d == days} for d, label in RANGES],
        'period_label': dict(RANGES)[days],
        'k': k,
        'stalled_after_days': data['stalled_after_days'],
        'active_surveys': Survey.objects.filter(is_active=True).count(),
        'completed_total': completed_total,
        'funnel': [
            {'label': funnel_labels[f['key']], 'count': f['count'], 'pct': _share(f['count'], funnel_top)}
            for f in data['funnel']
        ],
        'sectors': [dict(s, pct=_share(s['count'], sector_max)) for s in data['sectors']],
        'memberships': [dict(m, pct=_share(m['count'], member_total)) for m in data['memberships']],
        'pillars': [
            {'label': _('Environmental'), 'value': data['esg']['environmental']},
            {'label': _('Social'), 'value': data['esg']['social']},
            {'label': _('Governance'), 'value': data['esg']['governance']},
        ],
        'top_surveys': data['surveys'][:5],
        # defer(): the dashboard never renders bookmarked_questions.
        'recent_attempts': list(
            QuestionnaireAttempt.objects.defer('bookmarked_questions')
            .select_related('user', 'survey').order_by('-started_at')[:6]
        ),
        'chart_data': {
            'series': data['series'],
            'scores': data['score_distribution'],
            'grades': data['grades'],
            'calendar': data['calendar'],
        },
        'urls': {
            'attempts': attempts_url,
            'open_attempts': f'{attempts_url}?is_completed__exact=0' if attempts_url else '',
            'users': users_url,
            'inactive_users': f'{users_url}?is_active__exact=0' if users_url else '',
            'surveys': _url('admin:questionnaire_survey_changelist'),
        },
        'user': context.get('user'),
    }
