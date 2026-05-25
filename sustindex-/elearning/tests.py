"""
E-learning app tests.

Covers:
  - LessonProgress N+1 fix (Fix I, Round 3): serializing N lessons must not
    issue more than 1 LessonProgress query regardless of N.
  - CourseViewSet progress_percentage calculation.
  - Marking a lesson complete via the API.
  - Duplicate complete calls are idempotent.
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from elearning.models import Course, Lesson, LessonProgress
from elearning.serializers import CourseSerializer

User = get_user_model()


class LessonProgressQueryCountTests(TestCase):
    """Fix I (Round 3): _completed_lesson_ids must be fetched exactly once."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='learner', email='l@example.com', password='pass'
        )
        self.course = Course.objects.create(title='Test Course', description='x')
        # Create 5 lessons
        self.lessons = [
            Lesson.objects.create(
                course=self.course, title=f'Lesson {i}', content='x', order=i
            )
            for i in range(5)
        ]
        # Mark first 3 as completed
        for lesson in self.lessons[:3]:
            LessonProgress.objects.create(
                user=self.user, lesson=lesson,
                is_completed=True
            )

    def test_serializing_course_uses_single_progress_query(self):
        """
        Regardless of how many lessons the course has, the serializer must
        issue at most 1 LessonProgress query (the shared _completed_lesson_ids
        cache) — not one per lesson.
        """
        from django.test.utils import CaptureQueriesContext
        from django.db import connection

        request = type('R', (), {
            'user': self.user,
            'query_params': {},
            'headers': {},
        })()

        with CaptureQueriesContext(connection) as ctx:
            serializer = CourseSerializer(
                self.course,
                context={'request': request}
            )
            _ = serializer.data

        # Collect only LessonProgress queries
        progress_queries = [
            q['sql'] for q in ctx.captured_queries
            if 'lessonprogress' in q['sql'].lower()
        ]
        self.assertLessEqual(
            len(progress_queries), 1,
            msg=(
                f'Expected ≤1 LessonProgress query, got {len(progress_queries)}.\n'
                + '\n'.join(progress_queries)
            )
        )

    def test_progress_percentage_correct(self):
        request = type('R', (), {
            'user': self.user,
            'query_params': {},
            'headers': {},
        })()
        serializer = CourseSerializer(self.course, context={'request': request})
        data = serializer.data
        self.assertEqual(data['completed_lessons'], 3)
        self.assertEqual(data['total_lessons'], 5)
        self.assertEqual(data['progress_percentage'], 60)


class LessonCompleteActionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='learner2', email='l2@example.com', password='pass'
        )
        self.client.force_authenticate(user=self.user)
        self.course = Course.objects.create(title='Course', description='x')
        self.lesson = Lesson.objects.create(
            course=self.course, title='Lesson 1', content='x', order=1
        )

    def test_complete_lesson_returns_200_and_creates_progress(self):
        url = f'/api/elearning/lessons/{self.lesson.id}/complete/'
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(
            LessonProgress.objects.filter(
                user=self.user, lesson=self.lesson, is_completed=True
            ).exists()
        )

    def test_completing_lesson_twice_is_idempotent(self):
        url = f'/api/elearning/lessons/{self.lesson.id}/complete/'
        self.client.post(url)
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Exactly one progress record
        self.assertEqual(
            LessonProgress.objects.filter(user=self.user, lesson=self.lesson).count(), 1
        )

    def test_unauthenticated_cannot_complete_lesson(self):
        self.client.force_authenticate(user=None)
        url = f'/api/elearning/lessons/{self.lesson.id}/complete/'
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
