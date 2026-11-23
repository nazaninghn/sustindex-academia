"""Admin console API: access control, aggregates, filters and the narrow writes."""
import datetime

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import MembershipHistory
from elearning.models import Course
from questionnaire.models import QuestionnaireAttempt, Survey

User = get_user_model()
BASE = '/api/v1/admin/'


class AdminApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff = User.objects.create_user('boss', 'boss@example.com', 'x', is_staff=True)
        cls.root = User.objects.create_superuser('root', 'root@example.com', 'x')
        cls.alice = User.objects.create_user('alice', 'alice@example.com', 'x', company_name='Acme')
        cls.bob = User.objects.create_user('bob', 'bob@example.com', 'x', company_name='=cmd()')
        cls.survey = Survey.objects.create(name='GRI Core')
        now = timezone.now()
        cls.done = QuestionnaireAttempt.objects.create(
            user=cls.alice, survey=cls.survey, is_completed=True, completed_at=now,
            total_score=72, overall_grade='A', environmental_score=70, social_score=80,
            governance_score=66, selected_sector='tech')
        cls.open = QuestionnaireAttempt.objects.create(user=cls.bob, survey=cls.survey)
        # started long ago with no answers → stalled
        QuestionnaireAttempt.objects.filter(pk=cls.open.pk).update(started_at=now - datetime.timedelta(days=40))

    def client_for(self, user):
        client = APIClient()
        if user:
            client.force_authenticate(user)
        return client


class AccessTests(AdminApiTestCase):
    PATHS = ['overview/', 'users/', 'users/export/', 'assessments/', 'assessments/export/', 'content/']

    def test_anonymous_is_rejected(self):
        for path in self.PATHS:
            self.assertEqual(self.client_for(None).get(BASE + path).status_code, 401, path)

    def test_regular_user_is_forbidden(self):
        client = self.client_for(self.alice)
        for path in self.PATHS:
            self.assertEqual(client.get(BASE + path).status_code, 403, path)
        self.assertEqual(client.get(f'{BASE}users/{self.bob.pk}/').status_code, 403)
        self.assertEqual(client.patch(f'{BASE}users/{self.alice.pk}/', {'membership_type': 'gold'},
                                      format='json').status_code, 403)
        self.assertEqual(client.patch(f'{BASE}surveys/{self.survey.pk}/', {'is_active': False},
                                      format='json').status_code, 403)

    def test_me_reports_staff_flag(self):
        self.assertTrue(self.client_for(self.staff).get('/api/v1/users/me/').data['is_staff'])
        self.assertFalse(self.client_for(self.alice).get('/api/v1/users/me/').data['is_staff'])


class OverviewTests(AdminApiTestCase):
    def test_numbers(self):
        data = self.client_for(self.staff).get(BASE + 'overview/?days=30').data
        k = data['kpis']
        self.assertEqual(k['total_users'], 4)
        self.assertEqual(k['completed']['value'], 1)
        self.assertEqual(k['avg_score']['value'], 72.0)
        self.assertEqual(k['in_progress'], 1)
        self.assertEqual(k['stalled'], 1)
        self.assertEqual(len(data['series']), 30)
        self.assertEqual(sum(d['completed'] for d in data['series']), 1)
        self.assertEqual(len(data['calendar']), 182)
        self.assertEqual({g['grade']: g['count'] for g in data['grades']}['A'], 1)
        self.assertEqual(sum(b['count'] for b in data['score_distribution']), 1)
        self.assertEqual(data['sectors'][0]['sector'], 'tech')
        self.assertEqual(data['esg']['social'], 80.0)
        self.assertEqual([f['count'] for f in data['funnel']], [4, 2, 1, 0])

    def test_score_of_100_lands_in_top_bucket(self):
        QuestionnaireAttempt.objects.filter(pk=self.done.pk).update(total_score=100)
        data = self.client_for(self.staff).get(BASE + 'overview/').data
        self.assertEqual(data['score_distribution'][-1]['count'], 1)

    def test_invalid_range_falls_back_and_all_time_works(self):
        client = self.client_for(self.staff)
        self.assertEqual(client.get(BASE + 'overview/?days=7').data['range_days'], 30)
        data = client.get(BASE + 'overview/?days=0').data
        self.assertEqual(data['range_days'], 0)
        self.assertIsNone(data['kpis']['signups']['delta_pct'])


class UserTests(AdminApiTestCase):
    def test_list_search_and_annotations(self):
        client = self.client_for(self.staff)
        data = client.get(BASE + 'users/?search=acme').data
        self.assertEqual(data['count'], 1)
        row = data['results'][0]
        self.assertEqual((row['username'], row['attempts_count'], row['completed_count'], row['last_score'],
                          row['last_grade']), ('alice', 1, 1, 72, 'A'))
        self.assertEqual(client.get(BASE + 'users/?status=staff').data['count'], 2)
        self.assertEqual(client.get(BASE + 'users/?status=no_assessment').data['count'], 2)
        self.assertEqual(client.get(BASE + 'users/?page_size=1&page=99').data['page'], 4)

    def test_detail(self):
        data = self.client_for(self.staff).get(f'{BASE}users/{self.alice.pk}/').data
        self.assertEqual(len(data['attempts']), 1)
        self.assertEqual(data['attempts'][0]['score'], 72)
        self.assertEqual(data['tasks']['todo'], 0)

    def test_membership_change_writes_history(self):
        client = self.client_for(self.staff)
        resp = client.patch(f'{BASE}users/{self.alice.pk}/', {'membership_type': 'gold'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.alice.refresh_from_db()
        self.assertEqual(self.alice.membership_type, 'gold')
        client.patch(f'{BASE}users/{self.alice.pk}/', {'membership_type': 'silver'}, format='json')
        history = MembershipHistory.objects.filter(user=self.alice)
        self.assertEqual(history.count(), 2)
        self.assertEqual(list(history.filter(is_active=True).values_list('membership_type', flat=True)), ['silver'])

    def test_validation_and_guards(self):
        client = self.client_for(self.staff)
        url = f'{BASE}users/{self.alice.pk}/'
        self.assertEqual(client.patch(url, {'membership_type': 'platinum'}, format='json').status_code, 400)
        self.assertEqual(client.patch(url, {'is_staff': True}, format='json').status_code, 400)
        self.assertEqual(client.patch(url, {'is_active': 'maybe'}, format='json').status_code, 400)
        # no self-lockout
        self.assertEqual(client.patch(f'{BASE}users/{self.staff.pk}/', {'is_active': False},
                                      format='json').status_code, 400)
        # staff cannot touch other privileged accounts; a superuser can
        self.assertEqual(client.patch(f'{BASE}users/{self.root.pk}/', {'is_active': False},
                                      format='json').status_code, 403)
        self.root.refresh_from_db()
        self.assertTrue(self.root.is_active)
        self.assertEqual(self.client_for(self.root).patch(f'{BASE}users/{self.staff.pk}/', {'is_active': False},
                                                          format='json').status_code, 200)

    def test_deactivate_and_reactivate(self):
        client = self.client_for(self.staff)
        url = f'{BASE}users/{self.bob.pk}/'
        self.assertFalse(client.patch(url, {'is_active': False}, format='json').data['is_active'])
        self.assertEqual(client.get(BASE + 'users/?status=inactive').data['count'], 1)
        self.assertTrue(client.patch(url, {'is_active': True}, format='json').data['is_active'])

    def test_export_escapes_formulas(self):
        resp = self.client_for(self.staff).get(BASE + 'users/export/')
        self.assertEqual(resp['Content-Type'], 'text/csv; charset=utf-8')
        body = resp.content.decode('utf-8-sig')
        self.assertIn("'=cmd()", body)
        self.assertEqual(len(body.strip().splitlines()), 5)


class AssessmentTests(AdminApiTestCase):
    def test_filters(self):
        client = self.client_for(self.staff)
        self.assertEqual(client.get(BASE + 'assessments/').data['count'], 2)
        self.assertEqual(client.get(BASE + 'assessments/?status=completed').data['results'][0]['id'], self.done.pk)
        self.assertEqual(client.get(BASE + 'assessments/?status=stalled').data['results'][0]['id'], self.open.pk)
        self.assertEqual(client.get(BASE + 'assessments/?grade=A').data['count'], 1)
        self.assertEqual(client.get(BASE + 'assessments/?sector=tech').data['count'], 1)
        self.assertEqual(client.get(f'{BASE}assessments/?user={self.bob.pk}').data['count'], 1)
        self.assertEqual(client.get(BASE + 'assessments/?search=acme').data['count'], 1)
        data = client.get(BASE + 'assessments/?ordering=-score').data
        self.assertEqual(data['results'][0]['id'], self.done.pk)
        self.assertIsNone(data['results'][1]['score'])          # unfinished attempts expose no score
        self.assertEqual(data['filters']['surveys'][0]['name'], 'GRI Core')

    def test_export(self):
        body = self.client_for(self.staff).get(BASE + 'assessments/export/?status=completed').content.decode('utf-8-sig')
        lines = body.strip().splitlines()
        self.assertEqual(len(lines), 2)
        self.assertIn('alice', lines[1])


class ContentTests(AdminApiTestCase):
    def test_content_and_toggles(self):
        course = Course.objects.create(title='ESG 101', description='x')
        client = self.client_for(self.staff)
        data = client.get(BASE + 'content/').data
        s = data['surveys'][0]
        self.assertEqual((s['attempts'], s['completed'], s['completion_rate'], s['avg_score']), (2, 1, 50.0, 72.0))
        self.assertEqual(data['totals']['courses'], 1)

        resp = client.patch(f'{BASE}surveys/{self.survey.pk}/', {'is_active': False}, format='json')
        self.assertEqual(resp.data, {'id': self.survey.pk, 'is_active': False})
        self.survey.refresh_from_db()
        self.assertFalse(self.survey.is_active)
        client.patch(f'{BASE}courses/{course.pk}/', {'is_active': False}, format='json')
        course.refresh_from_db()
        self.assertFalse(course.is_active)
        self.assertEqual(client.patch(f'{BASE}surveys/{self.survey.pk}/', {'name': 'x'}, format='json').status_code, 400)
        self.assertEqual(client.patch(f'{BASE}surveys/99999/', {'is_active': True}, format='json').status_code, 404)
