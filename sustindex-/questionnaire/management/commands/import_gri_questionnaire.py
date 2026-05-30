"""
Import GRI Standards Competency Assessment v3 from Excel into the database.

Usage
-----
  python manage.py import_gri_questionnaire "C:/path/to/GRI_Questionnaire_v3_FIXED.xlsx"
  python manage.py import_gri_questionnaire "C:/path/to/file.xlsx" --clear

What it creates
---------------
  12 separate Surveys (one per section/sector):
    - GRI: Governance & Strategy          (56 questions)
    - GRI: Environmental Performance      (48 questions)
    - GRI: Social Performance             (52 questions)
    - GRI: Economic & Reporting           (28 questions)
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

CORE_SECTIONS = [
    {
        'sheet':         'Governance & Strategy',
        'survey_name':   'GRI: Governance & Strategy',
        'survey_name_tr':'GRI: Yonetisim & Strateji',
        'survey_desc':   'GRI 2, 3, 205, 206, 207 — 14 criteria x 4 PDCA layers = 56 questions, 280 pts max.',
        'cat_name':      'Governance & Strategy',
        'cat_name_tr':   'Yonetisim & Strateji',
        'max_score':     280,
        'env_w': 0.0, 'soc_w': 0.0, 'gov_w': 1.0,
    },
    {
        'sheet':         'Environmental Performance',
        'survey_name':   'GRI: Environmental Performance',
        'survey_name_tr':'GRI: Cevresel Performans',
        'survey_desc':   'GRI 302-306, 308, 304 — 12 criteria x 4 PDCA layers = 48 questions, 240 pts max.',
        'cat_name':      'Environmental Performance',
        'cat_name_tr':   'Cevresel Performans',
        'max_score':     240,
        'env_w': 1.0, 'soc_w': 0.0, 'gov_w': 0.0,
    },
    {
        'sheet':         'Social Performance',
        'survey_name':   'GRI: Social Performance',
        'survey_name_tr':'GRI: Sosyal Performans',
        'survey_desc':   'GRI 401, 403-409, 413, 414, 416-418 — 13 criteria x 4 PDCA layers = 52 questions, 260 pts max.',
        'cat_name':      'Social Performance',
        'cat_name_tr':   'Sosyal Performans',
        'max_score':     260,
        'env_w': 0.0, 'soc_w': 1.0, 'gov_w': 0.0,
    },
    {
        'sheet':         'Economic & Reporting',
        'survey_name':   'GRI: Economic & Reporting',
        'survey_name_tr':'GRI: Ekonomik & Raporlama',
        'survey_desc':   'GRI 201-205, 207 / TCFD / CSRD — 7 criteria x 4 PDCA layers = 28 questions, 140 pts max.',
        'cat_name':      'Economic & Reporting',
        'cat_name_tr':   'Ekonomik & Raporlama',
        'max_score':     140,
        'env_w': 0.0, 'soc_w': 0.0, 'gov_w': 1.0,
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
    try: return int(float(v))
    except: return d

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
                    label = q_text if q_text else q_id
                    if layer_name:
                        label = f'{label}  [{layer_name}]'
                    questions[q_id] = {'text': f'[{q_id}]  {label}', 'order': order, 'choices': []}
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

    # ── Fix B > A anomalies ────────────────────────────────────────────────

    def _fix_score_anomalies(self, survey):
        """Swap A and B scores where B > A (Excel data error)."""
        fixed = 0
        for q in Question.objects.filter(survey=survey).prefetch_related('choices'):
            choices = {c.order: c for c in q.choices.all()}
            a, b = choices.get(1), choices.get(2)
            if a and b and b.score > a.score:
                Choice.objects.filter(pk=a.pk).update(score=b.score)
                Choice.objects.filter(pk=b.pk).update(score=a.score)
                fixed += 1
        return fixed
