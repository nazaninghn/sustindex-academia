from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from .models import Course, Lesson, LessonProgress
from .serializers import CourseSerializer, LessonSerializer, LessonProgressSerializer


class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for courses."""
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]
    # Required so drf-spectacular can generate the schema without an authenticated
    # request context, and so Django's admin-browsable API doesn't accidentally
    # expose all courses when the permission check is bypassed.
    queryset = Course.objects.none()

    def get_queryset(self):
        # Fix N (Round 4): prefetch lessons and their attachments so the
        # serializer never fires per-lesson DB queries.
        return (
            Course.objects.filter(is_active=True)
            .prefetch_related('lessons__attachments')
            .order_by('order', '-created_at')
        )


class LessonViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for lessons."""
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated]
    queryset = Lesson.objects.none()  # schema-safe default; real qs in get_queryset()

    def get_queryset(self):
        course_id = self.request.query_params.get('course')
        queryset = (
            Lesson.objects.filter(course__is_active=True)
            .select_related('course')           # Fix N
            .prefetch_related('attachments')    # Fix N
        )
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset.order_by('order')

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a lesson as completed.

        Uses update_or_create inside transaction.atomic() to eliminate the TOCTOU race
        condition where two concurrent requests could both pass get_or_create and hit a
        unique_together IntegrityError.
        """
        lesson = self.get_object()

        with transaction.atomic():
            progress, _ = LessonProgress.objects.update_or_create(
                user=request.user,
                lesson=lesson,
                defaults={
                    'is_completed': True,
                    'completed_at': timezone.now(),
                },
            )

        serializer = LessonProgressSerializer(progress)
        return Response(serializer.data)


class LessonProgressViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for lesson progress."""
    serializer_class = LessonProgressSerializer
    permission_classes = [IsAuthenticated]
    queryset = LessonProgress.objects.none()  # schema-safe default; real qs in get_queryset()

    def get_queryset(self):
        return (
            LessonProgress.objects.filter(user=self.request.user)
            .select_related('lesson__course')   # Fix N
        )

    @action(detail=False, methods=['get'])
    def my_progress(self, request):
        """Get current user's progress."""
        progress = self.get_queryset()
        serializer = self.get_serializer(progress, many=True)
        return Response(serializer.data)
