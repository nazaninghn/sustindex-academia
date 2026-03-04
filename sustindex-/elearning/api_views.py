from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import Course, Lesson, LessonProgress
from .serializers import CourseSerializer, LessonSerializer, LessonProgressSerializer


class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for courses"""
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Users can see all active courses
        return Course.objects.filter(is_active=True)


class LessonViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for lessons"""
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        course_id = self.request.query_params.get('course')
        queryset = Lesson.objects.filter(course__is_active=True)
        
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        
        return queryset.order_by('order')
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a lesson as completed"""
        lesson = self.get_object()
        
        progress, created = LessonProgress.objects.get_or_create(
            user=request.user,
            lesson=lesson
        )
        
        if not progress.is_completed:
            progress.is_completed = True
            progress.completed_at = timezone.now()
            progress.save()
        
        serializer = LessonProgressSerializer(progress)
        return Response(serializer.data)


class LessonProgressViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for lesson progress"""
    serializer_class = LessonProgressSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return LessonProgress.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def my_progress(self, request):
        """Get current user's progress"""
        progress = self.get_queryset()
        serializer = self.get_serializer(progress, many=True)
        return Response(serializer.data)
