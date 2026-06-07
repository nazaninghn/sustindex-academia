"""
Translate questionnaire text fields to Turkish using deep_translator.

Usage
-----
  python manage.py translate_questionnaire              # translate all missing tr fields
  python manage.py translate_questionnaire --force      # re-translate everything
  python manage.py translate_questionnaire --model question
  python manage.py translate_questionnaire --model choice

Covers Question.text_tr and Choice.text_tr for all GRI surveys.
Skips items that already have a translation (unless --force).
Saves in batches and prints progress.
"""

import re
import time
import logging
from typing import Optional
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

logger = logging.getLogger(__name__)

BATCH_SIZE  = 50    # DB save batch
RATE_DELAY  = 0.25  # seconds between API calls — avoids Google rate-limit

# Fix #17: pre-compiled pattern to strip HTML tags before translation.
# Question.text uses CKEditor RichTextField which may contain <p>, <strong>,
# <br> etc. — passing raw HTML to the translator produces garbled output.
_HTML_TAG_RE = re.compile(r'<[^>]+>')


def _strip_html(html: str) -> str:
    """Remove HTML tags and collapse whitespace — returns plain text."""
    text = _HTML_TAG_RE.sub(' ', html)
    return ' '.join(text.split())


# Fix #15: `str | None` union syntax requires Python ≥ 3.10.
# Use typing.Optional for compatibility with Python 3.8/3.9.
def _translate(text: str) -> Optional[str]:
    """Translate English text to Turkish. Returns None on failure."""
    try:
        from deep_translator import GoogleTranslator
        text = text.strip()
        if not text:
            return None
        translated = GoogleTranslator(source='en', target='tr').translate(text)
        return translated or None
    except Exception as exc:
        logger.warning('Translation failed: %s', exc)
        return None


class Command(BaseCommand):
    help = 'Translate questionnaire questions/choices to Turkish (fills empty text_tr).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force', action='store_true',
            help='Re-translate even if text_tr is already set.'
        )
        parser.add_argument(
            '--model', choices=['question', 'choice', 'all'], default='all',
            help='Which model to translate (default: all).'
        )
        parser.add_argument(
            '--survey', type=str, default='GRI',
            help='Survey name prefix filter (default: GRI).'
        )

    def handle(self, *args, **options):
        try:
            from deep_translator import GoogleTranslator  # noqa: F401
        except ImportError:
            raise CommandError('deep_translator not installed. Run: pip install deep-translator')

        force  = options['force']
        model  = options['model']
        survey = options['survey']

        if model in ('question', 'all'):
            self._translate_questions(force, survey)
        if model in ('choice', 'all'):
            self._translate_choices(force, survey)

        self.stdout.write(self.style.SUCCESS('[DONE] Translation complete.'))

    # ── Questions ──────────────────────────────────────────────────────────

    def _translate_questions(self, force: bool, survey_prefix: str):
        from questionnaire.models import Question

        qs = Question.objects.filter(survey__name__startswith=survey_prefix)
        if not force:
            qs = qs.filter(text_tr='')

        total = qs.count()
        self.stdout.write(f'\n[Questions] {total} to translate...')
        if total == 0:
            return

        done = skip = fail = 0
        batch = []

        for q in qs.iterator():
            # Fix #17: strip HTML tags before translating — Question.text is a
            # RichTextField that may contain <p>/<strong>/<br> markup which
            # confuses the translator and produces garbled output.
            raw = (q.text_en or q.text or '').strip()
            source = _strip_html(raw) if raw else ''
            if not source:
                skip += 1
                continue

            translated = _translate(source)
            time.sleep(RATE_DELAY)

            if translated:
                q.text_tr = translated
                batch.append(q)
                done += 1
            else:
                fail += 1

            if len(batch) >= BATCH_SIZE:
                Question.objects.bulk_update(batch, ['text_tr'])
                batch.clear()
                self.stdout.write(f'  ... {done} done, {fail} failed, {skip} skipped')

        if batch:
            Question.objects.bulk_update(batch, ['text_tr'])

        self.stdout.write(
            f'  [Questions] Done={done}  Failed={fail}  Skipped={skip}  Total={total}'
        )

    # ── Choices ────────────────────────────────────────────────────────────

    def _translate_choices(self, force: bool, survey_prefix: str):
        from questionnaire.models import Choice

        qs = Choice.objects.filter(question__survey__name__startswith=survey_prefix)
        if not force:
            qs = qs.filter(text_tr='')

        total = qs.count()
        self.stdout.write(f'\n[Choices]   {total} to translate...')
        if total == 0:
            return

        done = skip = fail = 0
        batch = []

        for c in qs.iterator():
            # Choices use CharField (no HTML), but still strip just in case.
            raw = (c.text_en or c.text or '').strip()
            source = _strip_html(raw) if raw else ''
            if not source:
                skip += 1
                continue

            translated = _translate(source)
            time.sleep(RATE_DELAY)

            if translated:
                c.text_tr = translated
                batch.append(c)
                done += 1
            else:
                fail += 1

            if len(batch) >= BATCH_SIZE:
                Choice.objects.bulk_update(batch, ['text_tr'])
                batch.clear()
                self.stdout.write(f'  ... {done} done, {fail} failed, {skip} skipped')

        if batch:
            Choice.objects.bulk_update(batch, ['text_tr'])

        self.stdout.write(
            f'  [Choices]   Done={done}  Failed={fail}  Skipped={skip}  Total={total}'
        )
