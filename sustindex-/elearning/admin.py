from django.contrib import admin
from .models import Course, Lesson, LessonAttachment, LessonProgress


class LessonInline(admin.TabularInline):
    model  = Lesson
    extra  = 1
    fields = ['title', 'title_tr', 'title_en', 'order', 'duration_minutes', 'video_url']


class LessonAttachmentInline(admin.TabularInline):
    model = LessonAttachment
    extra = 1


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display        = ['order', 'icon_emoji', 'title', 'tag', 'level', 'total_lessons', 'is_active', 'company']
    list_display_links  = ['icon_emoji', 'title']
    list_editable       = ['order', 'is_active']
    list_filter    = ['is_active', 'level', 'tag']
    search_fields  = ['title', 'title_tr', 'title_en', 'tag']
    ordering       = ['order']
    inlines        = [LessonInline]

    fieldsets = [
        ('Content', {
            'fields': ['title', 'title_tr', 'title_en', 'description', 'description_tr', 'description_en', 'thumbnail'],
        }),
        ('Metadata', {
            'fields': ['tag', 'level', 'icon_emoji', 'duration_hours', 'order'],
        }),
        ('Settings', {
            'fields': ['is_active', 'company'],
        }),
    ]

    def total_lessons(self, obj):
        return obj.lessons.count()
    total_lessons.short_description = 'Lessons'


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ['title', 'course', 'order', 'duration_minutes']
    list_filter  = ['course']
    search_fields = ['title', 'title_tr', 'title_en']
    inlines      = [LessonAttachmentInline]


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display  = ['user', 'lesson', 'is_completed', 'completed_at']
    list_filter   = ['is_completed']
    search_fields = ['user__username', 'lesson__title']
