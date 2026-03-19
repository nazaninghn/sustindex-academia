"""
Service functions for questionnaire calculations and statistics
"""
from django.db.models import Count, Q


def recalc_attempt_score(attempt):
    """
    محاسبه مجدد امتیاز کل یک attempt
    Uses calculate_scores() which handles all question types properly.
    """
    attempt.calculate_scores()
    return attempt.total_score


def attempt_stats(attempt):
    """
    محاسبه آمار پیشرفت یک attempt
    
    Returns:
        dict: {
            'total_questions': تعداد کل سوالات,
            'answered_questions': تعداد سوالات پاسخ داده شده,
            'cannot_answer_count': تعداد "نمی‌توانم پاسخ دهم",
            'progress_percent': درصد پیشرفت
        }
    """
    total_questions = attempt.answers.count()
    
    answered_questions = 0
    cannot_answer_count = 0
    
    for answer in attempt.answers.all():
        if answer.is_cannot_answer():
            cannot_answer_count += 1
        elif answer.choice or answer.choices.exists() or (answer.text_answer and answer.text_answer.strip()):
            answered_questions += 1
    
    progress_percent = 0
    if total_questions > 0:
        progress_percent = round(((answered_questions + cannot_answer_count) / total_questions) * 100)
    
    return {
        'total_questions': total_questions,
        'answered_questions': answered_questions,
        'cannot_answer_count': cannot_answer_count,
        'progress_percent': progress_percent,
    }


def get_category_performance(attempt):
    """
    محاسبه عملکرد در هر دسته‌بندی - filtered by survey
    """
    from .models import Category
    
    if attempt.survey:
        categories = Category.objects.filter(
            survey=attempt.survey
        ).order_by('order')
        if not categories.exists():
            categories = Category.objects.filter(
                questions__survey=attempt.survey,
                questions__is_active=True
            ).distinct().order_by('order')
    else:
        categories = Category.objects.filter(
            questions__is_active=True
        ).distinct().order_by('order')
    
    performance = []
    
    for category in categories:
        category_score = category.get_category_score(attempt)
        performance.append({
            'category': category.name,
            'score': category_score,
            'max_score': category.max_score,
            'percentage': min(round(category_score, 1), 100)
        })
    
    return performance
