"""
Service functions for questionnaire calculations and statistics
"""
from django.db.models import Count, Q


def recalc_attempt_score(attempt):
    """
    Recalculate attempt score using the canonical scoring logic.
    """
    attempt.calculate_scores()
    return attempt.total_score


def attempt_stats(attempt):
    """
    Calculate attempt progress stats.
    """
    if attempt.survey:
        total_questions = attempt.survey.questions.filter(is_active=True).count()
    else:
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
        progress_percent = round(
            ((answered_questions + cannot_answer_count) / total_questions) * 100
        )

    return {
        'total_questions': total_questions,
        'answered_questions': answered_questions,
        'cannot_answer_count': cannot_answer_count,
        'progress_percent': min(progress_percent, 100),
    }


def get_category_performance(attempt):
    """
    Return per-category scoring using the same source of truth
    as calculate_scores() / get_category_breakdown().
    """
    results = attempt.get_category_breakdown()

    performance = []
    for category_name, data in results['categories'].items():
        performance.append({
            'category': category_name,
            'score': data['score'],
            'max_score': data['max_score'],
            'percentage': data['percentage'],
            'category_id': data['category_id'],
        })

    return performance
