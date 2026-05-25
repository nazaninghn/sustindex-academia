"""
Auto-translation signals for questionnaire models.

Fix H (Round 3): lazy import guarded by _TRANSLATOR_AVAILABLE flag.
Fix M (Round 4): moved from pre_save → post_save + transaction.on_commit so the
  network call never runs inside an open DB transaction.  The actual HTTP request
  is dispatched to a daemon thread so it cannot block the web worker either.
  Changed-field detection avoids re-translating text that hasn't changed.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
import threading
import logging

# Fix H: lazy import — don't crash app startup if deep_translator is absent
try:
    from deep_translator import GoogleTranslator as _GoogleTranslator
    _TRANSLATOR_AVAILABLE = True
except ImportError:           # pragma: no cover
    _GoogleTranslator = None  # type: ignore
    _TRANSLATOR_AVAILABLE = False

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Low-level translate helper
# ──────────────────────────────────────────────────────────────

def translate_text(text, source='en', target='tr'):
    """
    Translate *text* and return the result, or None on any failure.
    Strips HTML tags before sending to the API and re-wraps <p>…</p> if present.
    """
    if not _TRANSLATOR_AVAILABLE:
        return None
    try:
        import re
        clean_text = re.sub('<[^<]+?>', '', text).strip()
        if not clean_text:
            return None

        translator = _GoogleTranslator(source=source, target=target)
        translated = translator.translate(clean_text)

        if text.startswith('<p>') and text.endswith('</p>'):
            return f'<p>{translated}</p>'
        return translated
    except Exception as exc:
        logger.warning('Translation failed (%s→%s): %s', source, target, exc)
        return None


# ──────────────────────────────────────────────────────────────
# Background worker
# ──────────────────────────────────────────────────────────────

def _run_translation_in_background(model_class, pk, fields_to_translate):
    """
    Called from a daemon thread after the DB transaction commits.
    `fields_to_translate` is a list of (target_field, source_text, source_lang, target_lang).
    """
    def _worker():
        try:
            instance = model_class.objects.get(pk=pk)
        except model_class.DoesNotExist:
            return  # Deleted between commit and thread execution — safe to skip.

        changed_fields = []
        for target_field, source_text, source_lang, target_lang in fields_to_translate:
            # Re-check: another save may have filled the field already.
            if getattr(instance, target_field, None):
                continue
            translated = translate_text(source_text, source=source_lang, target=target_lang)
            if translated:
                setattr(instance, target_field, translated)
                changed_fields.append(target_field)
                logger.info('Auto-translated %s.%s (pk=%s)', model_class.__name__, target_field, pk)

        if changed_fields:
            # Fix M: skip validation so bulk_create paths aren't blocked.
            instance.save(update_fields=changed_fields, skip_validation=True)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def _schedule_translation(model_class, pk, fields_to_translate):
    """
    Register the background translation to fire after the current transaction
    commits (transaction.on_commit).  If there is no active transaction the
    callback runs immediately — still in the thread pool.
    """
    if not _TRANSLATOR_AVAILABLE or not fields_to_translate:
        return
    transaction.on_commit(
        lambda: _run_translation_in_background(model_class, pk, fields_to_translate)
    )


# ──────────────────────────────────────────────────────────────
# Helpers to build the "fields to translate" list
# ──────────────────────────────────────────────────────────────

def _needs(instance, target_field):
    """Return True if the target field is blank — i.e., translation is needed."""
    return not getattr(instance, target_field, None)


def _bilingual_fields(instance, pairs):
    """
    `pairs` is a list of (en_field, tr_field).
    Returns [(target_field, source_text, source_lang, target_lang)] for any
    combination where one side is filled and the other is empty.
    """
    jobs = []
    for en_field, tr_field in pairs:
        en_val = getattr(instance, en_field, None)
        tr_val = getattr(instance, tr_field, None)
        if en_val and not tr_val:
            jobs.append((tr_field, en_val, 'en', 'tr'))
        elif tr_val and not en_val:
            jobs.append((en_field, tr_val, 'tr', 'en'))
    return jobs


# ──────────────────────────────────────────────────────────────
# Signals
# ──────────────────────────────────────────────────────────────

def _ensure_default_text(instance, field, *fallbacks):
    """Set `field` to the first non-blank fallback value, in-place."""
    if not getattr(instance, field, None):
        for f in fallbacks:
            val = getattr(instance, f, None)
            if val:
                setattr(instance, field, val)
                break


@receiver(post_save, sender='questionnaire.Survey')
def auto_translate_survey(sender, instance, **kwargs):
    """Auto-translate survey name and description after the row is saved."""
    jobs = _bilingual_fields(instance, [
        ('name_en', 'name_tr'),
        ('description_en', 'description_tr'),
    ])
    _schedule_translation(sender, instance.pk, jobs)


@receiver(post_save, sender='questionnaire.Category')
def auto_translate_category(sender, instance, **kwargs):
    jobs = _bilingual_fields(instance, [
        ('name_en', 'name_tr'),
        ('description_en', 'description_tr'),
    ])
    _schedule_translation(sender, instance.pk, jobs)


@receiver(post_save, sender='questionnaire.Question')
def auto_translate_question(sender, instance, **kwargs):
    jobs = _bilingual_fields(instance, [('text_en', 'text_tr')])
    _schedule_translation(sender, instance.pk, jobs)


@receiver(post_save, sender='questionnaire.Choice')
def auto_translate_choice(sender, instance, **kwargs):
    jobs = _bilingual_fields(instance, [('text_en', 'text_tr')])
    _schedule_translation(sender, instance.pk, jobs)
