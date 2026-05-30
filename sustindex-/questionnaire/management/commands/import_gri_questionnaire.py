"""
Import GRI Standards Competency Assessment v3 from Excel into the database.

Usage
-----
  python manage.py import_gri_questionnaire "C:/path/to/GRI_Questionnaire_v3_FIXED.xlsx"
  python manage.py import_gri_questionnaire "C:/path/to/file.xlsx" --clear

What it creates
---------------
  1 Survey  ── "GRI Standards Competency Assessment v3"
  4 core Categories  (Governance, Environmental, Social, Economic)
  8 sector Categories  (Agriculture, Energy, Finance, Manufacturing, …)
  184 core Questions  (46 criteria × 4 PDCA layers)
  64 sector Questions  (8 sectors × 8 questions)
  988 Choices total  (4 per question)

The command is fully idempotent: re-running it updates existing records
rather than creating duplicates (uses update_or_create throughout).
"""

import re
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from questionnaire.models import Survey, Category, Question, Choice


# ── Section configuration ──────────────────────────────────────────────────

CORE_SECTIONS = [
    {
        'sheet':        'Governance & Strategy',
        'name_en':      'Governance & Strategy',
        'name_tr':      'Yönetişim & Strateji',
        'order':        1,
        'max_score':    280,   # 14 criteria × 20 pts
        'env_w':  0.0,
        'soc_w':  0.0,
        'gov_w':  1.0,
    },
    {
        'sheet':        'Environmental Performance',
        'name_en':      'Environmental Performance',
        'name_tr':      'Çevresel Performans',
        'order':        2,
        'max_score':    240,   # 12 criteria × 20 pts
        'env_w':  1.0,
        'soc_w':  0.0,
        'gov_w':  0.0,
    },
    {
        'sheet':        'Social Performance',
        'name_en':      'Social Performance',
        'name_tr':      'Sosyal Performans',
        'order':        3,
        'max_score':    260,   # 13 criteria × 20 pts
        'env_w':  0.0,
        'soc_w':  1.0,
        'gov_w':  0.0,
    },
    {
        'sheet':        'Economic & Reporting',
        'name_en':      'Economic & Reporting',
        'name_tr':      'Ekonomik & Raporlama',
        'order':        4,
        'max_score':    140,   # 7 criteria × 20 pts
        'env_w':  0.0,
        'soc_w':  0.0,
        'gov_w':  1.0,
    },
]

SECTOR_SECTIONS = [
    {
        'sheet':    'Sector — Agriculture & Food',
        'name_en':  'Sector — Agriculture & Food',
        'name_tr':  'Sekt\xf6r — Tarım & Gıda',
        'order':    10,
    },
    {
        'sheet':    'Sector — Energy & Utilities',
        'name_en':  'Sector — Energy & Utilities',
        'name_tr':  'Sekt\xf6r — Enerji & Kamu Hizmetleri',
        'order':    11,
    },
    {
        'sheet':    'Sector — Financial Services',
        'name_en':  'Sector — Financial Services',
        'name_tr':  'Sekt\xf6r — Finansal Hizmetler',
        'order':    12,
    },
    {
        'sheet':    'Sector — Manufacturing & Indust',
        'name_en':  'Sector — Manufacturing & Industry',
        'name_tr':  'Sekt\xf6r — İmalat & Sanayi',
        'order':    13,
    },
    {
        'sheet':    'Sector — Construction & Real Es',
        'name_en':  'Sector — Construction & Real Estate',
        'name_tr':  'Sekt\xf6r — İnşaat & Gayrimenkul',
        'order':    14,
    },
    {
        'sheet':    'Sector — Healthcare & Pharma',
        'name_en':  'Sector — Healthcare & Pharma',
        'name_tr':  'Sekt\xf6r — Sağlık & İla\xe7',
        'order':    15,
    },
    {
        'sheet':    'Sector — Technology & IT',
        'name_en':  'Sector — Technology & IT',
        'name_tr':  'Sekt\xf6r — Teknoloji & BT',
        'order':    16,
    },
    {
        'sheet':    'Sector — Retail & Trade',
        'name_en':  'Sector — Retail & Trade',
        'name_tr':  'Sekt\xf6r — Perakende & Ticaret',
        'order':    17,
    },
]

# A=1, B=2, C=3, D=4
LETTER_ORDER = {'A': 1, 'B': 2, 'C': 3, 'D': 4}


# ── Utility helpers ────────────────────────────────────────────────────────

def _str(v: object) -> str:
    """Return stripped string; '' for None."""
    if v is None:
        return ''
    return str(v).strip()


def _int(v: object, default: int = 0) -> int:
    """Safely cast to int."""
    try:
        return int(float(v))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _find_header_row(ws, col_b_value: str) -> int | None:
    """Return the 1-based row number whose column-B cell equals col_b_value."""
    for idx, row in enumerate(ws.iter_rows(min_row=1, max_row=20, values_only=True), 1):
        if _str(row[1]) == col_b_value:
            return idx
    return None


# ══════════════════════════════════════════════════════════════════════════
#  Management command
# ══════════════════════════════════════════════════════════════════════════

class Command(BaseCommand):
    help = (
        'Import GRI Standards Competency Assessment v3 from an Excel workbook '
        'into Survey / Category / Question / Choice objects.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'excel_path',
            type=str,
            help='Full filesystem path to GRI_Questionnaire_v3_FIXED.xlsx',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing surveys whose name contains "GRI" before importing',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        # ── Dependency check ──────────────────────────────────────────────
        try:
            import openpyxl
        except ImportError:
            raise CommandError(
                'openpyxl is not installed.\n'
                'Run:  pip install openpyxl==3.1.2'
            )

        # ── Open workbook ─────────────────────────────────────────────────
        path = options['excel_path']
        self.stdout.write(f'\n[GRI] Loading workbook: {path}')
        try:
            wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
        except FileNotFoundError:
            raise CommandError(f'File not found: {path}')
        except Exception as exc:
            raise CommandError(f'Cannot open workbook: {exc}')

        # ── Optional clear ────────────────────────────────────────────────
        if options['clear']:
            n, _ = Survey.objects.filter(name__icontains='GRI').delete()
            self.stdout.write(self.style.WARNING(f'  [!] Deleted {n} existing GRI survey(s).'))

        # ── Survey ────────────────────────────────────────────────────────
        SURVEY_NAME = 'GRI Standards Competency Assessment v3'
        survey, created = Survey.objects.get_or_create(
            name=SURVEY_NAME,
            defaults={
                'name_en': SURVEY_NAME,
                'name_tr': 'GRI Standartları Yetkinlik Değerlendirmesi v3',
                'description': (
                    'GRI Standards Competency Assessment — v3 Full Platform. '
                    'PDCA × 4 layers | Dynamic sector weights | 15 cross-check flags | '
                    '8 sector modules | Aligned: GRI 2021, TCFD, CSRD/ESRS, ISSB S1/S2, '
                    'SBTi, PCAF, TNFD, UNGP. 46 core criteria × 20 pts = 920 pts max.'
                ),
                'description_en': (
                    'GRI Standards Competency Assessment — v3 Full Platform. '
                    'PDCA × 4 layers | Dynamic sector weights | 15 cross-check flags | '
                    '8 sector modules | Aligned: GRI 2021, TCFD, CSRD/ESRS, ISSB S1/S2, '
                    'SBTi, PCAF, TNFD, UNGP. 46 core criteria × 20 pts = 920 pts max.'
                ),
                'description_tr': (
                    'GRI Standartları Yetkinlik Değerlendirmesi — v3 Tam Platform. '
                    'PDCA × 4 katman | Dinamik sektör ağırlıkları | 15 çapraz kontrol bayrağı | '
                    '8 sektör modülü | GRI 2021, TCFD, CSRD/ESRS, ISSB S1/S2, SBTi, PCAF, '
                    'TNFD, UNGP ile uyumlu. 46 temel kriter × 20 puan = 920 puan maks.'
                ),
                'is_active': True,
                'allow_multiple_attempts': True,
                'show_results_immediately': True,
            },
        )
        verb = 'Created' if created else 'Found existing'
        self.stdout.write(self.style.SUCCESS(f'  [OK] {verb} survey: "{SURVEY_NAME}"'))

        total_q = total_c = 0

        # ── Core sections ─────────────────────────────────────────────────
        self.stdout.write('\n-- Core sections -------------------------------------------')
        for cfg in CORE_SECTIONS:
            sheet_name = cfg['sheet']
            if sheet_name not in wb.sheetnames:
                self.stdout.write(self.style.ERROR(f'  [X] Sheet not found: "{sheet_name}"'))
                continue

            cat = self._upsert_category(
                survey=survey,
                name_en=cfg['name_en'],
                name_tr=cfg['name_tr'],
                order=cfg['order'],
                max_score=cfg['max_score'],
                env_w=cfg['env_w'],
                soc_w=cfg['soc_w'],
                gov_w=cfg['gov_w'],
            )
            q, c = self._import_core_sheet(wb[sheet_name], survey, cat)
            total_q += q
            total_c += c
            self.stdout.write(f'  [core] {sheet_name:<35}  {q:>3} questions  {c:>4} choices')

        # ── Sector modules ────────────────────────────────────────────────
        self.stdout.write('\n-- Sector modules ------------------------------------------')
        for cfg in SECTOR_SECTIONS:
            sheet_name = cfg['sheet']
            if sheet_name not in wb.sheetnames:
                self.stdout.write(self.style.WARNING(f'  [!] Sector sheet not found: "{sheet_name}"'))
                continue

            cat = self._upsert_category(
                survey=survey,
                name_en=cfg['name_en'],
                name_tr=cfg['name_tr'],
                order=cfg['order'],
                max_score=80,   # 8 questions, variable pts; approximate ceiling
                env_w=0.34,
                soc_w=0.33,
                gov_w=0.33,
            )
            q, c = self._import_sector_sheet(wb[sheet_name], survey, cat)
            total_q += q
            total_c += c
            self.stdout.write(f'  [sector] {sheet_name:<35}  {q:>3} questions  {c:>4} choices')

        self.stdout.write(self.style.SUCCESS(
            f'\n[DONE] Import complete -- {total_q} questions, {total_c} choices.\n'
        ))

    # ── Category upsert ────────────────────────────────────────────────────

    def _upsert_category(
        self, survey, name_en, name_tr, order,
        max_score, env_w, soc_w, gov_w,
    ) -> Category:
        cat, _ = Category.objects.update_or_create(
            survey=survey,
            name=name_en,
            defaults={
                'name_en':              name_en,
                'name_tr':              name_tr,
                'order':                order,
                'max_score':            max_score,
                'environmental_weight': env_w,
                'social_weight':        soc_w,
                'governance_weight':    gov_w,
            },
        )
        return cat

    # ── Core sheet parser ──────────────────────────────────────────────────
    #
    # Column layout (row 5 = header):
    #   A: #   B: ID (G1-P)  C: Layer  D: Layer Name  E: Max Pts
    #   F: Question text      G: GRI Ref
    #   H: Answer Option (full text e.g. "A. Board-level …")
    #   I: Points   J: Required   K: Document Upload   L: Bonus Pts
    #
    # Each sub-question (ID = G1-P, G1-I, …) spans 4 rows (options A–D).
    # Only the first row (option A) has data in cols B–G; B–G are None for B/C/D.

    def _import_core_sheet(self, ws, survey, category):
        header_row = _find_header_row(ws, 'ID')
        if not header_row:
            self.stdout.write(self.style.ERROR('    Cannot locate header row - sheet skipped.'))
            return 0, 0

        # questions dict: q_id → {text, order, choices:[{text, score, order}]}
        questions: dict = {}
        cur_id: str | None = None
        global_order = 0

        for row in ws.iter_rows(min_row=header_row + 1, values_only=True):
            # Unpack 12 columns (pad short rows)
            padded = list(row) + [None] * 12
            (_, col_id, _col_layer, col_layer_name, _col_max,
             col_q_text, col_gri, col_option, col_pts, *_rest) = padded[:12]

            q_id    = _str(col_id)       # e.g. 'G1-P' or '' for B/C/D rows
            option  = _str(col_option)   # e.g. 'A. Board-level…'
            pts     = _int(col_pts)
            q_text  = _str(col_q_text)
            layer_n = _str(col_layer_name)

            # Skip rows without a valid answer-option letter
            if not option or option[0] not in ('A', 'B', 'C', 'D'):
                continue

            # New question block: column B has the question ID
            if q_id and q_id not in ('ID', '#'):
                if q_id not in questions:
                    global_order += 1
                    display = q_text if q_text else q_id
                    if layer_n:
                        display = f'{display}  [{layer_n}]'
                    questions[q_id] = {
                        'text':    f'[{q_id}]  {display}',
                        'order':   global_order,
                        'choices': [],
                    }
                cur_id = q_id

            if cur_id is None or cur_id not in questions:
                continue

            letter = option[0]   # 'A' / 'B' / 'C' / 'D'
            questions[cur_id]['choices'].append({
                'text':  option,                         # "A. Board-level…"
                'score': pts,
                'order': LETTER_ORDER.get(letter, 99),
            })

        return self._persist(questions, survey, category)

    # ── Sector sheet parser ────────────────────────────────────────────────
    #
    # Column layout (row 5 = header):
    #   A: #   B: Q ID (AG-01)   C: Category (criterion label)
    #   D: Question (EMPTY in all data rows)   E: GRI Ref
    #   F: Answer Option (full text)   G: Points
    #   H: Document Upload   I: Bonus Pts

    def _import_sector_sheet(self, ws, survey, category):
        header_row = _find_header_row(ws, 'Q ID')
        if not header_row:
            self.stdout.write(self.style.ERROR('    Cannot locate header row - sheet skipped.'))
            return 0, 0

        questions: dict = {}
        cur_id: str | None = None
        global_order = 0

        for row in ws.iter_rows(min_row=header_row + 1, values_only=True):
            padded = list(row) + [None] * 12
            (_, col_qid, col_cat, _col_q, _col_gri,
             col_option, col_pts, *_rest) = padded[:12]

            q_id   = _str(col_qid)    # 'AG-01' or ''
            option = _str(col_option) # 'A. ≥80% sourcing…'
            pts    = _int(col_pts)
            cat_nm = _str(col_cat)    # 'Certification'

            if not option or option[0] not in ('A', 'B', 'C', 'D'):
                continue

            if q_id and q_id not in ('Q ID', '#'):
                if q_id not in questions:
                    global_order += 1
                    label = cat_nm if cat_nm else q_id
                    questions[q_id] = {
                        'text':    f'[{q_id}]  {label}',
                        'order':   global_order,
                        'choices': [],
                    }
                cur_id = q_id

            if cur_id is None or cur_id not in questions:
                continue

            letter = option[0]
            questions[cur_id]['choices'].append({
                'text':  option,
                'score': pts,
                'order': LETTER_ORDER.get(letter, 99),
            })

        return self._persist(questions, survey, category)

    # ── Persist to database ────────────────────────────────────────────────

    def _persist(self, questions: dict, survey, category) -> tuple[int, int]:
        """
        Upsert Question + Choice objects.
        Returns (questions_created, choices_created).
        """
        q_count = c_count = 0

        for q_id, data in questions.items():
            if not data['choices']:
                continue

            q, q_new = Question.objects.update_or_create(
                survey=survey,
                category=category,
                order=data['order'],
                defaults={
                    'text':           data['text'],
                    'text_en':        data['text'],
                    'text_tr':        '',      # Turkish translation not in source file
                    'question_type':  'choice',
                    'is_active':      True,
                    'allow_multiple': False,
                },
            )
            if q_new:
                q_count += 1

            for ch in sorted(data['choices'], key=lambda x: x['order']):
                _, c_new = Choice.objects.update_or_create(
                    question=q,
                    order=ch['order'],
                    defaults={
                        'text':    ch['text'],
                        'text_en': ch['text'],
                        'text_tr': '',
                        'score':   ch['score'],
                    },
                )
                if c_new:
                    c_count += 1

        return q_count, c_count
