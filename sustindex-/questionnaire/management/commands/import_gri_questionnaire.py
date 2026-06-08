"""
Import GRI Standards Assessment v4 (Structured) from Excel into the database.

Usage
-----
  python manage.py import_gri_questionnaire "C:/path/to/GRI_Questionnaire_v4_STRUCTURED.xlsx"
  python manage.py import_gri_questionnaire "C:/path/to/file.xlsx" --clear

What it creates
---------------
  11 separate Surveys following the actual GRI Universal Standards hierarchy:

  Core (phased — all companies complete all three):
    - GRI 1: Foundation                   (32 questions,  160 pts max)
    - GRI 2: General Disclosures          (80 questions,  400 pts max)
    - GRI 3: Material Topics              (60 questions,  300 pts max)

  Sector Standards (company picks ONE):
    - GRI Sector: Agriculture & Food      (8 questions)
    - GRI Sector: Energy & Utilities      (8 questions)
    - GRI Sector: Financial Services      (8 questions)
    - GRI Sector: Manufacturing & Industry(8 questions)
    - GRI Sector: Construction & Real Estate (8 questions)
    - GRI Sector: Healthcare & Pharma     (8 questions)
    - GRI Sector: Technology & IT         (8 questions)
    - GRI Sector: Retail & Trade          (8 questions)

The command is fully idempotent: re-running updates existing records.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from questionnaire.models import Survey, Category, Question, Choice


# ── Section config ─────────────────────────────────────────────────────────
# Follows the actual GRI Universal Standards hierarchy:
#   GRI 1 Foundation → GRI 2 General Disclosures → GRI 3 Material Topics
# Phased completion: every company works through all three core phases in order
# before selecting their sector-specific standard.

CORE_SECTIONS = [
    {
        'sheet':         'GRI 1 — Foundation',
        'survey_name':   'GRI 1: Foundation',
        'survey_name_tr':'GRI 1: Temel',
        'survey_desc':   'GRI 1:2021 Foundation — 8 criteria \xd7 4 layers (Policy/Implementation/Measurement/Results) = 32 questions, 160 pts max.',
        'cat_name':      'Foundation',
        'cat_name_tr':   'Temel',
        'max_score':     160,
        'env_w': 0.10, 'soc_w': 0.10, 'gov_w': 0.80,
    },
    {
        'sheet':         'GRI 2 — General Disclosures',
        'survey_name':   'GRI 2: General Disclosures',
        'survey_name_tr':'GRI 2: Genel A\xe7ıklamalar',
        'survey_desc':   'GRI 2:2021 General Disclosures — 20 criteria \xd7 4 layers = 80 questions, 400 pts max.',
        'cat_name':      'General Disclosures',
        'cat_name_tr':   'Genel A\xe7ıklamalar',
        'max_score':     400,
        'env_w': 0.15, 'soc_w': 0.15, 'gov_w': 0.70,
    },
    {
        'sheet':         'GRI 3 — Material Topics',
        'survey_name':   'GRI 3: Material Topics',
        'survey_name_tr':'GRI 3: \xd6nemli Konular',
        'survey_desc':   'GRI 3:2021 Material Topics — 15 criteria \xd7 4 layers = 60 questions, 300 pts max.',
        'cat_name':      'Material Topics',
        'cat_name_tr':   '\xd6nemli Konular',
        'max_score':     300,
        'env_w': 0.33, 'soc_w': 0.34, 'gov_w': 0.33,
    },
]

SECTOR_SECTIONS = [
    {
        'sheet':         'Sector — Agriculture & Food',
        'survey_name':   'GRI Sector: Agriculture & Food',
        'survey_name_tr':'GRI Sektor: Tarim & Gida',
        'survey_desc':   'GRI 13 — 8 sector-specific questions.',
        'cat_name':      'Agriculture & Food',
        'cat_name_tr':   'Tarim & Gida',
    },
    {
        'sheet':         'Sector — Energy & Utilities',
        'survey_name':   'GRI Sector: Energy & Utilities',
        'survey_name_tr':'GRI Sektor: Enerji & Hizmetler',
        'survey_desc':   'GRI 11 — 8 sector-specific questions.',
        'cat_name':      'Energy & Utilities',
        'cat_name_tr':   'Enerji & Hizmetler',
    },
    {
        'sheet':         'Sector — Financial Services',
        'survey_name':   'GRI Sector: Financial Services',
        'survey_name_tr':'GRI Sektor: Finansal Hizmetler',
        'survey_desc':   'PCAF / TCFD / GRI 14 — 8 sector-specific questions.',
        'cat_name':      'Financial Services',
        'cat_name_tr':   'Finansal Hizmetler',
    },
    {
        'sheet':         'Sector — Manufacturing & Indust',
        'survey_name':   'GRI Sector: Manufacturing & Industry',
        'survey_name_tr':'GRI Sektor: Imalat & Sanayi',
        'survey_desc':   'GRI 300 series — 8 sector-specific questions.',
        'cat_name':      'Manufacturing & Industry',
        'cat_name_tr':   'Imalat & Sanayi',
    },
    {
        'sheet':         'Sector — Construction & Real Es',
        'survey_name':   'GRI Sector: Construction & Real Estate',
        'survey_name_tr':'GRI Sektor: Insaat & Gayrimenkul',
        'survey_desc':   'GRESB / GRI 300 — 8 sector-specific questions.',
        'cat_name':      'Construction & Real Estate',
        'cat_name_tr':   'Insaat & Gayrimenkul',
    },
    {
        'sheet':         'Sector — Healthcare & Pharma',
        'survey_name':   'GRI Sector: Healthcare & Pharma',
        'survey_name_tr':'GRI Sektor: Saglik & Ilac',
        'survey_desc':   'IFPMA / GRI 400 — 8 sector-specific questions.',
        'cat_name':      'Healthcare & Pharma',
        'cat_name_tr':   'Saglik & Ilac',
    },
    {
        'sheet':         'Sector — Technology & IT',
        'survey_name':   'GRI Sector: Technology & IT',
        'survey_name_tr':'GRI Sektor: Teknoloji & BT',
        'survey_desc':   'GRI 418 / TCFD — 8 sector-specific questions.',
        'cat_name':      'Technology & IT',
        'cat_name_tr':   'Teknoloji & BT',
    },
    {
        'sheet':         'Sector — Retail & Trade',
        'survey_name':   'GRI Sector: Retail & Trade',
        'survey_name_tr':'GRI Sektor: Perakende & Ticaret',
        'survey_desc':   'GRI 300/400 series — 8 sector-specific questions.',
        'cat_name':      'Retail & Trade',
        'cat_name_tr':   'Perakende & Ticaret',
    },
]

LETTER_ORDER = {'A': 1, 'B': 2, 'C': 3, 'D': 4}


# ── Helpers ────────────────────────────────────────────────────────────────

def _s(v):
    if v is None: return ''
    return str(v).strip()

def _n(v, d=0):
    # Fix L-5: bare except: catches SystemExit/KeyboardInterrupt — use specific types.
    try: return int(float(v))
    except (TypeError, ValueError): return d

def _find_header(ws, col_b_val):
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=20, values_only=True), 1):
        if _s(row[1]) == col_b_val:
            return i
    return None


# ══════════════════════════════════════════════════════════════════════════
class Command(BaseCommand):
    help = 'Import GRI v3 Excel — creates one Survey per section (12 total).'

    def add_arguments(self, parser):
        parser.add_argument('excel_path', type=str)
        parser.add_argument('--clear', action='store_true',
                            help='Delete all existing GRI surveys first')

    @transaction.atomic
    def handle(self, *args, **options):
        try:
            import openpyxl
        except ImportError:
            raise CommandError('openpyxl not installed. Run: pip install openpyxl==3.1.2')

        path = options['excel_path']
        self.stdout.write(f'[GRI] Loading: {path}')
        try:
            wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
        except FileNotFoundError:
            raise CommandError(f'File not found: {path}')
        except Exception as e:
            raise CommandError(f'Cannot open file: {e}')

        # Fix CRASH-01: always close the read-only workbook before the process
        # exits.  openpyxl's read_only mode keeps a ZipFile (and its underlying
        # I/O threads) open for the entire workbook lifetime.  Without an
        # explicit close(), Python's garbage collector tries to finalize the
        # ZipFile during interpreter shutdown, which races against the Kerberos
        # pthread mutex teardown on Render's Linux image and triggers the
        # "k5_mutex_lock: Assertion `r == 0' failed" abort (core dump).
        # Wrapping the entire body in try/finally guarantees wb.close() is
        # called even when an exception is raised mid-import.
        try:
            # -- Optional clear --
            if options['clear']:
                n, _ = Survey.objects.filter(name__istartswith='GRI').delete()
                self.stdout.write(self.style.WARNING(f'  [!] Deleted {n} existing GRI surveys.'))

            total_surveys = total_q = total_c = 0

            # -- Core sections --
            self.stdout.write('\n-- Core sections -------------------------------------------')
            for cfg in CORE_SECTIONS:
                if cfg['sheet'] not in wb.sheetnames:
                    self.stdout.write(self.style.ERROR(f'  [X] Sheet missing: {cfg["sheet"]}'))
                    continue

                survey = self._upsert_survey(
                    cfg['survey_name'], cfg['survey_name_tr'], cfg['survey_desc']
                )
                cat = self._upsert_category(
                    survey, cfg['cat_name'], cfg['cat_name_tr'],
                    order=1,
                    max_score=cfg['max_score'],
                    env_w=cfg['env_w'], soc_w=cfg['soc_w'], gov_w=cfg['gov_w'],
                )
                questions = self._parse_core(wb[cfg['sheet']])
                q, c = self._persist(questions, survey, cat)
                self._fix_score_anomalies(survey)
                total_surveys += 1; total_q += q; total_c += c
                self.stdout.write(f'  [OK] {cfg["survey_name"]:<45} {q:>3}Q  {c:>4}C')

            # -- Sector modules --
            self.stdout.write('\n-- Sector modules ------------------------------------------')
            for cfg in SECTOR_SECTIONS:
                if cfg['sheet'] not in wb.sheetnames:
                    self.stdout.write(self.style.WARNING(f'  [!] Sheet missing: {cfg["sheet"]}'))
                    continue

                survey = self._upsert_survey(
                    cfg['survey_name'], cfg['survey_name_tr'], cfg['survey_desc']
                )
                cat = self._upsert_category(
                    survey, cfg['cat_name'], cfg['cat_name_tr'],
                    order=1, max_score=80,
                    env_w=0.34, soc_w=0.33, gov_w=0.33,
                )
                questions = self._parse_sector(wb[cfg['sheet']])
                q, c = self._persist(questions, survey, cat)
                total_surveys += 1; total_q += q; total_c += c
                self.stdout.write(f'  [OK] {cfg["survey_name"]:<45} {q:>3}Q  {c:>4}C')

            self.stdout.write(self.style.SUCCESS(
                f'\n[DONE] {total_surveys} surveys, {total_q} questions, {total_c} choices imported.\n'
            ))
        finally:
            wb.close()

    # ── Survey / Category upsert ───────────────────────────────────────────

    def _upsert_survey(self, name, name_tr, desc):
        survey, _ = Survey.objects.update_or_create(
            name=name,
            defaults={
                'name_en': name,
                'name_tr': name_tr,
                'description': desc,
                'description_en': desc,
                'description_tr': desc,
                'is_active': True,
                'allow_multiple_attempts': True,
                'show_results_immediately': True,
            }
        )
        return survey

    def _upsert_category(self, survey, name, name_tr, order,
                         max_score, env_w, soc_w, gov_w):
        cat, _ = Category.objects.update_or_create(
            survey=survey, name=name,
            defaults={
                'name_en': name, 'name_tr': name_tr,
                'order': order, 'max_score': max_score,
                'environmental_weight': env_w,
                'social_weight': soc_w,
                'governance_weight': gov_w,
            }
        )
        return cat

    # ── Parsers ────────────────────────────────────────────────────────────

    def _parse_core(self, ws):
        hr = _find_header(ws, 'ID')
        if not hr: return {}
        questions = {}
        cur_id = None
        order = 0
        for row in ws.iter_rows(min_row=hr + 1, values_only=True):
            p = list(row) + [None] * 12
            q_id, layer_name, q_text, option, pts = _s(p[1]), _s(p[3]), _s(p[5]), _s(p[7]), _n(p[8])
            if not option or option[0] not in ('A', 'B', 'C', 'D'):
                continue
            if q_id and q_id not in ('ID', '#'):
                if q_id not in questions:
                    order += 1
                    # Store clean question text: no [q_id] code prefix.
                    # The layer name is appended in brackets so GRI assessors
                    # can identify which Policy/Implementation/Measurement/Results
                    # layer the question belongs to.  The frontend strips both
                    # the code prefix (already removed here) and the layer suffix
                    # via cleanQuestionText() when rendering to end users.
                    label = q_text if q_text else q_id
                    if layer_name:
                        label = f'{label}  [{layer_name}]'
                    questions[q_id] = {'text': label, 'order': order, 'choices': []}
                cur_id = q_id
            if cur_id and cur_id in questions:
                questions[cur_id]['choices'].append({
                    'text': option, 'score': pts,
                    'order': LETTER_ORDER.get(option[0], 99)
                })
        return questions

    def _parse_sector(self, ws):
        hr = _find_header(ws, 'Q ID')
        if not hr: return {}
        questions = {}
        cur_id = None
        order = 0
        for row in ws.iter_rows(min_row=hr + 1, values_only=True):
            p = list(row) + [None] * 12
            q_id, cat_nm, option, pts = _s(p[1]), _s(p[2]), _s(p[5]), _n(p[6])
            if not option or option[0] not in ('A', 'B', 'C', 'D'):
                continue
            if q_id and q_id not in ('Q ID', '#'):
                if q_id not in questions:
                    order += 1
                    questions[q_id] = {
                        'text': f'[{q_id}]  {cat_nm if cat_nm else q_id}',
                        'order': order, 'choices': []
                    }
                cur_id = q_id
            if cur_id and cur_id in questions:
                questions[cur_id]['choices'].append({
                    'text': option, 'score': pts,
                    'order': LETTER_ORDER.get(option[0], 99)
                })
        return questions

    # ── Persist ────────────────────────────────────────────────────────────

    def _persist(self, questions, survey, category):
        q_count = c_count = 0
        for data in questions.values():
            if not data['choices']:
                continue
            q, new_q = Question.objects.update_or_create(
                survey=survey, category=category, order=data['order'],
                defaults={
                    'text': data['text'], 'text_en': data['text'], 'text_tr': '',
                    'question_type': 'choice', 'is_active': True, 'allow_multiple': False,
                }
            )
            if new_q: q_count += 1
            for ch in sorted(data['choices'], key=lambda x: x['order']):
                _, new_c = Choice.objects.update_or_create(
                    question=q, order=ch['order'],
                    defaults={'text': ch['text'], 'text_en': ch['text'], 'text_tr': '', 'score': ch['score']}
                )
                if new_c: c_count += 1
        return q_count, c_count

    # ── Fix score ordering anomalies ───────────────────────────────────────

    def _fix_score_anomalies(self, survey):
        """Ensure choice scores descend strictly A ≥ B ≥ C ≥ D.

        Re-sorts the scores in descending order across all choices (ordered
        by the LETTER_ORDER key: A=1, B=2, C=3, D=4) so that the best
        answer (A) always carries the highest score and the worst (D) the
        lowest.  The old implementation only swapped A and B, missing
        anomalies like C > B or D > C.
        """
        fixed = 0
        for q in Question.objects.filter(survey=survey).prefetch_related('choices'):
            # Sort choices by their display order (A=1, B=2, …)
            ordered = sorted(q.choices.all(), key=lambda c: c.order)
            if len(ordered) < 2:
                continue
            original = [c.score for c in ordered]
            corrected = sorted(original, reverse=True)   # A gets max, D gets min
            if original != corrected:
                for choice, new_score in zip(ordered, corrected):
                    if choice.score != new_score:
                        Choice.objects.filter(pk=choice.pk).update(score=new_score)
                fixed += 1
        return fixed
