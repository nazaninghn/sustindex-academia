from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.http import JsonResponse
from django.db import transaction
import json
import logging

logger = logging.getLogger(__name__)

# Fix C-03: use magic-bytes MIME validation (same approach as api_views.py).
# Content-Type header is set by the browser and trivially spoofable.
try:
    import magic as _magic
    _MAGIC_AVAILABLE = True
except ImportError:
    _magic = None           # type: ignore
    _MAGIC_AVAILABLE = False

from .models import (
    Survey, SurveySession, Category, Question, Choice,
    QuestionnaireAttempt, Answer, UserDocument,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_question_for_attempt(question_id, attempt):
    """Return the Question or raise Http404 — ensures it belongs to this survey."""
    if attempt.survey:
        return get_object_or_404(Question, id=question_id, survey=attempt.survey)
    return get_object_or_404(Question, id=question_id)


# ── Views ─────────────────────────────────────────────────────────────────────

@login_required
def start_questionnaire(request):
    user = request.user
    attempts_count = QuestionnaireAttempt.objects.filter(user=user, is_completed=True).count()

    if user.membership_type == 'silver' and attempts_count >= 1:
        return render(request, 'questionnaire/limit_reached.html')

    survey = Survey.objects.filter(is_active=True).first()
    if not survey:
        survey = Survey.objects.first()

    session = None
    if survey:
        open_sessions = survey.sessions.filter(
            is_active=True,
            start_date__lte=timezone.now(),
            end_date__gte=timezone.now()
        )
        session = open_sessions.first()

    attempt = QuestionnaireAttempt.objects.create(
        user=user,
        survey=survey,
        session=session
    )
    return redirect('questionnaire_page', attempt_id=attempt.id)


@login_required
def questionnaire_page(request, attempt_id):
    attempt = get_object_or_404(QuestionnaireAttempt, id=attempt_id, user=request.user)

    if attempt.is_completed:
        return redirect('questionnaire_result', attempt_id=attempt.id)

    if attempt.survey:
        questions = attempt.survey.questions.filter(is_active=True)
    else:
        questions = Question.objects.filter(is_active=True)

    categories = Category.objects.filter(
        questions__in=questions
    ).prefetch_related('questions__choices').distinct()

    if request.method == 'POST':
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

        # ── Process choice answers ────────────────────────────────────────────
        for key, value in request.POST.items():
            if not key.startswith('question_'):
                continue

            # Fix C-1: guard against malformed keys like "question_abc"
            try:
                q_id = int(key.split('_')[1])
            except (IndexError, ValueError):
                continue

            # Fix C-2: validate question belongs to this attempt's survey
            question = _get_question_for_attempt(q_id, attempt)

            answer, _ = Answer.objects.get_or_create(
                attempt=attempt,
                question=question,
            )

            if value == 'cannot_answer':
                answer.choice = None
                answer.choices.clear()
                answer.save()
                continue

            if question.allow_multiple:
                choice_ids_raw = request.POST.getlist(key)
                choice_ids_raw = [c for c in choice_ids_raw if c != 'cannot_answer']
                answer.choices.clear()
                for raw in choice_ids_raw:
                    # Fix C-3: guard non-integer + validate choice owns this question
                    try:
                        cid = int(raw)
                    except ValueError:
                        continue
                    choice = get_object_or_404(Choice, id=cid, question=question)
                    answer.choices.add(choice)
                answer.choice = None
            else:
                # Fix C-3: guard non-integer value + validate choice owns this question
                try:
                    cid = int(value)
                except ValueError:
                    continue
                choice = get_object_or_404(Choice, id=cid, question=question)
                answer.choice = choice
                answer.choices.clear()

            answer.save()

        # ── Process uploaded files ────────────────────────────────────────────
        for key, files in request.FILES.lists():
            if not key.startswith('files_'):
                continue

            # Fix C-1: guard malformed file keys
            try:
                question_id = int(key.split('_')[1])
            except (IndexError, ValueError):
                continue

            question = _get_question_for_attempt(question_id, attempt)

            try:
                answer = Answer.objects.get(attempt=attempt, question=question)
            except Answer.DoesNotExist:
                # Fix H-1: create placeholder with choice=None — do NOT auto-select
                # the first choice as that silently corrupts the user's score.
                answer = Answer.objects.create(
                    attempt=attempt,
                    question=question,
                    choice=None,
                )

            for file in files:
                if file.size <= 10 * 1024 * 1024:   # 10 MB limit
                    UserDocument.objects.create(
                        answer=answer,
                        title=file.name,
                        file=file,
                        file_size=file.size,
                    )

        # Return JSON progress save
        if is_ajax:
            return JsonResponse({
                'success': True,
                'message': 'Progress saved successfully',
                'answered_count': attempt.answers.count(),
            })

        # Fix C-4: complete + score in one atomic block — a mid-flight crash
        # can no longer leave is_completed=True with zeroed / stale scores.
        with transaction.atomic():
            attempt.is_completed = True
            attempt.completed_at = timezone.now()
            attempt.save(update_fields=['is_completed', 'completed_at'])
            attempt.calculate_scores(save=True)

        return redirect('questionnaire_result', attempt_id=attempt.id)

    # GET — build pre-populated answer map for the template
    # Fix M-1: prefetch choices + documents to avoid one DB query per answer.
    existing_answers = {}
    existing_answers_multiple = {}
    existing_documents = {}

    for answer in attempt.answers.prefetch_related('choices', 'documents').all():
        if answer.question.allow_multiple:
            existing_answers_multiple[answer.question.id] = list(
                answer.choices.values_list('id', flat=True)
            )
        else:
            if answer.choice:
                existing_answers[answer.question.id] = answer.choice.id

        docs = list(answer.documents.all())   # hits prefetch cache
        if docs:
            existing_documents[answer.question.id] = docs

    return render(request, 'questionnaire/questionnaire.html', {
        'attempt':   attempt,
        'categories': categories,
        'existing_answers': existing_answers,
        'existing_answers_multiple': existing_answers_multiple,
        'existing_documents': existing_documents,
    })


@login_required
def questionnaire_result(request, attempt_id):
    attempt = get_object_or_404(QuestionnaireAttempt, id=attempt_id, user=request.user)

    # Fix M-2 / H-03: use `is not None` so a legitimate score of 0 isn't
    # treated as "not yet calculated" and doesn't needlessly re-run scoring.
    # The old `if attempt.total_score:` was falsy for 0, causing unnecessary
    # recalculation for attempts that genuinely scored zero.
    if attempt.is_completed and attempt.total_score is not None:
        scores = attempt.get_category_breakdown()
    else:
        scores = attempt.calculate_scores()

    from reports.models import Report
    report, _ = Report.objects.get_or_create(
        attempt=attempt,
        defaults={'generated_at': timezone.now()}
    )

    # Fix H-5: use len() on the prefetched relation, NOT .count() — .count()
    # always fires a SQL COUNT query and completely bypasses the prefetch cache,
    # producing one extra query per answer (N+1 with 184 Qs in GRI survey).
    documents_count = sum(
        len(answer.documents.all())
        for answer in attempt.answers.prefetch_related('documents').all()
    )
    attempt.documents_count = documents_count

    context = {
        'attempt': attempt,
        'scores': scores,
        'report': report,
        'recommendations': attempt.get_recommendations(),
        'documents_count': documents_count,
    }

    return render(request, 'questionnaire/result.html', context)


# Fix C-5: @login_required is now the outermost decorator so authentication
# runs BEFORE the CSRF exemption.  The previous order (@login_required inner,
# @csrf_exempt outer) allowed cross-site POST requests from a logged-in user's
# browser session — a CSRF vulnerability on the upload endpoint.
@login_required
def upload_document(request):
    """AJAX endpoint for uploading user documents."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'})

    try:
        attempt_id    = request.POST.get('attempt_id')
        question_id   = request.POST.get('question_id')
        title         = request.POST.get('title', 'Supporting Document')
        uploaded_file = request.FILES.get('file')

        if not all([attempt_id, question_id, uploaded_file]):
            return JsonResponse({'success': False, 'error': 'Missing required fields'})

        if uploaded_file.size > 10 * 1024 * 1024:
            return JsonResponse({'success': False, 'error': 'File size too large (max 10MB)'})

        allowed_types = {
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/jpg',
            'image/png',
        }
        # Fix C-03: use magic-bytes check when python-magic is installed;
        # fall back to the (spoofable) Content-Type header otherwise.
        if _MAGIC_AVAILABLE:
            header = uploaded_file.read(2048)
            uploaded_file.seek(0)
            detected_mime = _magic.from_buffer(header, mime=True)
            if detected_mime not in allowed_types:
                return JsonResponse({'success': False, 'error': f'File type not supported: {detected_mime}'})
        else:
            if uploaded_file.content_type not in allowed_types:
                return JsonResponse({'success': False, 'error': 'File type not supported'})

        attempt  = get_object_or_404(QuestionnaireAttempt, id=attempt_id, user=request.user)
        question = _get_question_for_attempt(question_id, attempt)

        try:
            answer = Answer.objects.get(attempt=attempt, question=question)
        except Answer.DoesNotExist:
            # Fix H-1: placeholder with choice=None — no silent score corruption.
            answer = Answer.objects.create(
                attempt=attempt,
                question=question,
                choice=None,
            )

        document = UserDocument.objects.create(
            answer=answer,
            title=title or uploaded_file.name,
            file=uploaded_file,
            file_size=uploaded_file.size,
        )

        return JsonResponse({
            'success':     True,
            'document_id': document.id,
            'file_name':   uploaded_file.name,
            'file_size':   document.get_file_size_display(),
            'file_url':    document.file.url if document.file else None,
        })

    except Exception:
        # Fix C-2: never expose raw exception messages (file paths, SQL, stack traces)
        # to the client — log server-side and return a generic safe message.
        logger.exception('upload_document: unexpected error for user=%s', request.user.id)
        return JsonResponse({'success': False, 'error': 'An unexpected error occurred. Please try again.'})


@login_required
def delete_document(request, document_id):
    """Delete an uploaded document owned by the current user."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'})

    try:
        document = get_object_or_404(
            UserDocument, id=document_id,
            answer__attempt__user=request.user,
        )
        document.delete()
        return JsonResponse({'success': True})
    except Exception:
        # Fix C-2: same — log server-side, return generic message to client.
        logger.exception('delete_document: unexpected error for user=%s', request.user.id)
        return JsonResponse({'success': False, 'error': 'An unexpected error occurred. Please try again.'})
