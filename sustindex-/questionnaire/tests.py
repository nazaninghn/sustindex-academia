"""
Questionnaire app tests.

Coverage:
  - Survey listing (authenticated + unauthenticated)
  - Starting an attempt
  - Authentication guard on attempt creation
  - my_attempts scoping (users only see their own attempts)
  - Submitting a single-choice answer (verifies response includes `id`)
  - Submitting a multi-choice answer
  - Completing an attempt (score + grade calculated)
  - N+1 prevention: query count on attempts list must not scale with N attempts
"""

from django.test import TestCase                    # noqa: F401 (kept for completeness)
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APITestCase

from django.contrib.auth import get_user_model
from .models import (
    Survey, Category, Question, Choice,
    QuestionnaireAttempt, Answer,
)

User = get_user_model()


# ─── Fixtures ─────────────────────────────────────────────────────────────────

def make_user(username: str = 'testuser', password: str = 'testpass123') -> User:
    return User.objects.create_user(
        username=username,
        email=f'{username}@test.com',
        password=password,
    )


def make_survey(n_questions: int = 3, name: str = 'Test Survey') -> Survey:
    """
    Create a survey with *n_questions* questions, each with two choices
    (score 0 and score 5).
    """
    survey = Survey.objects.create(name=name, is_active=True)
    cat = Category.objects.create(survey=survey, name='Test Category', order=1)
    for i in range(n_questions):
        q = Question.objects.create(
            survey=survey,
            category=cat,
            text=f'Question {i + 1}',
            question_type='choice',
            order=i,
            skip_validation=True,   # bypass full_clean in tests
        )
        Choice.objects.create(question=q, text='Weak', score=0, order=0)
        Choice.objects.create(question=q, text='Strong', score=5, order=1)
    return survey


# ─── Survey listing ────────────────────────────────────────────────────────────

class SurveyListTests(APITestCase):

    def setUp(self):
        self.user   = make_user()
        self.survey = make_survey(2)

    def test_authenticated_user_can_list_surveys(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/v1/surveys/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Support both list response and paginated response
        data = res.data if isinstance(res.data, list) else res.data.get('results', [])
        survey_ids = [s['id'] for s in data]
        self.assertIn(self.survey.id, survey_ids)

    def test_unauthenticated_user_cannot_list_surveys(self):
        """Fix BH-6: SurveyViewSet uses IsAuthenticated; unauthenticated GET must return 401.
        The previous assertion (HTTP_200_OK) was a false-positive that would silently
        pass even if the permission was accidentally removed."""
        res = self.client.get('/api/v1/surveys/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


# ─── Attempt lifecycle ─────────────────────────────────────────────────────────

class AttemptTests(APITestCase):

    def setUp(self):
        self.user   = make_user('alice')
        self.other  = make_user('bob')
        self.survey = make_survey(3)

    def test_start_attempt_creates_record(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/v1/attempts/', {'survey': self.survey.id})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertFalse(res.data.get('is_completed'))
        self.assertEqual(
            QuestionnaireAttempt.objects.filter(user=self.user).count(), 1
        )

    def test_start_attempt_requires_authentication(self):
        """Unauthenticated POST to /attempts/ must be rejected."""
        res = self.client.post('/api/v1/attempts/', {'survey': self.survey.id})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_my_attempts_scoped_to_authenticated_user(self):
        """GET /attempts/my_attempts/ must return only the caller's attempts."""
        # Both users start an attempt for the same survey
        QuestionnaireAttempt.objects.create(user=self.user,  survey=self.survey)
        QuestionnaireAttempt.objects.create(user=self.other, survey=self.survey)

        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/v1/attempts/my_attempts/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data if isinstance(res.data, list) else res.data.get('results', [])
        own_count = QuestionnaireAttempt.objects.filter(user=self.user).count()
        self.assertEqual(len(data), own_count, 'my_attempts returned attempts from another user')

    def test_n_plus_1_queries_on_attempts_list(self):
        """
        The attempts list endpoint must not issue O(N) queries.
        We create 4 attempts with 3 answers each, then assert the query count
        stays well below the linear bound of 4 * (1 + 3) = 16.
        """
        questions = list(self.survey.questions.all())
        for _ in range(4):
            attempt = QuestionnaireAttempt.objects.create(user=self.user, survey=self.survey)
            for q in questions:
                best = q.choices.order_by('-score').first()
                Answer.objects.create(attempt=attempt, question=q, choice=best)

        self.client.force_authenticate(user=self.user)

        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get('/api/v1/attempts/my_attempts/')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        query_count = len(ctx.captured_queries)
        self.assertLessEqual(
            query_count, 12,
            f'N+1 suspected: {query_count} queries for 4 attempts. '
            f'Expected ≤ 12 with proper prefetch_related.',
        )


# ─── Answer submission ─────────────────────────────────────────────────────────

class AnswerTests(APITestCase):

    def setUp(self):
        self.user    = make_user()
        self.survey  = make_survey(2)
        self.attempt = QuestionnaireAttempt.objects.create(
            user=self.user, survey=self.survey
        )
        self.q1 = self.survey.questions.order_by('order').first()
        self.q2 = self.survey.questions.order_by('order').last()
        self.good_choice = self.q1.choices.get(text='Strong')

    def test_submit_single_choice_answer_returns_id(self):
        """POST /answers/ must return the saved answer's primary key."""
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/v1/answers/', {
            'attempt':  self.attempt.id,
            'question': self.q1.id,
            'choice':   self.good_choice.id,
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', res.data, 'Answer id missing — uploadDocument cannot work')
        self.assertIsNotNone(res.data['id'])

    def test_submit_multiple_choice_answer(self):
        """choices_ids list is accepted for allow_multiple questions."""
        self.q2.allow_multiple = True
        self.q2.save(skip_validation=True)
        choice_ids = list(self.q2.choices.values_list('id', flat=True))

        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/v1/answers/', {
            'attempt':     self.attempt.id,
            'question':    self.q2.id,
            'choices_ids': choice_ids,
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_complete_attempt_calculates_score_and_grade(self):
        """POST /attempts/{id}/complete/ must set is_completed, total_score, overall_grade."""
        # Answer all questions with the best choice
        for q in self.survey.questions.all():
            best = q.choices.order_by('-score').first()
            Answer.objects.create(attempt=self.attempt, question=q, choice=best)

        self.client.force_authenticate(user=self.user)
        res = self.client.post(f'/api/v1/attempts/{self.attempt.id}/complete/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.attempt.refresh_from_db()
        self.assertTrue(self.attempt.is_completed)
        self.assertGreater(self.attempt.total_score, 0)
        self.assertNotEqual(self.attempt.overall_grade, '')
