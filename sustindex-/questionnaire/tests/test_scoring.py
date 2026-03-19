from django.test import TestCase
from django.contrib.auth import get_user_model

from questionnaire.models import (
    Survey,
    Category,
    Question,
    Choice,
    QuestionnaireAttempt,
    Answer,
)

User = get_user_model()


class ScoringTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='tester',
            email='tester@example.com',
            password='12345678'
        )

        self.survey = Survey.objects.create(name='Test Survey')

        self.category = Category.objects.create(
            survey=self.survey,
            name='Technical',
            order=1
        )

    def test_single_choice_score_never_exceeds_100_percent(self):
        question = Question.objects.create(
            survey=self.survey,
            category=self.category,
            text='Single choice question',
            allow_multiple=False,
            is_active=True
        )

        Choice.objects.create(question=question, text='A', score=20, order=1)
        c2 = Choice.objects.create(question=question, text='B', score=80, order=2)

        attempt = QuestionnaireAttempt.objects.create(
            user=self.user,
            survey=self.survey
        )

        Answer.objects.create(
            attempt=attempt,
            question=question,
            choice=c2
        )

        attempt.is_completed = True
        attempt.save()
        result = attempt.calculate_scores()

        self.assertEqual(result['categories']['Technical']['score'], 80)
        self.assertEqual(result['categories']['Technical']['max_score'], 80)
        self.assertEqual(result['categories']['Technical']['percentage'], 100)

    def test_multi_select_uses_sum_of_positive_scores_as_max(self):
        question = Question.objects.create(
            survey=self.survey,
            category=self.category,
            text='Multi choice question',
            allow_multiple=True,
            is_active=True
        )

        a = Choice.objects.create(question=question, text='A', score=30, order=1)
        b = Choice.objects.create(question=question, text='B', score=30, order=2)
        c = Choice.objects.create(question=question, text='C', score=40, order=3)

        attempt = QuestionnaireAttempt.objects.create(
            user=self.user,
            survey=self.survey
        )

        answer = Answer.objects.create(
            attempt=attempt,
            question=question
        )
        answer.choices.set([a, b, c])

        attempt.is_completed = True
        attempt.save()
        result = attempt.calculate_scores()

        self.assertEqual(result['categories']['Technical']['score'], 100)
        self.assertEqual(result['categories']['Technical']['max_score'], 100)
        self.assertEqual(result['categories']['Technical']['percentage'], 100)

    def test_dynamic_categories_are_returned_per_survey(self):
        second_category = Category.objects.create(
            survey=self.survey,
            name='Occupational Safety',
            order=2
        )

        q1 = Question.objects.create(
            survey=self.survey,
            category=self.category,
            text='Q1',
            allow_multiple=False,
            is_active=True
        )
        q2 = Question.objects.create(
            survey=self.survey,
            category=second_category,
            text='Q2',
            allow_multiple=False,
            is_active=True
        )

        c1 = Choice.objects.create(question=q1, text='Yes', score=100, order=1)
        c2 = Choice.objects.create(question=q2, text='Yes', score=100, order=1)

        attempt = QuestionnaireAttempt.objects.create(
            user=self.user,
            survey=self.survey
        )

        Answer.objects.create(attempt=attempt, question=q1, choice=c1)
        Answer.objects.create(attempt=attempt, question=q2, choice=c2)

        attempt.is_completed = True
        attempt.save()
        result = attempt.calculate_scores()

        self.assertIn('Technical', result['categories'])
        self.assertIn('Occupational Safety', result['categories'])
        self.assertEqual(result['total_percentage'], 100)

    def test_multi_select_partial_selection(self):
        """Selecting 2 of 3 choices should give correct percentage."""
        question = Question.objects.create(
            survey=self.survey,
            category=self.category,
            text='Partial multi',
            allow_multiple=True,
            is_active=True
        )

        a = Choice.objects.create(question=question, text='A', score=30, order=1)
        b = Choice.objects.create(question=question, text='B', score=30, order=2)
        Choice.objects.create(question=question, text='C', score=40, order=3)

        attempt = QuestionnaireAttempt.objects.create(
            user=self.user,
            survey=self.survey
        )

        answer = Answer.objects.create(attempt=attempt, question=question)
        answer.choices.set([a, b])  # 60 out of 100

        attempt.is_completed = True
        attempt.save()
        result = attempt.calculate_scores()

        self.assertEqual(result['categories']['Technical']['score'], 60)
        self.assertEqual(result['categories']['Technical']['max_score'], 100)
        self.assertEqual(result['categories']['Technical']['percentage'], 60)

    def test_text_only_question_has_zero_max(self):
        """Text-only questions contribute 0 to max score."""
        question = Question.objects.create(
            survey=self.survey,
            category=self.category,
            text='Describe your approach',
            question_type='text',
            allow_multiple=False,
            is_active=True
        )

        attempt = QuestionnaireAttempt.objects.create(
            user=self.user,
            survey=self.survey
        )

        Answer.objects.create(
            attempt=attempt,
            question=question,
            text_answer='My detailed answer'
        )

        attempt.is_completed = True
        attempt.save()
        result = attempt.calculate_scores()

        # Text-only question has no choices, so max=0, percentage=0
        self.assertEqual(result['categories']['Technical']['max_score'], 0)
        self.assertEqual(result['categories']['Technical']['percentage'], 0)
