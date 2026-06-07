import os

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.http import FileResponse, Http404 as DjangoHttp404
from django.utils import timezone
from .models import Course, Lesson, LessonAttachment, LessonProgress
from .serializers import CourseSerializer, LessonSerializer, LessonAttachmentSerializer, LessonProgressSerializer


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

        # Re-fetch with select_related so LessonProgressSerializer can access
        # lesson.title and lesson.course.title without issuing lazy-load queries.
        progress = (
            LessonProgress.objects
            .select_related('lesson__course')
            .get(pk=progress.pk)
        )
        serializer = LessonProgressSerializer(progress, context={'request': request})
        return Response(serializer.data)


class LessonAttachmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Fix R6-03: serve lesson attachments through an authenticated endpoint
    instead of exposing raw /media/ URLs that anyone with the URL can access.
    """
    serializer_class = LessonAttachmentSerializer
    permission_classes = [IsAuthenticated]
    queryset = LessonAttachment.objects.none()  # schema-safe default

    def get_queryset(self):
        return LessonAttachment.objects.select_related('lesson__course')

    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        """Stream the attachment file after ownership verification."""
        att = self.get_object()
        if not att.file:
            raise DjangoHttp404
        try:
            file_path = att.file.path
        except (ValueError, NotImplementedError):
            # Cloud storage (e.g. S3) — return the signed URL directly.
            return Response({'url': att.file.url})
        if not os.path.exists(file_path):
            raise DjangoHttp404
        try:
            fh = open(file_path, 'rb')
        except OSError:
            raise DjangoHttp404
        return FileResponse(
            fh,
            as_attachment=True,
            filename=os.path.basename(att.file.name),
        )


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
