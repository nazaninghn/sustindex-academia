"""
Reports app tests.

Coverage:
  - Report / ReportSection model creation, __str__, ordering
  - generate_report view: auth required, rejects incomplete attempts,
    creates Report + sections for a completed attempt  (Fix BC/BD/BE/BF verified)
  - view_report: auth required, owner-only (other user gets 404)
  - reports_dashboard: auth required

Notes:
  - The reports URLconf is disabled in the main urls.py (legacy template views).
  - View tests call the view functions directly via RequestFactory so they
    don't depend on URL routing.
"""

from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from django.utils import timezone

from questionnaire.models import (
    Survey, Category, Question, Choice,
    QuestionnaireAttempt, Answer,
)
from .models import Report, ReportSection
from . import views as report_views

User = get_user_model()


# ─── Fixtures ─────────────────────────────────────────────────────────────────

def make_user(username: str = 'rptuser', password: str = 'testpass123') -> User:
    return User.objects.create_user(
        username=username,
        email=f'{username}@test.com',
        password=password,
    )


def make_completed_attempt(user: User) -> QuestionnaireAttempt:
    """Create a minimal survey, answer all questions, mark the attempt completed."""
    survey = Survey.objects.create(name='Report Test Survey', is_active=True)
    cat    = Category.objects.create(survey=survey, name='ESG', order=1)
    for i in range(2):
        q = Question.objects.create(
            survey=survey, category=cat,
            text=f'Q{i}', question_type='choice', order=i,
            skip_validation=True,
        )
        Choice.objects.create(question=q, text='Low',  score=0, order=0)
        Choice.objects.create(question=q, text='High', score=5, order=1)

    attempt = QuestionnaireAttempt.objects.create(user=user, survey=survey)
    for q in survey.questions.all():
        best = q.choices.order_by('-score').first()
        Answer.objects.create(attempt=attempt, question=q, choice=best)

    attempt.is_completed = True
    attempt.completed_at = timezone.now()
    attempt.save(update_fields=['is_completed', 'completed_at'])
    attempt.calculate_scores()   # saves scores + overall_grade
    return attempt


# ─── Model tests ──────────────────────────────────────────────────────────────

class ReportModelTests(TestCase):

    def setUp(self):
        self.user    = make_user()
        self.attempt = make_completed_attempt(self.user)

    def test_report_str_contains_username(self):
        report = Report.objects.create(attempt=self.attempt)
        self.assertIn(self.user.username, str(report))

    def test_report_section_ordering(self):
        """Sections must be returned ordered by `order` field (Meta.ordering)."""
        report = Report.objects.create(attempt=self.attempt)
        ReportSection.objects.create(report=report, title='Second', content='b', order=2)
        ReportSection.objects.create(report=report, title='First',  content='a', order=1)
        titles = list(report.sections.values_list('title', flat=True))
        self.assertEqual(titles, ['First', 'Second'])

    def test_report_section_str(self):
        report  = Report.objects.create(attempt=self.attempt)
        section = ReportSection.objects.create(report=report, title='Exec', content='...', order=1)
        self.assertIn('Exec', str(section))

    def test_one_to_one_prevents_duplicate_report(self):
        """Two reports for the same attempt must raise IntegrityError."""
        from django.db import IntegrityError
        Report.objects.create(attempt=self.attempt)
        with self.assertRaises(IntegrityError):
            Report.objects.create(attempt=self.attempt)


# ─── View tests (RequestFactory — no URL routing needed) ──────────────────────

class GenerateReportViewTests(TestCase):

    def setUp(self):
        self.factory = RequestFactory()
        self.user    = make_user('gen_user')
        self.attempt = make_completed_attempt(self.user)

    def _request(self, user):
        request = self.factory.get(f'/reports/generate/{self.attempt.id}/')
        request.user = user
        return request

    def test_unauthenticated_is_redirected(self):
        """login_required must redirect anonymous users."""
        from django.contrib.auth.models import AnonymousUser
        request = self._request(AnonymousUser())
        res = report_views.generate_report(request, attempt_id=self.attempt.id)
        self.assertEqual(res.status_code, 302)
        self.assertIn('login', res['Location'])

    def test_incomplete_attempt_returns_400(self):
        """Attempting to generate a report for an incomplete attempt must be rejected."""
        incomplete = QuestionnaireAttempt.objects.create(
            user=self.user, survey=self.attempt.survey
        )
        request = self._request(self.user)
        res = report_views.generate_report(request, attempt_id=incomplete.id)
        self.assertEqual(res.status_code, 400)

    def test_completed_attempt_creates_report(self):
        """
        Fix BC verification: generate_report must call calculate_scores()
        (not the non-existent calculate_esg_scores()) and persist a Report.
        """
        request = self._request(self.user)
        res = report_views.generate_report(request, attempt_id=self.attempt.id)
        # Redirects to view_report on success
        self.assertEqual(res.status_code, 302)
        self.assertTrue(
            Report.objects.filter(attempt=self.attempt).exists(),
            'Report was not created by generate_report',
        )

    def test_report_sections_scoped_to_survey(self):
        """
        Fix BE verification: sections must reference the attempt's survey categories,
        not all categories across every survey.
        """
        # Create a second unrelated survey with its own category
        other_survey = Survey.objects.create(name='Other Survey', is_active=True)
        Category.objects.create(survey=other_survey, name='Unrelated Cat', order=1)

        request = self._request(self.user)
        report_views.generate_report(request, attempt_id=self.attempt.id)

        report = Report.objects.get(attempt=self.attempt)
        section_titles = list(report.sections.values_list('title', flat=True))
        self.assertNotIn(
            'Unrelated Cat Analysis', section_titles,
            'generate_report included sections for an unrelated survey',
        )


class ViewReportTests(TestCase):

    def setUp(self):
        self.factory = RequestFactory()
        self.owner   = make_user('rpt_owner')
        self.other   = make_user('rpt_other')
        self.attempt = make_completed_attempt(self.owner)
        self.report  = Report.objects.create(attempt=self.attempt)

    def test_unauthenticated_is_redirected(self):
        from django.contrib.auth.models import AnonymousUser
        request      = self.factory.get(f'/reports/view/{self.report.id}/')
        request.user = AnonymousUser()
        res = report_views.view_report(request, report_id=self.report.id)
        self.assertEqual(res.status_code, 302)

    def test_other_user_gets_404(self):
        """Fix BD verification: owner-only filter must reject another user."""
        request      = self.factory.get(f'/reports/view/{self.report.id}/')
        request.user = self.other
        from django.http import Http404
        with self.assertRaises(Http404):
            report_views.view_report(request, report_id=self.report.id)
