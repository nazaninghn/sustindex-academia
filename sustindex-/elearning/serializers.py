from rest_framework import serializers
from .models import Course, Lesson, LessonAttachment, LessonProgress


# ── Shared mixin ────────────────────────────────────────────────────────────
class ElearningMixin:
    """
    Language detection + completed-lesson-ID cache shared by LessonSerializer
    and CourseSerializer.  Extracted to avoid the duplicate _lang() and
    _completed_lesson_ids() methods that previously existed in both classes.
    """

    def _lang(self) -> 'str | None':
        request = self.context.get('request')  # type: ignore[attr-defined]
        if request:
            return (
                request.query_params.get('lang')
                or request.headers.get('Accept-Language', '').split(',')[0].split('-')[0]
            )
        return None

    def _completed_lesson_ids(self) -> set:
        """
        Lazily fetch and cache the set of completed lesson IDs for the current
        user.  The result is stored in the serializer *context* so that all
        LessonSerializer / CourseSerializer instances that share the same
        context (e.g. a nested list) only hit the DB once per request.
        """
        ctx = self.context  # type: ignore[attr-defined]
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


class LessonAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonAttachment
        fields = ['id', 'title', 'file', 'uploaded_at']


class LessonSerializer(ElearningMixin, serializers.ModelSerializer):
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

    def get_title_display(self, obj):
        lang = self._lang()
        if lang == 'tr' and obj.title_tr:
            return obj.title_tr
        if lang == 'en' and obj.title_en:
            return obj.title_en
        return obj.title

    def get_is_completed(self, obj):
        # Uses the mixin's cached _completed_lesson_ids — no per-lesson DB query.
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.id in self._completed_lesson_ids()
        return False


class CourseSerializer(ElearningMixin, serializers.ModelSerializer):
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
        # Uses mixin's cached _completed_lesson_ids — no extra DB round-trip.
        # Uses obj.lessons.all() to hit the prefetch cache; .values_list()
        # would bypass it and issue a new query.
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            lesson_ids = {l.id for l in obj.lessons.all()}
            return len(lesson_ids & self._completed_lesson_ids())
        return 0

    def get_progress_percentage(self, obj):
        # len(list(...)) hits the prefetch cache; .count() always issues a
        # COUNT(*) query regardless of prefetch.
        total = len(list(obj.lessons.all()))
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
