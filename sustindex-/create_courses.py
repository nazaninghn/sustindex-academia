"""
Seed script — creates 8 ESG e-learning courses (global, no company link).
Run from the project root:
    python create_courses.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()

from elearning.models import Course, Lesson

COURSES = [
    {
        'order': 1,
        'icon_emoji': '📘',
        'tag': 'ISO 26000',
        'level': 'beg',
        'title_en': 'ISO 26000 Fundamentals',
        'title_tr': 'ISO 26000 Temelleri',
        'duration_hours': '4h 20m',
        'description_en': 'An introduction to the ISO 26000 social responsibility framework — core principles, stakeholder engagement, and how to integrate it into your organisation.',
        'description_tr': 'ISO 26000 sosyal sorumluluk çerçevesine giriş — temel ilkeler, paydaş katılımı ve kurumunuza nasıl entegre edeceğiniz.',
        'lessons': [
            {'order': 1, 'title_en': 'What is ISO 26000?',                   'title_tr': 'ISO 26000 Nedir?',                     'duration_minutes': 15},
            {'order': 2, 'title_en': 'Core Subjects Overview',                'title_tr': 'Temel Konular',                        'duration_minutes': 20},
            {'order': 3, 'title_en': 'Stakeholder Identification',            'title_tr': 'Paydaş Tanımlama',                     'duration_minutes': 18},
            {'order': 4, 'title_en': 'Principles of Social Responsibility',   'title_tr': 'Sosyal Sorumluluk İlkeleri',           'duration_minutes': 22},
            {'order': 5, 'title_en': 'Integrating into Governance',           'title_tr': 'Yönetişime Entegrasyon',               'duration_minutes': 20},
            {'order': 6, 'title_en': 'Reporting & Communication',             'title_tr': 'Raporlama ve İletişim',                'duration_minutes': 18},
            {'order': 7, 'title_en': 'Case Studies',                          'title_tr': 'Vaka Çalışmaları',                     'duration_minutes': 25},
            {'order': 8, 'title_en': 'Assessment & Certification',            'title_tr': 'Değerlendirme ve Sertifikasyon',       'duration_minutes': 22},
        ],
    },
    {
        'order': 2,
        'icon_emoji': '📊',
        'tag': 'GRI',
        'level': 'int',
        'title_en': 'GRI Standards Reporting',
        'title_tr': 'GRI Standartları ile Raporlama',
        'duration_hours': '6h 40m',
        'description_en': 'Master the GRI Standards for sustainability reporting — materiality assessment, disclosures, and preparing your first GRI-aligned report.',
        'description_tr': 'Sürdürülebilirlik raporlaması için GRI Standartlarına hakim olun — önemlilik değerlendirmesi, açıklamalar ve ilk GRI uyumlu raporunuzu hazırlama.',
        'lessons': [
            {'order': 1,  'title_en': 'GRI Framework Overview',              'title_tr': 'GRI Çerçevesine Genel Bakış',         'duration_minutes': 20},
            {'order': 2,  'title_en': 'Universal Standards (GRI 1, 2, 3)',   'title_tr': 'Evrensel Standartlar (GRI 1, 2, 3)',   'duration_minutes': 30},
            {'order': 3,  'title_en': 'Economic Disclosures (GRI 200)',      'title_tr': 'Ekonomik Açıklamalar (GRI 200)',       'duration_minutes': 25},
            {'order': 4,  'title_en': 'Environmental Disclosures (GRI 300)', 'title_tr': 'Çevresel Açıklamalar (GRI 300)',       'duration_minutes': 35},
            {'order': 5,  'title_en': 'Social Disclosures (GRI 400)',        'title_tr': 'Sosyal Açıklamalar (GRI 400)',         'duration_minutes': 35},
            {'order': 6,  'title_en': 'Materiality Assessment',              'title_tr': 'Önemlilik Değerlendirmesi',            'duration_minutes': 28},
            {'order': 7,  'title_en': 'Stakeholder Engagement',              'title_tr': 'Paydaş Katılımı',                     'duration_minutes': 22},
            {'order': 8,  'title_en': 'Data Collection Methods',             'title_tr': 'Veri Toplama Yöntemleri',             'duration_minutes': 25},
            {'order': 9,  'title_en': 'Writing Your Report',                 'title_tr': 'Raporunuzu Yazma',                    'duration_minutes': 30},
            {'order': 10, 'title_en': 'External Assurance',                  'title_tr': 'Harici Güvence',                      'duration_minutes': 20},
            {'order': 11, 'title_en': 'Common Pitfalls',                     'title_tr': 'Yaygın Hatalar',                      'duration_minutes': 18},
            {'order': 12, 'title_en': 'Practical Workshop',                  'title_tr': 'Pratik Atölye',                       'duration_minutes': 32},
        ],
    },
    {
        'order': 3,
        'icon_emoji': '🌱',
        'tag': 'Carbon',
        'level': 'int',
        'title_en': 'Carbon Footprint & Net Zero',
        'title_tr': 'Karbon Ayak İzi ve Net Sıfır',
        'duration_hours': '5h 30m',
        'description_en': 'Calculate your organisational carbon footprint using GHG Protocol, set science-based targets, and build a credible net zero roadmap.',
        'description_tr': 'GHG Protokolü kullanarak kurumsal karbon ayak izinizi hesaplayın, bilim temelli hedefler belirleyin ve güvenilir bir net sıfır yol haritası oluşturun.',
        'lessons': [
            {'order': 1,  'title_en': 'Climate Science Essentials',          'title_tr': 'İklim Bilimi Temelleri',               'duration_minutes': 20},
            {'order': 2,  'title_en': 'GHG Protocol Scopes 1, 2, 3',         'title_tr': 'GHG Protokolü Kapsam 1, 2, 3',        'duration_minutes': 30},
            {'order': 3,  'title_en': 'Data Collection & Emission Factors',  'title_tr': 'Veri Toplama ve Emisyon Faktörleri',   'duration_minutes': 25},
            {'order': 4,  'title_en': 'Calculating Your Carbon Footprint',   'title_tr': 'Karbon Ayak İzinizi Hesaplama',        'duration_minutes': 30},
            {'order': 5,  'title_en': 'Science-Based Targets (SBTi)',        'title_tr': 'Bilim Temelli Hedefler (SBTi)',        'duration_minutes': 25},
            {'order': 6,  'title_en': 'Reduction Strategies',                'title_tr': 'Azaltım Stratejileri',                'duration_minutes': 22},
            {'order': 7,  'title_en': 'Carbon Offsetting & Credits',         'title_tr': 'Karbon Dengeleme ve Krediler',         'duration_minutes': 20},
            {'order': 8,  'title_en': 'Building a Net Zero Roadmap',         'title_tr': 'Net Sıfır Yol Haritası Oluşturma',    'duration_minutes': 28},
            {'order': 9,  'title_en': 'Reporting & Disclosure',              'title_tr': 'Raporlama ve Kamuoyu Açıklaması',     'duration_minutes': 20},
            {'order': 10, 'title_en': 'Case Studies: Net Zero Leaders',      'title_tr': 'Vaka Çalışmaları: Net Sıfır Liderler', 'duration_minutes': 30},
        ],
    },
    {
        'order': 4,
        'icon_emoji': '👔',
        'tag': 'Governance',
        'level': 'adv',
        'title_en': 'Board Governance & ESG Oversight',
        'title_tr': 'Yönetim Kurulu ve ESG Denetimi',
        'duration_hours': '3h 15m',
        'description_en': 'Equip board members and executives with the frameworks needed for effective ESG oversight, director duties, and board-level sustainability strategy.',
        'description_tr': 'Yönetim kurulu üyeleri ve yöneticileri etkili ESG denetimi, yönetici sorumlulukları ve kurumsal sürdürülebilirlik stratejisi için gerekli çerçevelerle donatın.',
        'lessons': [
            {'order': 1, 'title_en': 'The Role of the Board in ESG',         'title_tr': "Yönetim Kurulu'nun ESG'deki Rolü",    'duration_minutes': 25},
            {'order': 2, 'title_en': 'Director Duties & Fiduciary Obligation','title_tr': 'Yönetici Görevleri',                 'duration_minutes': 20},
            {'order': 3, 'title_en': 'ESG Risk & Opportunity Oversight',     'title_tr': 'ESG Risk ve Fırsat Denetimi',         'duration_minutes': 22},
            {'order': 4, 'title_en': 'Integrating ESG into Strategy',        'title_tr': "ESG'yi Stratejiye Entegre Etme",     'duration_minutes': 25},
            {'order': 5, 'title_en': 'Investor & Stakeholder Communication', 'title_tr': 'Yatırımcı ve Paydaş İletişimi',      'duration_minutes': 20},
            {'order': 6, 'title_en': 'Board ESG Performance Metrics',        'title_tr': 'Yönetim Kurulu ESG Performans Metrikleri', 'duration_minutes': 23},
        ],
    },
    {
        'order': 5,
        'icon_emoji': '🎯',
        'tag': 'Materiality',
        'level': 'int',
        'title_en': 'Materiality Assessment in Practice',
        'title_tr': 'Pratikte Önemlilik Değerlendirmesi',
        'duration_hours': '4h 50m',
        'description_en': 'Step-by-step guide to conducting a double materiality assessment aligned with GRI, CSRD, and ESRS requirements — from stakeholder surveys to prioritisation matrices.',
        'description_tr': "GRI, CSRD ve ESRS gereksinimlerine uygun çift önemlilik değerlendirmesi yapma — paydaş anketlerinden önceliklendirme matrislerine adım adım rehber.",
        'lessons': [
            {'order': 1, 'title_en': 'What is Materiality?',                 'title_tr': 'Önemlilik Nedir?',                    'duration_minutes': 18},
            {'order': 2, 'title_en': 'Single vs Double Materiality',         'title_tr': 'Tek ve Çift Önemlilik',               'duration_minutes': 22},
            {'order': 3, 'title_en': 'Identifying Material Topics',          'title_tr': 'Önemli Konuların Belirlenmesi',       'duration_minutes': 25},
            {'order': 4, 'title_en': 'Stakeholder Surveys & Interviews',     'title_tr': 'Paydaş Anketleri ve Görüşmeler',     'duration_minutes': 28},
            {'order': 5, 'title_en': 'Prioritisation & Matrix',              'title_tr': 'Önceliklendirme ve Matris',           'duration_minutes': 25},
            {'order': 6, 'title_en': 'CSRD / ESRS Alignment',                'title_tr': 'CSRD / ESRS Uyumu',                  'duration_minutes': 30},
            {'order': 7, 'title_en': 'Documenting & Disclosing',             'title_tr': 'Belgeleme ve Açıklama',              'duration_minutes': 20},
            {'order': 8, 'title_en': 'Review & Update Cycles',               'title_tr': 'Gözden Geçirme ve Güncelleme',       'duration_minutes': 22},
            {'order': 9, 'title_en': 'Workshop: Real-world Example',         'title_tr': 'Atölye: Gerçek Dünya Örneği',        'duration_minutes': 30},
        ],
    },
    {
        'order': 6,
        'icon_emoji': '🤝',
        'tag': 'Social',
        'level': 'beg',
        'title_en': 'Stakeholder Engagement Strategies',
        'title_tr': 'Paydaş Katılım Stratejileri',
        'duration_hours': '3h 40m',
        'description_en': 'Design and implement effective stakeholder engagement programmes — mapping, dialogue, grievance mechanisms, and reporting outcomes.',
        'description_tr': 'Etkili paydaş katılım programları tasarlayın ve uygulayın — haritalama, diyalog, şikâyet mekanizmaları ve sonuç raporlaması.',
        'lessons': [
            {'order': 1, 'title_en': 'Stakeholder Mapping',                  'title_tr': 'Paydaş Haritalama',                  'duration_minutes': 20},
            {'order': 2, 'title_en': 'Engagement Methods & Channels',        'title_tr': 'Katılım Yöntemleri',                 'duration_minutes': 22},
            {'order': 3, 'title_en': 'Dialogue & Consultation',              'title_tr': 'Diyalog ve Danışma',                 'duration_minutes': 20},
            {'order': 4, 'title_en': 'Grievance Mechanisms',                 'title_tr': 'Şikâyet Mekanizmaları',             'duration_minutes': 18},
            {'order': 5, 'title_en': 'Community Investment',                 'title_tr': 'Toplum Yatırımı',                    'duration_minutes': 20},
            {'order': 6, 'title_en': 'Reporting Engagement Outcomes',        'title_tr': 'Katılım Sonuçlarını Raporlama',     'duration_minutes': 18},
            {'order': 7, 'title_en': 'Case Studies',                         'title_tr': 'Vaka Çalışmaları',                   'duration_minutes': 22},
        ],
    },
    {
        'order': 7,
        'icon_emoji': '📑',
        'tag': 'SASB',
        'level': 'adv',
        'title_en': 'SASB Standards by Industry',
        'title_tr': 'Sektöre Göre SASB Standartları',
        'duration_hours': '7h 20m',
        'description_en': 'Deep-dive into SASB industry-specific standards — selecting the right standard for your sector, metrics selection, data assurance, and integration with other frameworks.',
        'description_tr': "SASB sektöre özgü standartlarına derinlemesine dalış — sektörünüze doğru standardı seçme, metrik seçimi, veri güvencesi ve diğer çerçevelerle entegrasyon.",
        'lessons': [
            {'order': 1,  'title_en': 'SASB Overview & Industry Classification', 'title_tr': 'SASB Genel Bakış ve Sektör Sınıflandırması', 'duration_minutes': 20},
            {'order': 2,  'title_en': 'Selecting Your SASB Standard',             'title_tr': 'SASB Standardınızı Seçme',                  'duration_minutes': 18},
            {'order': 3,  'title_en': 'Financial Services Sector',                'title_tr': 'Finansal Hizmetler Sektörü',                 'duration_minutes': 30},
            {'order': 4,  'title_en': 'Technology & Communications',              'title_tr': 'Teknoloji ve İletişim',                      'duration_minutes': 28},
            {'order': 5,  'title_en': 'Manufacturing & Industrials',              'title_tr': 'İmalat ve Endüstriyel',                      'duration_minutes': 30},
            {'order': 6,  'title_en': 'Consumer Goods & Retail',                  'title_tr': 'Tüketici Malları ve Perakende',             'duration_minutes': 28},
            {'order': 7,  'title_en': 'Energy & Extractives',                     'title_tr': 'Enerji ve Çıkarıcı Endüstriler',            'duration_minutes': 32},
            {'order': 8,  'title_en': 'Metrics Selection & Calculation',          'title_tr': 'Metrik Seçimi ve Hesaplama',                'duration_minutes': 25},
            {'order': 9,  'title_en': 'SASB + GRI + TCFD Integration',            'title_tr': 'SASB + GRI + TCFD Entegrasyonu',           'duration_minutes': 30},
            {'order': 10, 'title_en': 'Data Collection & Assurance',              'title_tr': 'Veri Toplama ve Güvence',                   'duration_minutes': 25},
            {'order': 11, 'title_en': 'Investor Communication',                   'title_tr': 'Yatırımcı İletişimi',                       'duration_minutes': 20},
            {'order': 12, 'title_en': 'Practical Report Exercise',                'title_tr': 'Pratik Rapor Alıştırması',                  'duration_minutes': 30},
            {'order': 13, 'title_en': 'Peer Benchmarking',                        'title_tr': 'Emsal Karşılaştırma',                       'duration_minutes': 22},
            {'order': 14, 'title_en': 'Final Assessment',                         'title_tr': 'Son Değerlendirme',                         'duration_minutes': 22},
        ],
    },
    {
        'order': 8,
        'icon_emoji': '🇪🇺',
        'tag': 'CSRD',
        'level': 'adv',
        'title_en': 'EU CSRD & ESRS Compliance',
        'title_tr': 'AB CSRD ve ESRS Uyumu',
        'duration_hours': '6h 10m',
        'description_en': 'Navigate the EU Corporate Sustainability Reporting Directive — scope, timeline, ESRS standards, double materiality, assurance requirements, and practical implementation steps.',
        'description_tr': "AB Kurumsal Sürdürülebilirlik Raporlama Direktifini anlayın — kapsam, zaman çizelgesi, ESRS standartları, çift önemlilik, güvence gereksinimleri ve pratik uygulama adımları.",
        'lessons': [
            {'order': 1,  'title_en': 'CSRD Overview & Timeline',                'title_tr': 'CSRD Genel Bakış ve Zaman Çizelgesi',       'duration_minutes': 20},
            {'order': 2,  'title_en': 'Who Must Comply?',                         'title_tr': 'Kim Uymak Zorunda?',                        'duration_minutes': 18},
            {'order': 3,  'title_en': 'ESRS Architecture',                        'title_tr': 'ESRS Mimarisi',                             'duration_minutes': 25},
            {'order': 4,  'title_en': 'Cross-Cutting Standards (ESRS 1, 2)',      'title_tr': 'Genel Standartlar (ESRS 1, 2)',             'duration_minutes': 25},
            {'order': 5,  'title_en': 'Environmental Standards (ESRS E1–E5)',     'title_tr': 'Çevresel Standartlar (ESRS E1–E5)',         'duration_minutes': 35},
            {'order': 6,  'title_en': 'Social Standards (ESRS S1–S4)',            'title_tr': 'Sosyal Standartlar (ESRS S1–S4)',           'duration_minutes': 30},
            {'order': 7,  'title_en': 'Governance Standard (ESRS G1)',            'title_tr': 'Yönetişim Standardı (ESRS G1)',             'duration_minutes': 22},
            {'order': 8,  'title_en': 'Double Materiality under CSRD',            'title_tr': "CSRD'de Çift Önemlilik",                   'duration_minutes': 28},
            {'order': 9,  'title_en': 'Assurance Requirements',                   'title_tr': 'Güvence Gereksinimleri',                    'duration_minutes': 22},
            {'order': 10, 'title_en': 'Implementation Roadmap',                   'title_tr': 'Uygulama Yol Haritası',                     'duration_minutes': 25},
            {'order': 11, 'title_en': 'Common Compliance Challenges',             'title_tr': 'Yaygın Uyum Zorlukları',                   'duration_minutes': 20},
        ],
    },
]


def run():
    created = 0
    updated = 0

    for data in COURSES:
        lessons_data = data.pop('lessons', [])

        # Use title_en as the main title
        data['title'] = data.get('title_en', data.get('title', ''))

        # Build description from description_en
        desc_en = data.pop('description_en', '')
        desc_tr = data.pop('description_tr', '')
        title_en = data.pop('title_en', '')
        title_tr = data.pop('title_tr', '')

        course, was_created = Course.objects.update_or_create(
            order=data['order'],
            defaults={
                **data,
                'title_en': title_en,
                'title_tr': title_tr,
                'description': desc_en,
                'description_en': desc_en,
                'description_tr': desc_tr,
                'company': None,
            }
        )

        if was_created:
            created += 1
        else:
            updated += 1

        # Sync lessons
        existing_orders = set(course.lessons.values_list('order', flat=True))
        for ld in lessons_data:
            lesson_title = ld.get('title_en', ld.get('title', ''))
            Lesson.objects.update_or_create(
                course=course,
                order=ld['order'],
                defaults={
                    'title':      lesson_title,
                    'title_en':   ld.get('title_en', ''),
                    'title_tr':   ld.get('title_tr', ''),
                    'content':    '',
                    'duration_minutes': ld.get('duration_minutes', 0),
                }
            )

        print(f"  {'Created' if was_created else 'Updated'}: [{course.icon_emoji}] {course.title}")

    print(f"\nDone — {created} created, {updated} updated.")


if __name__ == '__main__':
    print('Seeding courses...')
    run()
