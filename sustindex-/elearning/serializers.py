from rest_framework import serializers
from .models import Course, Lesson, LessonAttachment, LessonProgress


class LessonAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonAttachment
        fields = ['id', 'title', 'file', 'uploaded_at']


class LessonSerializer(serializers.ModelSerializer):
    attachments  = LessonAttachmentSerializer(many=True, read_only=True)
    is_completed = serializers.SerializerMethodField()
    title_display = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            'id', 'title', 'title_tr', 'title_en', 'title_display',
            'content', 'video_url', 'order',
            'duration_minutes', 'attachments', 'is_completed',
        ]

    def _lang(self):
        request = self.context.get('request')
        if request:
            return (
                request.query_params.get('lang')
                or request.headers.get('Accept-Language', '').split(',')[0].split('-')[0]
            )
        return None

    def get_title_display(self, obj):
        lang = self._lang()
        if lang == 'tr' and obj.title_tr:
            return obj.title_tr
        if lang == 'en' and obj.title_en:
            return obj.title_en
        return obj.title

    def get_is_completed(self, obj):
        # Fix I: use a pre-fetched set from context instead of one DB query per lesson
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            completed_ids = self._completed_lesson_ids()
            return obj.id in completed_ids
        return False

    def _completed_lesson_ids(self):
        """
        Lazily fetch the set of completed lesson IDs for the current user and
        cache it in the serializer context so LessonSerializer instances that
        share the same context only hit the DB once total (not once per lesson).
        """
        ctx = self.context
        if '_completed_lesson_ids' not in ctx:
            request = ctx.get('request')
            if request and request.user.is_authenticated:
                ctx['_completed_lesson_ids'] = set(
                    LessonProgress.objects.filter(
                        user=request.user, is_completed=True
                    ).values_list('lesson_id', flat=True)
                )
            else:
                ctx['_completed_lesson_ids'] = set()
        return ctx['_completed_lesson_ids']


class CourseSerializer(serializers.ModelSerializer):
    lessons            = LessonSerializer(many=True, read_only=True)
    total_lessons      = serializers.IntegerField(source='lessons.count', read_only=True)
    completed_lessons  = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()
    title_display      = serializers.SerializerMethodField()
    description_display = serializers.SerializerMethodField()
    level_display      = serializers.CharField(source='get_level_display', read_only=True)

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'title_tr', 'title_en', 'title_display',
            'description', 'description_tr', 'description_en', 'description_display',
            'thumbnail', 'tag', 'level', 'level_display',
            'icon_emoji', 'duration_hours', 'order',
            'is_active', 'created_at',
            'lessons', 'total_lessons', 'completed_lessons', 'progress_percentage',
        ]

    def _lang(self):
        request = self.context.get('request')
        if request:
            return (
                request.query_params.get('lang')
                or request.headers.get('Accept-Language', '').split(',')[0].split('-')[0]
            )
        return None

    def get_title_display(self, obj):
        lang = self._lang()
        if lang == 'tr' and obj.title_tr:
            return obj.title_tr
        if lang == 'en' and obj.title_en:
            return obj.title_en
        return obj.title

    def get_description_display(self, obj):
        lang = self._lang()
        if lang == 'tr' and obj.description_tr:
            return obj.description_tr
        if lang == 'en' and obj.description_en:
            return obj.description_en
        return obj.description

    def get_completed_lessons(self, obj):
        # Fix I: reuse the cached completed-lesson set — no extra DB round-trip
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            lesson_ids = set(obj.lessons.values_list('id', flat=True))
            return len(lesson_ids & self._completed_lesson_ids())
        return 0

    def get_progress_percentage(self, obj):
        total = obj.lessons.count()
        if total == 0:
            return 0
        completed = self.get_completed_lessons(obj)
        return round((completed / total) * 100)

    def _completed_lesson_ids(self):
        """
        Lazily fetch and cache all completed lesson IDs for the current user.
        Shared between get_completed_lessons and the nested LessonSerializer
        instances so the whole request only issues one LessonProgress query.
        """
        ctx = self.context
        if '_completed_lesson_ids' not in ctx:
            request = ctx.get('request')
            if request and request.user.is_authenticated:
                ctx['_completed_lesson_ids'] = set(
                    LessonProgress.objects.filter(
                        user=request.user, is_completed=True
                    ).values_list('lesson_id', flat=True)
                )
            else:
                ctx['_completed_lesson_ids'] = set()
        return ctx['_completed_lesson_ids']


class LessonProgressSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    course_title = serializers.CharField(source='lesson.course.title', read_only=True)

    class Meta:
        model = LessonProgress
        fields = ['id', 'lesson', 'lesson_title', 'course_title',
                  'is_completed', 'completed_at']
