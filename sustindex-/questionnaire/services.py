"""
Service functions for questionnaire calculations and statistics
"""
from django.db.models import Count, Q


def recalc_attempt_score(attempt):
    """
    Recalculate attempt score using the canonical scoring logic.

    Fix R6-20: pass save=True explicitly so scores are always persisted
    (the default in calculate_scores may vary; an explicit kwarg is unambiguous
    and signals intent clearly to future maintainers).
    """
    attempt.calculate_scores(save=True)
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

    # Fix R5-H-05: evaluate choices via list() to hit the prefetch_related cache
    # instead of issuing an answer.choices.exists() DB query per answer (N+1).
    # Fix R10-02: prefetch 'choices' (M2M/reverse-FK) and select_related 'choice'
    # (FK) here so the loop below never issues extra per-answer DB queries —
    # answer.choices.all() returns the prefetch cache, not a new queryset.
    for answer in attempt.answers.select_related('choice').prefetch_related('choices').all():
        if answer.is_cannot_answer():
            cannot_answer_count += 1
        elif answer.choice or bool(list(answer.choices.all())) or (answer.text_answer and answer.text_answer.strip()):
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
    for data in results['categories']:
        performance.append({
            'category': data['name'],
            'score': data['score'],
            'max_score': data['max_score'],
            'percentage': data['percentage'],
            'category_id': data['id'],
        })

    return performance
