"""
Management command: create_combined_survey

Builds ONE "GRI Complete Assessment" survey that implements the hierarchical
branching structure requested by the client:

    ┌──────────────────────────────────────┐
    │   GRI Universal Core  (184 questions) │  ← shown to ALL respondents
    │   Governance (56) + Environmental (48)│
    │   Social (52) + Economic & Rep. (28)  │
    └──────────────────┬───────────────────┘
                       │
              [Sector-selection modal]
          ┌────┬────┬────┬────┬────┬────┬────┬────┐
        agri energy fin  mfg  con  health tech retail
          └────┴────┴────┴────┴────┴────┴────┴────┘
                       │  (8 questions each)
                  user sees only their sector's 8 Qs

Usage
-----
    python manage.py create_combined_survey
    python manage.py create_combined_survey --clear
    python manage.py create_combined_survey --clear --hide-components

Flags
-----
  --clear             Delete and fully rebuild the combined survey.
  --hide-components   Set the 12 individual GRI surveys to is_active=False
                      so only the combined survey appears on the surveys page.

Prerequisites
-------------
  Run import_gri_questionnaire first:
    python manage.py import_gri_questionnaire path/to/GRI_Questionnaire_v3_FIXED.xlsx
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from questionnaire.models import Survey, Category, Question, Choice


# ── Source survey names (created by import_gri_questionnaire) ─────────────

CORE_CONFIGS = [
    {
        'survey_name': 'GRI: Governance & Strategy',
        'cat_name':    'Governance & Strategy',
        'cat_name_tr': 'Yönetişim & Strateji',
        'order': 1, 'max_score': 280,
        'env_w': 0.0, 'soc_w': 0.0, 'gov_w': 1.0,
    },
    {
        'survey_name': 'GRI: Environmental Performance',
        'cat_name':    'Environmental Performance',
        'cat_name_tr': 'Çevresel Performans',
        'order': 2, 'max_score': 240,
        'env_w': 1.0, 'soc_w': 0.0, 'gov_w': 0.0,
    },
    {
        'survey_name': 'GRI: Social Performance',
        'cat_name':    'Social Performance',
        'cat_name_tr': 'Sosyal Performans',
        'order': 3, 'max_score': 260,
        'env_w': 0.0, 'soc_w': 1.0, 'gov_w': 0.0,
    },
    {
        'survey_name': 'GRI: Economic & Reporting',
        'cat_name':    'Economic & Reporting',
        'cat_name_tr': 'Ekonomik & Raporlama',
        'order': 4, 'max_score': 140,
        'env_w': 0.0, 'soc_w': 0.0, 'gov_w': 1.0,
    },
]

# Maps GRI sector survey name → sector code stored on Question.sector
SECTOR_MAP = {
    'GRI Sector: Agriculture & Food':        'agri',
    'GRI Sector: Energy & Utilities':        'energy',
    'GRI Sector: Financial Services':        'finance',
    'GRI Sector: Manufacturing & Industry':  'manufacturing',
    'GRI Sector: Construction & Real Estate':'construction',
    'GRI Sector: Healthcare & Pharma':       'health',
    'GRI Sector: Technology & IT':           'tech',
    'GRI Sector: Retail & Trade':            'retail',
}

# Order offset per sector so questions don't collide inside the combined survey
SECTOR_ORDER_BASE = {
    'agri': 1001, 'energy': 1011, 'finance': 1021,
    'manufacturing': 1031, 'construction': 1041,
    'health': 1051, 'tech': 1061, 'retail': 1071,
}

COMBINED_NAME    = 'GRI Complete Assessment'
COMBINED_NAME_TR = 'GRI Kapsamlı Değerlendirme'
COMBINED_DESC    = (
    'GRI Universal Core (184 questions across Governance, Environmental, '
    'Social, and Economic pillars) plus 8 sector-specific questions for '
    'your chosen industry. Select your sector when starting the assessment.'
)
COMBINED_DESC_TR = (
    'Yönetişim, Çevresel, Sosyal ve Ekonomik boyutlarda 184 evrensel GRI sorusu '
    'artı seçilen sektöre ait 8 sektörel soru. Değerlendirmeye başlarken '
    'sektörünüzü seçin.'
)

ALL_GRI_NAMES = (
    [c['survey_name'] for c in CORE_CONFIGS]
    + list(SECTOR_MAP.keys())
)


class Command(BaseCommand):
    help = 'Build the combined GRI Complete Assessment survey (hierarchical branching).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear', action='store_true',
            help='Delete and fully rebuild the combined survey.',
        )
        parser.add_argument(
            '--hide-components', action='store_true',
            help='Set the 12 individual GRI surveys to is_active=False.',
        )

    @transaction.atomic
    def handle(self, *args, **options):

        # ── Preflight: verify source surveys exist ─────────────────────────
        missing = []
        for name in ALL_GRI_NAMES:
            if not Survey.objects.filter(name=name).exists():
                missing.append(name)
        if missing:
            raise CommandError(
                'The following source surveys are missing. '
                'Run import_gri_questionnaire first.\n  ' + '\n  '.join(missing)
            )

        # ── Optional clear ─────────────────────────────────────────────────
        if options['clear']:
            n, _ = Survey.objects.filter(name=COMBINED_NAME).delete()
            if n:
                self.stdout.write(self.style.WARNING(
                    f'  [!] Deleted existing combined survey and all its data.'
                ))

        # ── Create / update combined survey ────────────────────────────────
        combined, created = Survey.objects.update_or_create(
            name=COMBINED_NAME,
            defaults={
                'name_en':          COMBINED_NAME,
                'name_tr':          COMBINED_NAME_TR,
                'description':      COMBINED_DESC,
                'description_en':   COMBINED_DESC,
                'description_tr':   COMBINED_DESC_TR,
                'is_active':        True,
                'allow_multiple_attempts':    True,
                'show_results_immediately':   True,
            },
        )
        label = 'Created' if created else 'Updated'
        self.stdout.write(f'\n[{label}] Survey: "{combined.name}"  (pk={combined.pk})')

        total_q = total_c = 0

        # ══════════════════════════════════════════════════════════════════
        # PART 1 — Universal core questions (sector='')
        # ══════════════════════════════════════════════════════════════════
        self.stdout.write('\n── Core sections (universal, sector="") ──────────────────')

        for cfg in CORE_CONFIGS:
            src = Survey.objects.get(name=cfg['survey_name'])

            cat, _ = Category.objects.update_or_create(
                survey=combined, name=cfg['cat_name'],
                defaults={
                    'name_en':             cfg['cat_name'],
                    'name_tr':             cfg['cat_name_tr'],
                    'order':               cfg['order'],
                    'max_score':           cfg['max_score'],
                    'environmental_weight':cfg['env_w'],
                    'social_weight':       cfg['soc_w'],
                    'governance_weight':   cfg['gov_w'],
                },
            )

            src_qs = (
                Question.objects
                .filter(survey=src, is_active=True)
                .prefetch_related('choices')
                .order_by('order')
            )
            q_count = c_count = 0

            for src_q in src_qs:
                # Use queryset.update() for existing → skips full_clean safely.
                # Use direct save(skip_validation=True) for new → avoids cross-survey
                # FK checks that would fail during construction.
                qs_match = Question.objects.filter(
                    survey=combined, category=cat, order=src_q.order
                )
                if qs_match.exists():
                    qs_match.update(
                        text=src_q.text,
                        text_en=src_q.text_en or src_q.text,
                        text_tr=src_q.text_tr,
                        question_type=src_q.question_type,
                        is_active=True,
                        allow_multiple=src_q.allow_multiple,
                        sector='',
                    )
                    q = qs_match.first()
                else:
                    q = Question(
                        survey=combined, category=cat, order=src_q.order,
                        text=src_q.text,
                        text_en=src_q.text_en or src_q.text,
                        text_tr=src_q.text_tr,
                        question_type=src_q.question_type,
                        is_active=True,
                        allow_multiple=src_q.allow_multiple,
                        sector='',
                    )
                    q.save(skip_validation=True)
                    q_count += 1

                for src_c in src_q.choices.all():
                    _, new_c = Choice.objects.update_or_create(
                        question=q, order=src_c.order,
                        defaults={
                            'text':    src_c.text,
                            'text_en': src_c.text_en or src_c.text,
                            'text_tr': src_c.text_tr,
                            'score':   src_c.score,
                        },
                    )
                    if new_c:
                        c_count += 1

            total_q += q_count
            total_c += c_count
            self.stdout.write(
                f'  [OK] {cfg["cat_name"]:<38}  '
                f'{src_qs.count():>3} Q total  {q_count:>3} new  {c_count:>4} new choices'
            )

        # ══════════════════════════════════════════════════════════════════
        # PART 2 — Sector-specific questions (sector=code)
        # ══════════════════════════════════════════════════════════════════
        self.stdout.write('\n── Sector modules (sector-specific) ─────────────────────')

        # All sector questions share one "Sector Supplement" category.
        # get_category_breakdown() filters by sector at runtime, so each
        # respondent is only scored on their own sector's 8 questions.
        sector_cat, _ = Category.objects.update_or_create(
            survey=combined, name='Sector Supplement',
            defaults={
                'name_en':             'Sector Supplement',
                'name_tr':             'Sektör Eki',
                'order':               5,
                'max_score':           80,
                'environmental_weight':0.34,
                'social_weight':       0.33,
                'governance_weight':   0.33,
            },
        )

        for src_survey_name, sector_code in SECTOR_MAP.items():
            src = Survey.objects.get(name=src_survey_name)
            src_qs = (
                Question.objects
                .filter(survey=src, is_active=True)
                .prefetch_related('choices')
                .order_by('order')
            )
            base = SECTOR_ORDER_BASE[sector_code]
            q_count = c_count = 0

            for i, src_q in enumerate(src_qs, 1):
                order = base + i
                qs_match = Question.objects.filter(
                    survey=combined, category=sector_cat, order=order
                )
                if qs_match.exists():
                    qs_match.update(
                        text=src_q.text,
                        text_en=src_q.text_en or src_q.text,
                        text_tr=src_q.text_tr,
                        question_type=src_q.question_type,
                        is_active=True,
                        allow_multiple=src_q.allow_multiple,
                        sector=sector_code,
                    )
                    q = qs_match.first()
                else:
                    q = Question(
                        survey=combined, category=sector_cat, order=order,
                        text=src_q.text,
                        text_en=src_q.text_en or src_q.text,
                        text_tr=src_q.text_tr,
                        question_type=src_q.question_type,
                        is_active=True,
                        allow_multiple=src_q.allow_multiple,
                        sector=sector_code,
                    )
                    q.save(skip_validation=True)
                    q_count += 1

                for src_c in src_q.choices.all():
                    _, new_c = Choice.objects.update_or_create(
                        question=q, order=src_c.order,
                        defaults={
                            'text':    src_c.text,
                            'text_en': src_c.text_en or src_c.text,
                            'text_tr': src_c.text_tr,
                            'score':   src_c.score,
                        },
                    )
                    if new_c:
                        c_count += 1

            total_q += q_count
            total_c += c_count
            self.stdout.write(
                f'  [OK] {src_survey_name:<45}  '
                f'{src_qs.count():>2} Q  sector="{sector_code}"'
            )

        # ── Optional: hide individual component surveys ────────────────────
        if options['hide_components']:
            hidden = Survey.objects.filter(name__in=ALL_GRI_NAMES).update(is_active=False)
            self.stdout.write(self.style.WARNING(
                f'\n  [!] {hidden} individual GRI surveys set to is_active=False.'
            ))

        # ── Summary ────────────────────────────────────────────────────────
        total_in_survey = Question.objects.filter(survey=combined, is_active=True).count()
        universal_count = Question.objects.filter(survey=combined, sector='', is_active=True).count()
        sector_count    = Question.objects.filter(survey=combined, is_active=True).exclude(sector='').count()

        self.stdout.write(self.style.SUCCESS(
            f'\n╔══════════════════════════════════════════════════════════╗\n'
            f'  DONE — GRI Complete Assessment built successfully\n'
            f'  Survey pk      : {combined.pk}\n'
            f'  Universal Qs   : {universal_count}  (shown to ALL respondents)\n'
            f'  Sector-specific: {sector_count}  ({sector_count // 8} sectors × 8 Qs each)\n'
            f'  Total in survey: {total_in_survey}\n'
            f'  New this run   : {total_q} questions, {total_c} choices\n\n'
            f'  Next steps:\n'
            f'  1. Visit /admin/questionnaire/survey/ to verify\n'
            f'  2. Run with --hide-components to hide the 12 individual surveys\n'
            f'     python manage.py create_combined_survey --hide-components\n'
            f'╚══════════════════════════════════════════════════════════╝'
        ))
