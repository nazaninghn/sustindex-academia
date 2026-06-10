"""
Phase A tests: gate skip logic, numerical scoring, multi-select, conditional bonus.
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model

from questionnaire.models import (
    Survey, Category, Question, Choice,
    QuestionnaireAttempt, Answer,
)

User = get_user_model()


def _make_survey():
    return Survey.objects.create(name='Test Survey')


def _make_category(survey):
    return Category.objects.create(survey=survey, name='Cat', order=0)


def _make_user(username='testuser'):
    return User.objects.create_user(username=username, password='pw')


# ─────────────────────────────────────────────────────────────────────────────
class GateSkipTest(TestCase):
    """Gate question skip logic in get_category_breakdown()."""

    def setUp(self):
        self.survey = _make_survey()
        self.cat = _make_category(self.survey)
        self.user = _make_user('gate_user')
        self.attempt = QuestionnaireAttempt.objects.create(
            user=self.user, survey=self.survey
        )

        # Gate question: binary (Yes=2, No=0)
        self.gate_q = Question.objects.create(
            survey=self.survey, category=self.cat,
            text='Gate Q', question_type='binary',
            is_gate=True, criterion_code='G1', order=1,
            skip_validation=True,
        )
        self.yes_choice = Choice.objects.create(question=self.gate_q, text='Yes', score=2, order=1)
        self.no_choice  = Choice.objects.create(question=self.gate_q, text='No',  score=0, order=2)

        # Non-gate question in same criterion
        self.non_gate_q = Question.objects.create(
            survey=self.survey, category=self.cat,
            text='Non-gate Q', question_type='single',
            is_gate=False, criterion_code='G1', order=2,
            skip_validation=True,
        )
        self.ng_choice = Choice.objects.create(question=self.non_gate_q, text='Opt A', score=4, order=1)

    def _answer(self, question, choice=None, choices=None, numerical_value=None):
        ans = Answer.objects.create(
            attempt=self.attempt,
            question=question,
            choice=choice,
        )
        if choices:
            ans.choices.set(choices)
        if numerical_value is not None:
            ans.numerical_value = numerical_value
            ans.save(update_fields=['numerical_value'])
        return ans

    def test_gate_no_skips_non_gate_questions(self):
        """Gate answered No (score 0) → non-gate questions excluded from score and max."""
        self._answer(self.gate_q, choice=self.no_choice)
        self._answer(self.non_gate_q, choice=self.ng_choice)

        bd = self.attempt.get_category_breakdown()
        cat_data = bd['categories'][0]
        # non-gate has score=4 but should be excluded → only gate contributes
        # gate score is 0 (No), non-gate excluded → total score = 0
        self.assertEqual(cat_data['score'], 0)
        # max_possible = gate max only (2), non-gate excluded
        self.assertEqual(cat_data['max_score'], self.gate_q.get_max_possible_score())

    def test_gate_yes_includes_non_gate_questions(self):
        """Gate answered Yes (score > 0) → non-gate questions score normally."""
        self._answer(self.gate_q, choice=self.yes_choice)
        self._answer(self.non_gate_q, choice=self.ng_choice)

        bd = self.attempt.get_category_breakdown()
        cat_data = bd['categories'][0]
        # gate=2, non-gate=4 → total 6
        self.assertEqual(cat_data['score'], 6)
        # max = 2 + 4 = 6
        self.assertEqual(cat_data['max_score'], 6)

    def test_gate_unanswered_skips_non_gate(self):
        """Gate not answered (no Answer row) → non-gate excluded."""
        # Only answer the non-gate question
        self._answer(self.non_gate_q, choice=self.ng_choice)

        bd = self.attempt.get_category_breakdown()
        cat_data = bd['categories'][0]
        # gate unanswered → score 0; non-gate skipped
        self.assertEqual(cat_data['score'], 0)
        # max = gate max only
        self.assertEqual(cat_data['max_score'], self.gate_q.get_max_possible_score())


# ─────────────────────────────────────────────────────────────────────────────
class NumericalScoringTest(TestCase):
    """Numerical question threshold scoring."""

    def setUp(self):
        self.survey = _make_survey()
        self.cat = _make_category(self.survey)
        self.user = _make_user('num_user')
        self.attempt = QuestionnaireAttempt.objects.create(
            user=self.user, survey=self.survey
        )
        self.q = Question.objects.create(
            survey=self.survey, category=self.cat,
            text='Num Q', question_type='numerical',
            numerical_thresholds=[
                {'min': 4, 'max': None,  'score': 6},
                {'min': 2, 'max': 3,     'score': 4},
                {'min': 0, 'max': 1,     'score': 2},
            ],
            order=1,
            skip_validation=True,
        )

    def _answer_with_value(self, value):
        ans, _ = Answer.objects.get_or_create(
            attempt=self.attempt, question=self.q,
            defaults={'numerical_value': Decimal(str(value)) if value is not None else None}
        )
        if ans.numerical_value != (Decimal(str(value)) if value is not None else None):
            ans.numerical_value = Decimal(str(value)) if value is not None else None
            ans.save(update_fields=['numerical_value'])
        return ans

    def test_value_gte_4_scores_6(self):
        ans = self._answer_with_value(5)
        self.assertEqual(ans.get_total_score(), 6)

    def test_value_4_scores_6(self):
        ans = self._answer_with_value(4)
        self.assertEqual(ans.get_total_score(), 6)

    def test_value_2_scores_4(self):
        ans = self._answer_with_value(2)
        self.assertEqual(ans.get_total_score(), 4)

    def test_value_3_scores_4(self):
        ans = self._answer_with_value(3)
        self.assertEqual(ans.get_total_score(), 4)

    def test_value_1_scores_2(self):
        ans = self._answer_with_value(1)
        self.assertEqual(ans.get_total_score(), 2)

    def test_value_0_scores_2(self):
        ans = self._answer_with_value(0)
        self.assertEqual(ans.get_total_score(), 2)

    def test_no_answer_scores_0(self):
        ans = Answer.objects.create(attempt=self.attempt, question=self.q, numerical_value=None)
        self.assertEqual(ans.get_total_score(), 0)

    def test_score_numerical_first_match_wins(self):
        """Threshold list is evaluated top-to-bottom; first match wins."""
        # value=4 → matches first band (min=4, max=None, score=6), not the second
        ans = self._answer_with_value(4)
        self.assertEqual(ans._score_numerical(), 6)

    def test_get_max_possible_score(self):
        self.assertEqual(self.q.get_max_possible_score(), 6)


# ─────────────────────────────────────────────────────────────────────────────
class MultiSelectTest(TestCase):
    """Multi-select question scoring."""

    def setUp(self):
        self.survey = _make_survey()
        self.cat = _make_category(self.survey)
        self.user = _make_user('multi_user')
        self.attempt = QuestionnaireAttempt.objects.create(
            user=self.user, survey=self.survey
        )

    def _make_multi_q(self, qt='multi', allow_multiple=False):
        q = Question.objects.create(
            survey=self.survey, category=self.cat,
            text='Multi Q', question_type=qt,
            allow_multiple=allow_multiple, order=1,
            skip_validation=True,
        )
        c1 = Choice.objects.create(question=q, text='A', score=3, order=1)
        c2 = Choice.objects.create(question=q, text='B', score=2, order=2)
        c3 = Choice.objects.create(question=q, text='C', score=1, order=3)
        return q, c1, c2, c3

    def test_sum_of_selected_choices_returned(self):
        q, c1, c2, c3 = self._make_multi_q(qt='multi')
        ans = Answer.objects.create(attempt=self.attempt, question=q)
        ans.choices.set([c1, c2])
        self.assertEqual(ans.get_total_score(), 5)  # 3+2

    def test_question_type_multi_same_as_allow_multiple(self):
        q, c1, c2, c3 = self._make_multi_q(allow_multiple=True)
        ans = Answer.objects.create(attempt=self.attempt, question=q)
        ans.choices.set([c1, c3])
        self.assertEqual(ans.get_total_score(), 4)  # 3+1

    def test_partial_selection_scores_correctly(self):
        q, c1, c2, c3 = self._make_multi_q(qt='multi')
        ans = Answer.objects.create(attempt=self.attempt, question=q)
        ans.choices.set([c3])
        self.assertEqual(ans.get_total_score(), 1)

    def test_get_max_possible_score_multi(self):
        q, c1, c2, c3 = self._make_multi_q(qt='multi')
        self.assertEqual(q.get_max_possible_score(), 6)  # 3+2+1


# ─────────────────────────────────────────────────────────────────────────────
class ConditionalBonusTest(TestCase):
    """Conditional follow-up question and bonus_points logic."""

    def setUp(self):
        self.survey = _make_survey()
        self.cat = _make_category(self.survey)
        self.user = _make_user('bonus_user')
        self.attempt = QuestionnaireAttempt.objects.create(
            user=self.user, survey=self.survey
        )

        # Parent question
        self.parent_q = Question.objects.create(
            survey=self.survey, category=self.cat,
            text='Parent Q', question_type='single', order=1,
            skip_validation=True,
        )
        self.good_choice = Choice.objects.create(question=self.parent_q, text='Good', score=3, order=1)
        self.bad_choice  = Choice.objects.create(question=self.parent_q, text='Bad',  score=0, order=2)

        # Conditional follow-up (bonus=5, visible when parent scores ≥ 2)
        self.cond_q = Question.objects.create(
            survey=self.survey, category=self.cat,
            text='Conditional Q', question_type='single',
            conditional_on_question=self.parent_q,
            conditional_on_min_score=2,
            bonus_points=5,
            order=2,
            skip_validation=True,
        )
        self.bonus_choice = Choice.objects.create(question=self.cond_q, text='Bonus', score=5, order=1)

    def test_bonus_points_in_max_possible_score(self):
        """get_max_possible_score() returns bonus_points for a conditional question."""
        self.assertEqual(self.cond_q.get_max_possible_score(), 5)

    def test_conditional_question_visible_when_parent_qualifies(self):
        """Parent scores ≥ conditional_on_min_score → conditional_on_min_score is satisfied."""
        # Answer parent with good_choice (score=3 ≥ 2)
        parent_ans = Answer.objects.create(
            attempt=self.attempt, question=self.parent_q, choice=self.good_choice
        )
        parent_score = parent_ans.get_total_score()
        self.assertGreaterEqual(parent_score, self.cond_q.conditional_on_min_score)

    def test_conditional_question_not_visible_when_parent_fails(self):
        """Parent scores 0 (< min_score) → conditional not triggered."""
        parent_ans = Answer.objects.create(
            attempt=self.attempt, question=self.parent_q, choice=self.bad_choice
        )
        parent_score = parent_ans.get_total_score()
        self.assertLess(parent_score, self.cond_q.conditional_on_min_score)

    def test_bonus_answer_scores_correctly(self):
        """Conditional question answered → scores bonus_points."""
        ans = Answer.objects.create(
            attempt=self.attempt, question=self.cond_q, choice=self.bonus_choice
        )
        self.assertEqual(ans.get_total_score(), 5)

    def test_no_bonus_points_uses_choice_max(self):
        """Question without bonus_points falls back to max choice score."""
        self.assertEqual(self.parent_q.get_max_possible_score(), 3)
