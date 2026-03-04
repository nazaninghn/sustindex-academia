from rest_framework import serializers
from .models import Course, Lesson, LessonAttachment, LessonProgress


class LessonAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonAttachment
        fields = ['id', 'title', 'file', 'uploaded_at']


class LessonSerializer(serializers.ModelSerializer):
    attachments = LessonAttachmentSerializer(many=True, read_only=True)
    is_completed = serializers.SerializerMethodField()
    
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'content', 'video_url', 'order', 
                  'duration_minutes', 'attachments', 'is_completed']
    
    def get_is_completed(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            progress = LessonProgress.objects.filter(
                user=request.user, 
                lesson=obj
            ).first()
            return progress.is_completed if progress else False
        return False


class CourseSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)
    total_lessons = serializers.IntegerField(source='lessons.count', read_only=True)
    completed_lessons = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'thumbnail', 'is_active', 
                  'created_at', 'lessons', 'total_lessons', 'completed_lessons', 
                  'progress_percentage']
    
    def get_completed_lessons(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return LessonProgress.objects.filter(
                user=request.user,
                lesson__course=obj,
                is_completed=True
            ).count()
        return 0
    
    def get_progress_percentage(self, obj):
        total = obj.lessons.count()
        if total == 0:
            return 0
        completed = self.get_completed_lessons(obj)
        return round((completed / total) * 100)


class LessonProgressSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    course_title = serializers.CharField(source='lesson.course.title', read_only=True)
    
    class Meta:
        model = LessonProgress
        fields = ['id', 'lesson', 'lesson_title', 'course_title', 
                  'is_completed', 'completed_at']
