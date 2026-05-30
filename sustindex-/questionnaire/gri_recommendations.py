"""
GRI-specific recommendation engine.

Maps (category_type, score_band) → list of actionable recommendations.
Each recommendation includes title, description, GRI standard reference,
effort level, and a quick-win action.

Called from QuestionnaireAttempt.get_recommendations().
"""

# ── Category type detection ────────────────────────────────────────────────

def _cat_type(name: str) -> str:
    n = name.lower()
    if any(x in n for x in ('govern', 'strateg', 'yönet', 'strateji', 'economic', 'ekonomi', 'reporting', 'raporl')):
        return 'governance'
    if any(x in n for x in ('environ', 'çevre', 'energy', 'enerji', 'emission', 'waste', 'climate')):
        return 'environmental'
    if any(x in n for x in ('social', 'sosyal', 'labour', 'health', 'safety', 'community', 'worker')):
        return 'social'
    if any(x in n for x in ('agriculture', 'food', 'tarım', 'gıda')):
        return 'sector_agri'
    if any(x in n for x in ('financial', 'finans', 'banking', 'investment')):
        return 'sector_finance'
    if any(x in n for x in ('construction', 'real estate', 'inşaat', 'gayrimenkul')):
        return 'sector_construction'
    if any(x in n for x in ('manufacturing', 'industry', 'imalat', 'sanayi')):
        return 'sector_manufacturing'
    if any(x in n for x in ('healthcare', 'pharma', 'sağlık', 'ilaç')):
        return 'sector_health'
    if any(x in n for x in ('technology', 'teknoloji', 'software', 'it')):
        return 'sector_tech'
    if any(x in n for x in ('retail', 'trade', 'perakende', 'ticaret')):
        return 'sector_retail'
    return 'general'


# ── Score band helper ──────────────────────────────────────────────────────

def _band(pct: float) -> str:
    if pct >= 80: return 'excellent'
    if pct >= 60: return 'good'
    if pct >= 40: return 'developing'
    if pct >= 20: return 'initial'
    return 'critical'


# ── Maturity label ─────────────────────────────────────────────────────────

def maturity_label(pct: float, lang: str = 'en') -> str:
    band = _band(pct)
    labels = {
        'en': {
            'excellent':  'Leading',
            'good':       'Established',
            'developing': 'Developing',
            'initial':    'Initial',
            'critical':   'Critical',
        },
        'tr': {
            'excellent':  'Lider',
            'good':       'Yerleşik',
            'developing': 'Gelişmekte',
            'initial':    'Başlangıç',
            'critical':   'Kritik',
        },
    }
    return labels.get(lang, labels['en'])[band]


# ── Recommendation library ─────────────────────────────────────────────────

_RECS = {

    'governance': {
        'critical': [
            {
                'title': 'Establish Board-Level Sustainability Governance',
                'description': 'No formal sustainability oversight exists at board level. Appoint a dedicated sustainability committee or assign a C-suite ESG sponsor with clear mandate and reporting lines.',
                'gri_standard': 'GRI 2-9 · GRI 2-12',
                'timeline_days': 90,
                'effort': 'High',
                'quick_win': 'Draft a one-page board sustainability mandate within 30 days and present to the audit committee.',
            },
            {
                'title': 'Define Materiality & Stakeholder Engagement Process',
                'description': 'A formal double-materiality assessment is missing. Without this, ESG reporting lacks credibility and strategic direction.',
                'gri_standard': 'GRI 3-1 · GRI 2-29',
                'timeline_days': 120,
                'effort': 'Medium',
                'quick_win': 'Map top 10 stakeholder groups and schedule consultation sessions within 45 days.',
            },
        ],
        'initial': [
            {
                'title': 'Formalise ESG Strategy with Measurable KPIs',
                'description': 'Sustainability commitments exist informally but lack documented targets and ownership. Develop a 3-year ESG roadmap with SMART targets aligned to GRI Universal Standards.',
                'gri_standard': 'GRI 2-22 · GRI 3-3',
                'timeline_days': 90,
                'effort': 'Medium',
                'quick_win': 'Set 3 headline ESG KPIs this quarter; assign an owner to each.',
            },
            {
                'title': 'Implement Anti-Corruption & Ethics Framework',
                'description': 'Low scores on anti-bribery and tax transparency. Adopt a formal code of conduct, third-party due-diligence procedure, and whistleblower channel.',
                'gri_standard': 'GRI 205-1 · GRI 206-1 · GRI 207-1',
                'timeline_days': 60,
                'effort': 'Medium',
                'quick_win': 'Publish a code of conduct on the company website within 30 days.',
            },
        ],
        'developing': [
            {
                'title': 'Strengthen Sustainability Reporting Alignment (CSRD / TCFD)',
                'description': 'Governance disclosures are partially complete. Align reporting to CSRD double-materiality requirements and TCFD climate risk framework.',
                'gri_standard': 'GRI 2-14 · GRI 201-2',
                'timeline_days': 180,
                'effort': 'High',
                'quick_win': 'Commission a CSRD gap analysis from an external auditor in 60 days.',
            },
            {
                'title': 'Integrate ESG into Executive Compensation',
                'description': 'Link a portion of senior leadership variable pay to verified ESG performance targets to strengthen accountability.',
                'gri_standard': 'GRI 2-19 · GRI 2-20',
                'timeline_days': 120,
                'effort': 'Medium',
                'quick_win': 'Include an ESG metric in the next annual performance review cycle.',
            },
        ],
        'good': [
            {
                'title': 'Pursue Third-Party Assurance for ESG Disclosures',
                'description': 'Strong governance foundations are in place. Obtain limited or reasonable assurance on key ESG metrics from an accredited assurance provider to boost investor confidence.',
                'gri_standard': 'GRI 2-5',
                'timeline_days': 180,
                'effort': 'High',
                'quick_win': 'Issue an RFP for ESG assurance services this quarter.',
            },
        ],
        'excellent': [
            {
                'title': 'Embed Integrated Thinking (IR Framework)',
                'description': 'Your governance maturity is leading-class. Consider publishing an Integrated Report aligned to IIRC/VRF principles, linking financial and non-financial value creation.',
                'gri_standard': 'GRI 2-22 · IIRC Framework',
                'timeline_days': 365,
                'effort': 'High',
                'quick_win': 'Map your existing disclosures to the six capitals of the Integrated Reporting Framework.',
            },
        ],
    },

    'environmental': {
        'critical': [
            {
                'title': 'Establish GHG Inventory (Scope 1 & 2)',
                'description': 'No greenhouse gas baseline exists. Without measurement you cannot manage climate risk or meet emerging regulatory requirements. Start with a Scope 1 & 2 inventory using the GHG Protocol.',
                'gri_standard': 'GRI 305-1 · GRI 305-2',
                'timeline_days': 90,
                'effort': 'Medium',
                'quick_win': 'Collect 12 months of utility bills and fuel purchase data; engage an energy auditor.',
            },
            {
                'title': 'Develop Energy Management Plan',
                'description': 'Energy data is not tracked. Conduct an ISO 50001-aligned energy audit to identify the top 5 consumption sources and set a reduction target.',
                'gri_standard': 'GRI 302-1 · GRI 302-4',
                'timeline_days': 90,
                'effort': 'Medium',
                'quick_win': 'Install sub-metering on the 3 highest energy-use assets within 60 days.',
            },
        ],
        'initial': [
            {
                'title': 'Extend GHG Inventory to Scope 3',
                'description': 'Scope 1 & 2 are partially tracked. Map material Scope 3 categories (especially purchased goods, business travel, and waste) to understand the full climate footprint.',
                'gri_standard': 'GRI 305-3',
                'timeline_days': 120,
                'effort': 'High',
                'quick_win': 'Complete a Scope 3 screening assessment using the GHG Protocol Scope 3 Evaluator tool.',
            },
            {
                'title': 'Implement Water & Waste Tracking',
                'description': 'Water consumption and waste diversion rates are not systematically measured. Set up metering and monthly reporting.',
                'gri_standard': 'GRI 303-1 · GRI 306-3',
                'timeline_days': 60,
                'effort': 'Low',
                'quick_win': 'Audit current waste disposal contracts to determine landfill vs recycling split.',
            },
        ],
        'developing': [
            {
                'title': 'Set Science-Based Targets (SBTi)',
                'description': 'Environmental performance is tracked but targets lack scientific alignment. Submit an SBTi commitment letter and develop a 1.5°C-aligned decarbonisation pathway.',
                'gri_standard': 'GRI 305-5 · TCFD Strategy b',
                'timeline_days': 180,
                'effort': 'High',
                'quick_win': 'Register on the SBTi website and assign an internal climate lead.',
            },
            {
                'title': 'Assess Biodiversity & Nature Impact',
                'description': 'Climate metrics are developing but nature-related risks (TNFD) are unaddressed. Conduct a biodiversity impact screen for key operational sites.',
                'gri_standard': 'GRI 304-1 · TNFD',
                'timeline_days': 180,
                'effort': 'Medium',
                'quick_win': 'Use the ENCORE tool to screen operational sites for nature dependency.',
            },
        ],
        'good': [
            {
                'title': 'Develop a Circular Economy Roadmap',
                'description': 'Strong environmental metrics are in place. Advance to circular economy principles — design-for-disassembly, extended producer responsibility, and closed-loop material flows.',
                'gri_standard': 'GRI 301-2 · GRI 306-2',
                'timeline_days': 270,
                'effort': 'High',
                'quick_win': 'Map top 3 material streams and assess circularity opportunities.',
            },
        ],
        'excellent': [
            {
                'title': 'Achieve Net-Zero & Nature-Positive Commitments',
                'description': 'Environmental leadership is confirmed. Formalise a net-zero commitment with interim milestones and disclose against TCFD + TNFD for comprehensive climate & nature transparency.',
                'gri_standard': 'GRI 305-5 · TCFD · TNFD',
                'timeline_days': 365,
                'effort': 'High',
                'quick_win': 'Publish your net-zero roadmap with verified milestones.',
            },
        ],
    },

    'social': {
        'critical': [
            {
                'title': 'Implement Occupational Health & Safety Management System',
                'description': 'OHS data is absent or incomplete. Implement an ISO 45001-aligned safety management system and begin tracking LTIFR and near-miss incidents.',
                'gri_standard': 'GRI 403-1 · GRI 403-9',
                'timeline_days': 90,
                'effort': 'High',
                'quick_win': 'Conduct a baseline H&S risk assessment across all operational sites within 45 days.',
            },
            {
                'title': 'Establish Human Rights Due Diligence Process',
                'description': 'No formal human rights risk assessment exists. Adopt a UNGP-aligned human rights due diligence process covering own operations and first-tier suppliers.',
                'gri_standard': 'GRI 409-1 · GRI 414-1',
                'timeline_days': 120,
                'effort': 'Medium',
                'quick_win': 'Map tier-1 suppliers by country and flag high human rights risk jurisdictions.',
            },
        ],
        'initial': [
            {
                'title': 'Publish Living Wage Commitment',
                'description': 'Compensation policies do not reference living wage benchmarks. Conduct a pay equity analysis and commit to closing gender pay gaps within a defined timeline.',
                'gri_standard': 'GRI 401-2 · GRI 405-2',
                'timeline_days': 90,
                'effort': 'Medium',
                'quick_win': 'Commission a gender pay gap analysis and publish the findings.',
            },
            {
                'title': 'Formalise Employee Training & Development Programmes',
                'description': 'Training hours and career development metrics are not tracked. Set minimum annual training hours per employee and link to succession planning.',
                'gri_standard': 'GRI 404-1 · GRI 404-2',
                'timeline_days': 90,
                'effort': 'Low',
                'quick_win': 'Introduce a learning management system (LMS) and track completion rates.',
            },
        ],
        'developing': [
            {
                'title': 'Advance Supply Chain Social Audit Programme',
                'description': 'Own-operations social performance is developing. Extend the due diligence programme to tier-2 suppliers using a recognised audit standard (SMETA, SA8000, or BSCI).',
                'gri_standard': 'GRI 414-2 · GRI 408-1',
                'timeline_days': 180,
                'effort': 'High',
                'quick_win': 'Require all tier-1 suppliers to complete a self-assessment questionnaire this year.',
            },
            {
                'title': 'Strengthen Community Investment Strategy',
                'description': 'Local community engagement is ad hoc. Define a structured community investment strategy with a dedicated budget, outcome KPIs, and grievance mechanism.',
                'gri_standard': 'GRI 413-1 · GRI 413-2',
                'timeline_days': 120,
                'effort': 'Medium',
                'quick_win': 'Map the 5 most material community stakeholder groups within 30 days.',
            },
        ],
        'good': [
            {
                'title': 'Set Diversity, Equity & Inclusion Targets',
                'description': 'Social performance is strong. Formalise DEI targets at board and senior management level, including gender, ethnicity, and disability representation.',
                'gri_standard': 'GRI 405-1 · GRI 406-1',
                'timeline_days': 120,
                'effort': 'Medium',
                'quick_win': 'Publish current demographic data and set 3-year representation targets.',
            },
        ],
        'excellent': [
            {
                'title': 'Benchmark Against UN SDGs and Social Value Reporting',
                'description': 'Social leadership is confirmed. Quantify your social value creation using SROI methodology and map all programmes directly to the SDGs for investor and donor reporting.',
                'gri_standard': 'GRI 413-1 · SDGs 1,3,8,10',
                'timeline_days': 270,
                'effort': 'High',
                'quick_win': 'Commission a social value assessment (SROI) for the flagship community programme.',
            },
        ],
    },

    'general': {
        'critical': [
            {
                'title': 'Build an ESG Data Infrastructure',
                'description': 'Sector-specific ESG data is not systematically collected. Implement a dedicated ESG data management system and assign ownership for each metric.',
                'gri_standard': 'GRI 2-3',
                'timeline_days': 90,
                'effort': 'Medium',
                'quick_win': 'Map all required sector KPIs and assign a data owner per metric within 30 days.',
            },
        ],
        'initial': [
            {
                'title': 'Develop Sector-Specific Sustainability Targets',
                'description': 'Generic ESG targets do not reflect the material risks of your sector. Benchmark against sector peers and define at least 3 sector-specific KPIs.',
                'gri_standard': 'GRI 3-3',
                'timeline_days': 90,
                'effort': 'Medium',
                'quick_win': 'Review the relevant GRI Sector Standard and identify the top 5 material topics.',
            },
        ],
        'developing': [
            {
                'title': 'Engage Industry Associations & Peer Benchmarking',
                'description': 'Sector performance is developing. Join an industry sustainability coalition (e.g., sector-specific CEO groups) to access benchmarking data and collaborative targets.',
                'gri_standard': 'GRI 2-28',
                'timeline_days': 180,
                'effort': 'Low',
                'quick_win': 'Identify and attend 2 sector sustainability forums this year.',
            },
        ],
        'good': [
            {
                'title': 'Pursue Sector-Specific Certification or Rating',
                'description': 'Strong sector performance is in place. Pursue a sector-recognised sustainability certification or rating (e.g., EcoVadis, MSCI ESG, CDP) to validate progress externally.',
                'gri_standard': 'GRI 2-5',
                'timeline_days': 270,
                'effort': 'Medium',
                'quick_win': 'Complete the EcoVadis self-assessment this quarter.',
            },
        ],
        'excellent': [
            {
                'title': 'Lead Sector Transformation Initiatives',
                'description': 'Your sector ESG performance is leading. Take an active role in industry standard-setting groups and share best practices through published case studies.',
                'gri_standard': 'GRI 2-28 · GRI 2-29',
                'timeline_days': 365,
                'effort': 'Low',
                'quick_win': 'Publish a sector sustainability best-practice case study.',
            },
        ],
    },
}

# Aliases for sector types → map to 'general'
for _k in ('sector_agri', 'sector_finance', 'sector_construction',
           'sector_manufacturing', 'sector_health', 'sector_tech', 'sector_retail'):
    _RECS[_k] = _RECS['general']


# ── Public API ─────────────────────────────────────────────────────────────

def get_recommendations_for_category(name: str, pct: float) -> list:
    """
    Return a list of recommendation dicts for the given category name and
    percentage score. Returns at most 2 recommendations per category to keep
    the report concise.
    """
    cat_type = _cat_type(name)
    band     = _band(pct)
    pool     = _RECS.get(cat_type, _RECS['general']).get(band, [])
    recs = []
    for r in pool[:2]:
        recs.append({
            'category':      name,
            'priority':      _priority(pct),
            'gri_standard':  r.get('gri_standard', ''),
            'title':         r['title'],
            'description':   r['description'],
            'quick_win':     r.get('quick_win', ''),
            'timeline_days': r.get('timeline_days', 90),
            'effort':        r.get('effort', 'Medium'),
            'score_pct':     round(pct),
        })
    return recs


def _priority(pct: float) -> str:
    if pct < 40:  return 'High'
    if pct < 65:  return 'Medium'
    return 'Low'


def maturity_narrative(pct: float, lang: str = 'en') -> str:
    """Return a one-paragraph interpretation of the score for use in reports."""
    band = _band(pct)
    narratives = {
        'en': {
            'critical':   f'Your current score of {round(pct)}% indicates that foundational ESG practices are largely absent. Immediate action is required to establish basic governance, measurement, and disclosure processes before regulatory and investor expectations intensify.',
            'initial':    f'A score of {round(pct)}% suggests that ESG efforts are underway but remain fragmented and informal. The priority is to formalise commitments, assign ownership, and begin systematic data collection.',
            'developing': f'At {round(pct)}%, your organisation has solid ESG foundations in place. The focus should shift from establishment to performance improvement — tightening targets, expanding scope, and improving disclosure quality.',
            'good':       f'Your score of {round(pct)}% places you in the upper tier of ESG performers. Key priorities are third-party assurance, deeper supply-chain engagement, and alignment with advanced frameworks such as TCFD and CSRD.',
            'excellent':  f'A score of {round(pct)}% reflects leading ESG practice. Your challenge is to maintain momentum, drive industry-level change, and move towards integrated value reporting that connects financial and non-financial performance.',
        },
        'tr': {
            'critical':   f'Mevcut {round(pct)}% puanınız, temel ESG uygulamalarının büyük ölçüde eksik olduğunu göstermektedir. Düzenleyici ve yatırımcı beklentileri yoğunlaşmadan önce temel yönetişim, ölçüm ve açıklama süreçlerini oluşturmak için acil eylem gerekmektedir.',
            'initial':    f'{round(pct)}% puanı, ESG çalışmalarının başladığını ancak parçalı ve gayri resmi kaldığını göstermektedir. Öncelik, taahhütleri resmileştirmek, sorumluluk atamak ve sistematik veri toplamaya başlamaktır.',
            'developing': f'{round(pct)}% ile kuruluşunuz sağlam ESG temelleri atmıştır. Odak noktası artık oluşturma yerine performans iyileştirmesine kaymalıdır — hedeflerin sıkılaştırılması, kapsam genişlemesi ve açıklama kalitesinin artırılması.',
            'good':       f'{round(pct)}% puanınız sizi ESG performansçılarının üst kademesine yerleştirmektedir. Temel öncelikler, üçüncü taraf güvencesi, daha derin tedarik zinciri etkileşimi ve TCFD ile CSRD gibi gelişmiş çerçevelerle uyumdur.',
            'excellent':  f'{round(pct)}% puanı, lider ESG pratiğini yansıtmaktadır. Zorluğunuz ivmeyi korumak, sektör düzeyinde değişimi yönlendirmek ve finansal ile finansal olmayan performansı birbirine bağlayan entegre değer raporlamasına geçmektir.',
        },
    }
    return narratives.get(lang, narratives['en'])[band]
