from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from .models import Course, Lesson, LessonProgress

@login_required
def course_list(request):
    # Note: these are legacy template views; the live API is served by CourseViewSet.
    courses = Course.objects.filter(is_active=True).order_by('order')
    return render(request, 'elearning/course_list.html', {'courses': courses})

@login_required
def course_detail(request, course_id):
    course = get_object_or_404(Course, id=course_id, is_active=True)
    lessons = course.lessons.all().order_by('order')
    
    return render(request, 'elearning/course_detail.html', {
        'course': course,
        'lessons': lessons
    })

@login_required
def lesson_detail(request, lesson_id):
    if request.user.membership_type != 'gold':
        return render(request, 'elearning/access_denied.html')
    
    lesson = get_object_or_404(Lesson, id=lesson_id)
    
    progress, created = LessonProgress.objects.get_or_create(
        user=request.user,
        lesson=lesson
    )
    
    if request.method == 'POST' and 'complete' in request.POST:
        progress.is_completed = True
        progress.completed_at = timezone.now()
        progress.save()
        return redirect('course_detail', course_id=lesson.course.id)
    
    return render(request, 'elearning/lesson_detail.html', {
        'lesson': lesson,
        'progress': progress
    })
