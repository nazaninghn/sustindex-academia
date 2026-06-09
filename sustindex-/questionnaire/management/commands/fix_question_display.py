"""
fix_question_display.py
────────────────────────
1. Updates Q1 (G1-P, the first Governance question) to the exact text
   and scores specified by the project owner:

   Turkish question: "Sürdürülebilirlik / ESG, YK charter veya görev
                      tanımında yer alıyor mu?"
   A → 4  | B → 3  | C → 1  | D → 0

2. Strips technical prefixes/suffixes from ALL question text_tr:
   "[G1-P] ... [Politika ve Taahhüt]"  →  "... "

3. Strips letter prefixes ("A. ", "B. ", "C. ", "D. ", "A: " …) from ALL
   choice text and text_tr so the label in the UI is not shown twice.

Usage:
    python manage.py fix_question_display           # dry-run
    python manage.py fix_question_display --apply   # persist
"""
import re
from django.core.management.base import BaseCommand
from questionnaire.models import Question, Choice


# ── Q1 (G1-P) override ────────────────────────────────────────────────────
G1P_QUESTION_ID = 262          # Q#262 in GRI: Governance & Strategy survey

G1P_NEW_TEXT_TR = (
    "Sürdürülebilirlik / ESG, YK charter veya görev tanımında yer alıyor mu?"
)

# Keyed by choice order (1=A, 2=B, 3=C, 4=D)
G1P_CHOICES = {
    1: {
        "text_tr": "Ayrı Sürdürülebilirlik Komitesi charter'ı var ve kamuya açık",
        "score": 4,
    },
    2: {
        "text_tr": "Mevcut komite görev tanımında ESG açıkça yer alıyor",
        "score": 3,
    },
    3: {
        "text_tr": "Genel YK tüzüğünde kısa bir ifade var",
        "score": 1,
    },
    4: {
        "text_tr": "Hiçbir belgede yer almıyor",
        "score": 0,
    },
}

# ── Regex helpers ─────────────────────────────────────────────────────────
# Matches "[G1-P] " or "[G1-P]  " at the start of question text
_Q_PREFIX_RE = re.compile(r'^\[[A-Z]+\d+[-–][A-Z]+\]\s*', re.UNICODE)
# Matches "  [Policy & Commitment]" or "  [Politika ve …]" at the END
_Q_SUFFIX_RE = re.compile(r'\s+\[[^\]]+\]\s*$', re.UNICODE)
# Matches "A. ", "A: ", "B. ", "B: " … at the start of choice text
_C_PREFIX_RE = re.compile(r'^[A-D][.:\s]\s*', re.UNICODE)


def clean_question_text(txt: str) -> str:
    txt = _Q_PREFIX_RE.sub('', txt)
    txt = _Q_SUFFIX_RE.sub('', txt)
    return txt.strip()


def clean_choice_text(txt: str) -> str:
    return _C_PREFIX_RE.sub('', txt).strip()


class Command(BaseCommand):
    help = (
        'Fix question display: update G1-P text/scores and strip '
        'technical prefixes from all questions and choices.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            default=False,
            help='Save changes to database (default: dry-run)',
        )

    def handle(self, *args, **options):
        apply = options['apply']
        mode  = 'APPLY' if apply else 'DRY-RUN'
        self.stdout.write(f'\n=== fix_question_display [{mode}] ===\n')

        q_changes   = 0
        c_changes   = 0

        # ── 1. Update G1-P specifically ───────────────────────────────────
        self.stdout.write('--- G1-P specific update ---')
        try:
            g1p = Question.objects.get(pk=G1P_QUESTION_ID)
            if g1p.text_tr != G1P_NEW_TEXT_TR:
                self.stdout.write(
                    f'  Q#{g1p.id} text_tr:\n'
                    f'    BEFORE: {g1p.text_tr[:100]}\n'
                    f'    AFTER:  {G1P_NEW_TEXT_TR}\n'
                )
                if apply:
                    g1p.text_tr = G1P_NEW_TEXT_TR
                    g1p.save(update_fields=['text_tr'])
                q_changes += 1

            for choice in g1p.choices.order_by('order'):
                spec = G1P_CHOICES.get(choice.order)
                if not spec:
                    continue
                old_txt   = choice.text_tr or ''
                old_score = choice.score
                new_txt   = spec['text_tr']
                new_score = spec['score']
                if old_txt != new_txt or old_score != new_score:
                    self.stdout.write(
                        f'  Choice[order={choice.order}]:\n'
                        f'    text_tr: {old_txt[:80]!r}\n'
                        f'          -> {new_txt!r}\n'
                        f'    score:   {old_score} -> {new_score}\n'
                    )
                    if apply:
                        choice.text_tr = new_txt
                        choice.score   = new_score
                        choice.save(update_fields=['text_tr', 'score'])
                    c_changes += 1

        except Question.DoesNotExist:
            self.stderr.write(
                self.style.ERROR(f'  Q#{G1P_QUESTION_ID} not found — skipping G1-P update')
            )

        # ── 2. Strip prefixes from ALL questions (text_tr) ─────────────────
        self.stdout.write('\n--- Stripping prefixes from all question text_tr ---')
        for q in Question.objects.filter(is_active=True).only('id', 'text_tr'):
            if not q.text_tr:
                continue
            cleaned = clean_question_text(q.text_tr)
            if cleaned != q.text_tr:
                self.stdout.write(
                    f'  Q#{q.id}: {q.text_tr[:80]!r}\n'
                    f'        -> {cleaned[:80]!r}\n'
                )
                if apply:
                    q.text_tr = cleaned
                    q.save(update_fields=['text_tr'])
                q_changes += 1

        # ── 3. Strip letter prefixes from ALL choices (text + text_tr) ────
        self.stdout.write('\n--- Stripping letter prefixes from all choice texts ---')
        for c in Choice.objects.only('id', 'text', 'text_tr'):
            changed = False
            new_text    = clean_choice_text(c.text)    if c.text    else c.text
            new_text_tr = clean_choice_text(c.text_tr) if c.text_tr else c.text_tr

            if new_text != c.text:
                self.stdout.write(
                    f'  Choice#{c.id} text EN: {c.text[:60]!r} -> {new_text[:60]!r}'
                )
                changed = True
            if new_text_tr != c.text_tr:
                self.stdout.write(
                    f'  Choice#{c.id} text TR: {(c.text_tr or "")[:60]!r} -> {new_text_tr[:60]!r}'
                )
                changed = True

            if changed:
                c_changes += 1
                if apply:
                    update_f = []
                    if new_text != c.text:
                        c.text = new_text
                        update_f.append('text')
                    if new_text_tr != c.text_tr:
                        c.text_tr = new_text_tr
                        update_f.append('text_tr')
                    if update_f:
                        c.save(update_fields=update_f)

        # ── Summary ──────────────────────────────────────────────────────
        self.stdout.write('\n' + '-' * 60)
        if apply:
            self.stdout.write(self.style.SUCCESS(
                f'  Questions updated: {q_changes}\n'
                f'  Choices updated:   {c_changes}\n'
                f'\nDone. All changes saved to database.\n'
            ))
        else:
            self.stdout.write(self.style.WARNING(
                f'  Questions would update: {q_changes}\n'
                f'  Choices would update:   {c_changes}\n'
                f'\nDry-run - run with --apply to save.\n'
            ))
