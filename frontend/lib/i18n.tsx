'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

/* ============================================================
   Translations — English + Türkçe
   ============================================================ */
const TRANSLATIONS: Record<string, { en: string; tr: string }> = {
  /* Nav */
  nav_platform:    { en: 'Platform',    tr: 'Platform' },
  nav_methodology: { en: 'Methodology', tr: 'Metodoloji' },
  nav_about:       { en: 'About',       tr: 'Hakkımızda' },
  nav_signin:      { en: 'Sign in',     tr: 'Giriş yap' },
  nav_get_started: { en: 'Get started', tr: 'Başlayın' },
  nav_overview:    { en: 'Overview',    tr: 'Genel bakış' },
  nav_surveys:     { en: 'Surveys',     tr: 'Anketler' },
  nav_results:     { en: 'Results',     tr: 'Sonuçlar' },
  nav_history:     { en: 'History',     tr: 'Geçmiş' },
  nav_back_home:   { en: 'Back to home', tr: 'Ana sayfaya dön' },
  nav_courses:     { en: 'Courses',      tr: 'Kurslar' },
  nav_logout:      { en: 'Log out',      tr: 'Çıkış yap' },

  /* Courses */
  // Fix MEDIUM: removed hardcoded "8 courses" — count comes from the API dynamically.
  courses_eyebrow: { en: 'E-Learning',   tr: 'E-Öğrenme' },
  courses_count:   { en: 'courses',      tr: 'kurs' },
  courses_h_1:     { en: 'Sustainability',          tr: 'Sürdürülebilirlik' },
  courses_h_2:     { en: 'mastery,',                tr: 'uzmanlığı,' },
  courses_h_3:     { en: 'self-paced.',             tr: 'kendi hızınızda.' },
  courses_desc: {
    en: 'Curated courses on ESG frameworks, carbon accounting, and reporting standards. Designed for sustainability teams, finance leads, and board members.',
    tr: 'ESG çerçeveleri, karbon muhasebesi ve raporlama standartları üzerine seçkin kurslar. Sürdürülebilirlik ekipleri, finans liderleri ve yönetim kurulu üyeleri için tasarlanmıştır.',
  },
  courses_filter_all:    { en: 'All',         tr: 'Tümü' },
  courses_filter_active: { en: 'In progress', tr: 'Devam eden' },
  courses_filter_done:   { en: 'Completed',   tr: 'Tamamlandı' },
  courses_filter_new:    { en: 'New',         tr: 'Yeni' },
  courses_modules:       { en: 'modules',     tr: 'modül' },
  courses_resume:        { en: 'Resume',      tr: 'Devam Et' },
  courses_start:         { en: 'Start',       tr: 'Başla' },
  courses_review:        { en: 'Review',      tr: 'Gözden geçir' },
  courses_certificate:   { en: 'Certificate', tr: 'Sertifika' },
  courses_level_beg:     { en: 'Beginner',    tr: 'Başlangıç' },
  courses_level_int:     { en: 'Intermediate',tr: 'Orta' },
  courses_level_adv:     { en: 'Advanced',    tr: 'İleri' },
  courses_results:       { en: 'results',     tr: 'sonuç' },
  courses_empty:         { en: 'No courses found in this category.', tr: 'Bu kategoride kurs bulunamadı.' },
  // Fix R4-H-02: distinct error message when the courses API call fails
  courses_load_error:    { en: 'Courses could not be loaded. Please try again later.', tr: 'Kurslar yüklenemedi. Lütfen daha sonra tekrar deneyin.' },

  course_1_t: { en: 'ISO 26000 Fundamentals',          tr: 'ISO 26000 Temelleri' },
  course_1_d: { en: 'A comprehensive introduction to the international social responsibility standard.', tr: 'Uluslararası sosyal sorumluluk standardına kapsamlı bir giriş.' },
  course_2_t: { en: 'GRI Standards Deep-Dive',         tr: 'GRI Standartları Derinlemesine' },
  course_2_d: { en: 'Master the Global Reporting Initiative framework for sustainability disclosures.', tr: 'Sürdürülebilirlik açıklamaları için GRI çerçevesinde uzmanlaşın.' },
  course_3_t: { en: 'Carbon Accounting · Scope 1–3',  tr: 'Karbon Muhasebesi · Kapsam 1–3' },
  course_3_d: { en: 'Measure, calculate, and disclose your full emissions inventory.', tr: 'Tam emisyon envanterinizi ölçün, hesaplayın ve açıklayın.' },
  course_4_t: { en: 'ESG Reporting for Boards',        tr: 'Yönetim Kurulları için ESG Raporlama' },
  course_4_d: { en: 'How to brief directors and prepare board-grade sustainability disclosures.', tr: 'Yöneticilerin nasıl bilgilendirileceği ve yönetim kurulu seviyesinde sürdürülebilirlik açıklamalarının hazırlanması.' },
  course_5_t: { en: 'Double Materiality Assessment',   tr: 'Çift Önemlilik Değerlendirmesi' },
  course_5_d: { en: 'Identify, evaluate, and prioritize material ESG topics for your organization.', tr: 'Kuruluşunuz için önemli ESG konularını belirleyin, değerlendirin ve önceliklendirin.' },
  course_6_t: { en: 'Stakeholder Engagement Strategy', tr: 'Paydaş Katılım Stratejisi' },
  course_6_d: { en: 'Frameworks for meaningful dialogue with internal and external stakeholders.', tr: 'İç ve dış paydaşlarla anlamlı diyalog için çerçeveler.' },
  course_7_t: { en: 'SASB Industry Standards',         tr: 'SASB Sektör Standartları' },
  course_7_d: { en: 'Industry-specific sustainability metrics aligned with financial materiality.', tr: 'Finansal önemlilikle uyumlu sektöre özgü sürdürülebilirlik metrikleri.' },
  course_8_t: { en: 'CSRD & EU Taxonomy',              tr: 'CSRD ve AB Taksonomisi' },
  course_8_d: { en: "Navigate Europe's sustainability reporting directive and taxonomy.", tr: "Avrupa'nın sürdürülebilirlik raporlama direktifi ve taksonomisinde yön bulun." },

  /* Hero */
  hero_pill:     { en: 'Sustainability Index Platform',  tr: 'Sürdürülebilirlik Endeksi Platformu' },
  hero_h_1:      { en: 'Your sustainability,',           tr: 'Sürdürülebilirliğiniz,' },
  hero_h_2:      { en: 'indexed.',                       tr: 'endekslendi.' },
  hero_sub: {
    en: 'A comprehensive ESG measurement platform — score your performance, benchmark against peers, and generate board-ready reports aligned with ISO 26000, GRI, and SASB.',
    tr: 'Kapsamlı bir ESG ölçüm platformu — performansınızı puanlayın, sektörle kıyaslayın ve ISO 26000, GRI ve SASB ile uyumlu yönetici raporları oluşturun.',
  },
  hero_cta_main: { en: 'Start Assessment', tr: 'Değerlendirmeye Başla' },
  hero_cta_alt:  { en: 'View Dashboard',   tr: 'Paneli Görüntüle' },
  cta_short:     { en: 'Ready to begin?',  tr: 'Başlamaya hazır mısınız?' },
  cta_desc_short:{ en: 'Free to start. No card, no setup.', tr: 'Ücretsiz başlayın. Kart yok, kurulum yok.' },

  /* Pillars */
  pillar_env:     { en: 'Environmental', tr: 'Çevresel' },
  pillar_soc:     { en: 'Social',        tr: 'Sosyal' },
  pillar_gov:     { en: 'Governance',    tr: 'Yönetişim' },
  pillar_env_sub: { en: 'Planet impact',      tr: 'Gezegen üzerindeki etki' },
  pillar_soc_sub: { en: 'People first',       tr: 'Önce insan' },
  pillar_gov_sub: { en: 'Ethical leadership', tr: 'Etik liderlik' },

  /* Methodology steps */
  meth_process: { en: 'Assessment process', tr: 'Değerlendirme süreci' },
  step_1_t: { en: 'Register',  tr: 'Kayıt ol' },
  step_1_d: { en: 'Create your account in under a minute.',          tr: 'Hesabınızı bir dakikadan kısa sürede oluşturun.' },
  step_2_t: { en: 'Answer',    tr: 'Yanıtla' },
  step_2_d: { en: 'Respond to 12 indicators across E·S·G.',           tr: 'Ç·S·Y arasında 12 göstergeyi yanıtlayın.' },
  step_3_t: { en: 'Get Report', tr: 'Rapor Al' },
  step_3_d: { en: 'Receive your calculated score and download the executive-grade PDF.', tr: 'Hesaplanan puanınızı alın ve yönetici seviyesinde PDF\'inizi indirin.' },

  /* Footer */
  foot_platform:   { en: 'Platform',    tr: 'Platform' },
  foot_overview:   { en: 'Overview',    tr: 'Genel bakış' },
  foot_methodology:{ en: 'Methodology', tr: 'Metodoloji' },
  foot_assessments:{ en: 'Assessments', tr: 'Değerlendirmeler' },
  foot_reports:    { en: 'Reports',     tr: 'Raporlar' },
  foot_priv:       { en: 'Privacy',     tr: 'Gizlilik' },
  foot_terms:      { en: 'Terms',       tr: 'Şartlar' },
  foot_cookies:    { en: 'Cookies',     tr: 'Çerezler' },
  // Fix L-05: use {year} placeholder — evaluated by t() at render time so the
  // year is always current even in long-running server processes.
  // (Template literals in object literals are evaluated once at module load time,
  //  which would show the wrong year after midnight on 31 Dec.)
  foot_copy: {
    en: '© {year} Sustindex · Academia Danışmanlık',
    tr: '© {year} Sustindex · Academia Danışmanlık',
  },

  /* Shared error messages */
  // Fix R5-M-06: HTTP 429 throttle response needs user-friendly copy
  err_throttle:  { en: 'Too many attempts. Please wait a moment before trying again.', tr: 'Çok fazla deneme. Lütfen bir süre bekleyip tekrar deneyin.' },
  // Fix R5-L-08: loading state shared key
  t_loading_auth: { en: 'LOADING…', tr: 'YÜKLENİYOR…' },

  /* Login */
  login_eyebrow:  { en: 'Welcome back',             tr: 'Tekrar hoş geldiniz' },
  login_title:    { en: 'Sign in.',                  tr: 'Giriş yapın.' },
  login_desc:     { en: 'Continue your sustainability assessment, or pick up where you left off.', tr: 'Sürdürülebilirlik değerlendirmenize devam edin veya kaldığınız yerden başlayın.' },
  login_username: { en: 'Username',                 tr: 'Kullanıcı adı' },
  login_password: { en: 'Password',                 tr: 'Şifre' },
  login_forgot:   { en: 'Forgot it?',               tr: 'Unuttunuz mu?' },
  login_submit:   { en: 'Sign in',                  tr: 'Giriş yap' },
  login_create:   { en: 'Create an account',        tr: 'Hesap oluşturun' },
  login_secure:   { en: 'Secure',                   tr: 'Güvenli' },
  login_iso:      { en: 'ISO Aligned',              tr: 'ISO Uyumlu' },
  login_gdpr:     { en: 'GDPR Compliant',           tr: 'KVKK Uyumlu' },

  /* Register */
  reg_top_member: { en: 'Already a member?',       tr: 'Zaten üye misiniz?' },
  reg_eyebrow:    { en: 'Create account · Free',   tr: 'Hesap oluştur · Ücretsiz' },
  reg_title_1:    { en: 'Get your',                tr: 'İlk puanınızı' },
  reg_title_2:    { en: 'first score',             tr: 'yirmi dakikada' },
  reg_title_3:    { en: 'in twenty minutes.',      tr: 'alın.' },
  reg_desc:       { en: 'Set up your organization, complete your first assessment, and download a professional report — all without leaving the platform.', tr: 'Kuruluşunuzu kurun, ilk değerlendirmenizi tamamlayın ve profesyonel bir raporu — platformdan çıkmadan — indirin.' },
  reg_sec_1_t:    { en: 'Account',      tr: 'Hesap' },
  reg_sec_1_s:    { en: 'Your login credentials', tr: 'Giriş bilgileriniz' },
  reg_sec_2_t:    { en: 'Personal',     tr: 'Kişisel' },
  reg_sec_2_s:    { en: "Who's filling this out", tr: 'Formu kim dolduruyor' },
  reg_sec_3_t:    { en: 'Organization', tr: 'Kuruluş' },
  reg_sec_3_s:    { en: 'The entity being assessed', tr: 'Değerlendirilen kuruluş' },
  reg_sec_4_t:    { en: 'Security',     tr: 'Güvenlik' },
  reg_sec_4_s:    { en: 'Choose a strong password', tr: 'Güçlü bir şifre seçin' },
  reg_username:   { en: 'Username',     tr: 'Kullanıcı adı' },
  reg_email:      { en: 'Email',        tr: 'E-posta' },
  reg_first:      { en: 'First name',   tr: 'Ad' },
  reg_last:       { en: 'Last name',    tr: 'Soyad' },
  reg_company:    { en: 'Company name', tr: 'Şirket adı' },
  reg_phone:      { en: 'Phone',        tr: 'Telefon' },
  reg_pw:         { en: 'Password',     tr: 'Şifre' },
  reg_pw_confirm: { en: 'Confirm password', tr: 'Şifre tekrar' },
  reg_pw_hint:    { en: 'Min. 8 characters', tr: 'En az 8 karakter' },
  reg_pw_again:   { en: 'Repeat password', tr: 'Şifreyi tekrarlayın' },
  reg_legal:      { en: 'By creating an account, you agree to our', tr: 'Hesap oluşturarak şunları kabul ediyorsunuz:' },
  reg_legal_and:  { en: 'and acknowledge our',  tr: 've şunları onaylıyorsunuz:' },
  reg_legal_terms:{ en: 'Terms',          tr: 'Şartlar' },
  reg_legal_priv: { en: 'Privacy Policy', tr: 'Gizlilik Politikası' },
  reg_submit:       { en: 'Create account',  tr: 'Hesap oluştur' },
  reg_pw_mismatch:  { en: 'Passwords do not match.', tr: 'Şifreler eşleşmiyor.' },
  reg_fail:         { en: 'Registration failed. Please check your details.', tr: 'Kayıt başarısız. Lütfen bilgileri kontrol edin.' },
  reg_submitting:   { en: 'Creating…',       tr: 'Oluşturuluyor…' },

  /* Dashboard */
  dash_new:       { en: 'New assessment',    tr: 'Yeni değerlendirme' },
  dash_esg_title: { en: 'Sustainability Assessment 2025', tr: 'Sürdürülebilirlik Değerlendirmesi 2025' },
  dash_view_full: { en: 'View full report',  tr: 'Tam raporu görüntüle' },
  dash_q12026:    { en: 'Q1 2026 Assessment',tr: 'Ç1 2026 Değerlendirmesi' },
  dash_resume_d:  { en: '7 of 12 questions answered. About 8 minutes left.', tr: '12 sorudan 7\'si yanıtlandı. Yaklaşık 8 dakika kaldı.' },
  dash_continue:  { en: 'Continue',          tr: 'Devam' },
  dash_link_1:    { en: 'Browse all surveys',     tr: 'Tüm anketlere göz at' },
  dash_link_2:    { en: 'Assessment history',     tr: 'Değerlendirme geçmişi' },
  dash_link_3:    { en: 'Edit profile',           tr: 'Profili düzenle' },
  dash_link_4:    { en: 'Download last report',   tr: 'Son raporu indir' },
  row_1: { en: 'Sustainability Assessment 2025', tr: 'Sürdürülebilirlik Değerlendirmesi 2025' },
  row_2: { en: 'Mid-year ESG Review',            tr: 'Yıl ortası ESG İncelemesi' },
  row_3: { en: 'Supplier Sustainability Audit',  tr: 'Tedarikçi Sürdürülebilirlik Denetimi' },
  row_4: { en: 'Annual ESG Baseline', tr: 'Yıllık ESG Temel Değerlendirmesi' },

  /* Surveys */
  surv_desc:      { en: 'Each survey is calibrated to a different scope. Start with the core baseline, or jump straight to a focused review.', tr: 'Her anket farklı bir kapsama göre kalibre edilmiştir. Temel değerlendirme ile başlayın veya doğrudan odaklı bir incelemeye geçin.' },
  surv_start_err: { en: 'Could not start. Please try again.',   tr: 'Başlatılamadı, tekrar dene.' },
  surv_opening:   { en: 'Opening…',                             tr: 'Açılıyor…' },
  surv_questions: { en: 'questions', tr: 'soru' },
  surv_start:     { en: 'Start',     tr: 'Başla' },
  surv_1_t:  { en: 'Sustainability Assessment 2026', tr: 'Sürdürülebilirlik Değerlendirmesi 2026' },
  surv_1_d:  { en: 'Comprehensive ESG evaluation across 12 indicators. Recommended baseline.', tr: '12 gösterge boyunca kapsamlı ESG değerlendirmesi. Önerilen temel ölçüm.' },
  surv_1_tag:{ en: 'Core',        tr: 'Temel' },
  surv_2_t:  { en: 'Supplier ESG Audit', tr: 'Tedarikçi ESG Denetimi' },
  surv_2_d:  { en: 'Lightweight assessment for evaluating supplier sustainability performance.', tr: 'Tedarikçi sürdürülebilirlik performansını değerlendirmek için hafif bir değerlendirme.' },
  surv_2_tag:{ en: 'Tier 2',      tr: 'Kademe 2' },
  surv_3_t:  { en: 'Carbon Footprint Deep-Dive', tr: 'Karbon Ayak İzi Derinlemesine İnceleme' },
  surv_3_d:  { en: 'Scope 1, 2, and 3 emissions inventory with sector-specific weightings.', tr: 'Sektöre özgü ağırlıklarla Kapsam 1, 2 ve 3 emisyon envanteri.' },
  surv_3_tag:{ en: 'Environmental', tr: 'Çevresel' },
  surv_4_t:  { en: 'Governance & Ethics Review', tr: 'Yönetişim ve Etik İncelemesi' },
  surv_4_d:  { en: 'Board independence, ethics programs, and stakeholder reporting depth.', tr: 'Yönetim kurulu bağımsızlığı, etik programlar ve paydaş raporlama derinliği.' },
  surv_4_tag:{ en: 'Governance', tr: 'Yönetişim' },
  surv_5_t:  { en: 'Workforce & D&I Snapshot', tr: 'İşgücü ve Çeşitlilik Görünümü' },
  surv_5_d:  { en: 'Employee wellbeing, diversity metrics, training hours, and safety record.', tr: 'Çalışan refahı, çeşitlilik metrikleri, eğitim saatleri ve güvenlik kaydı.' },
  surv_5_tag:{ en: 'Social',     tr: 'Sosyal' },
  surv_6_t:  { en: 'Annual Disclosure Pack', tr: 'Yıllık Açıklama Paketi' },
  surv_6_d:  { en: 'GRI-aligned annual disclosure for public reporting requirements.', tr: 'Kamu raporlama gereksinimleri için GRI uyumlu yıllık açıklama.' },
  surv_6_tag:{ en: 'Reporting',  tr: 'Raporlama' },

  /* ── Sector-selection modal (branching questionnaire) ────────────────────── */
  surv_sector_title: {
    en: 'Select your industry sector',
    tr: 'Sektörünüzü seçin',
  },
  surv_sector_desc: {
    en: 'Choose the sector that best describes your organization. Common questions will be shown to everyone; sector-specific questions will then be added for your chosen sector.',
    tr: 'Organizasyonunuzu en iyi tanımlayan sektörü seçin. Ortak sorular herkese gösterilir; seçtiğiniz sektöre özgü sorular ayrıca eklenir.',
  },
  surv_sector_universal:    { en: 'General (no specific sector)',     tr: 'Genel (belirli bir sektör yok)' },
  surv_sector_agri:         { en: 'Agriculture & Food',               tr: 'Tarım & Gıda' },
  surv_sector_energy:       { en: 'Energy & Utilities',               tr: 'Enerji & Hizmetler' },
  surv_sector_finance:      { en: 'Financial Services',               tr: 'Finans Hizmetleri' },
  surv_sector_construction: { en: 'Construction & Real Estate',       tr: 'İnşaat & Gayrimenkul' },
  surv_sector_manufacturing:{ en: 'Manufacturing & Industry',         tr: 'İmalat & Sanayi' },
  surv_sector_health:       { en: 'Healthcare & Life Sciences',       tr: 'Sağlık & Yaşam Bilimleri' },
  surv_sector_tech:         { en: 'Technology & Digital',             tr: 'Teknoloji & Dijital' },
  surv_sector_retail:       { en: 'Retail & Trade',                   tr: 'Perakende & Ticaret' },
  surv_sector_confirm:      { en: 'Continue to Assessment',           tr: 'Değerlendirmeye Devam Et' },
  surv_sector_cancel:       { en: 'Cancel',                           tr: 'İptal' },

  /* Questionnaire */
  q_autosaved: { en: 'Auto-saved 2s ago', tr: '2 saniye önce otomatik kaydedildi' },
  q_save_exit: { en: 'Save & exit',       tr: 'Kaydet ve çık' },
  q_question:  { en: 'Does your organization have a formal policy on workplace diversity, equity, and inclusion?', tr: 'Kuruluşunuzun işyerinde çeşitlilik, eşitlik ve kapsayıcılık konusunda resmi bir politikası var mı?' },
  q_hint:      { en: "Select the option that best describes your organization's current state. Choose one answer.", tr: 'Kuruluşunuzun mevcut durumunu en iyi tanımlayan seçeneği belirleyin. Bir yanıt seçin.' },
  q_opt_a:     { en: 'Yes — comprehensive policy with annual third-party audits', tr: 'Evet — yıllık bağımsız denetimli kapsamlı politika' },
  q_opt_b:     { en: 'Yes — internal policy reviewed annually', tr: 'Evet — yıllık gözden geçirilen iç politika' },
  q_opt_c:     { en: 'In development — being formalized this fiscal year', tr: 'Geliştirme aşamasında — bu mali yılda resmileştiriliyor' },
  q_opt_d:     { en: 'No formal policy in place', tr: 'Resmi bir politika yok' },
  q_pts:       { en: 'pts',  tr: 'puan' },
  q_uploads:   { en: 'Supporting documents · optional', tr: 'Destekleyici belgeler · isteğe bağlı' },
  q_uploads_d: { en: 'Attach your D&I policy, training materials, or audit reports to strengthen your answer.', tr: 'Yanıtınızı güçlendirmek için Çeşitlilik politikanızı, eğitim materyallerini veya denetim raporlarını ekleyin.' },
  q_choose:    { en: 'Choose files',  tr: 'Dosya seç' },
  q_prev:      { en: '← Previous',   tr: '← Önceki' },
  q_next:      { en: 'Next question', tr: 'Sonraki soru' },

  /* Results */
  res_back:       { en: '← Back to overview', tr: '← Genel bakışa dön' },
  res_share:      { en: 'Share',              tr: 'Paylaş' },
  res_export:     { en: 'Export PDF',         tr: 'PDF olarak dışa aktar' },
  res_title:      { en: 'Sustainability Assessment 2025', tr: 'Sürdürülebilirlik Değerlendirmesi 2025' },
  res_framework:  { en: 'Framework',           tr: 'Çerçeve' },
  res_ind_env_1:  { en: 'Carbon footprint',    tr: 'Karbon ayak izi' },
  res_ind_env_2:  { en: 'Energy intensity',    tr: 'Enerji yoğunluğu' },
  res_ind_env_3:  { en: 'Waste diversion',     tr: 'Atık geri kazanımı' },
  res_ind_env_4:  { en: 'Water stewardship',   tr: 'Su yönetimi' },
  res_ind_soc_1:  { en: 'Diversity & inclusion', tr: 'Çeşitlilik ve kapsayıcılık' },
  res_ind_soc_2:  { en: 'Training hours',      tr: 'Eğitim saatleri' },
  res_ind_soc_3:  { en: 'Community impact',    tr: 'Toplumsal etki' },
  res_ind_soc_4:  { en: 'Health & safety',     tr: 'İş sağlığı ve güvenliği' },
  res_ind_gov_1:  { en: 'Board independence',  tr: 'Kurul bağımsızlığı' },
  res_ind_gov_2:  { en: 'Disclosure quality',  tr: 'Açıklama kalitesi' },
  res_ind_gov_3:  { en: 'Ethics program',      tr: 'Etik programı' },
  res_ind_gov_4:  { en: 'Stakeholder engagement', tr: 'Paydaş katılımı' },
  res_recs_eye:   { en: 'Prioritized recommendations', tr: 'Önceliklendirilmiş öneriler' },
  res_recs_sub:   { en: '5 actions · estimated +9 points', tr: '5 eylem · tahmini +9 puan' },
  res_p_high:     { en: 'High',   tr: 'Yüksek' },
  res_p_med:      { en: 'Medium', tr: 'Orta' },
  res_p_low:      { en: 'Low',    tr: 'Düşük' },
  res_r_1_t:      { en: 'Implement Scope 3 emissions tracking', tr: 'Kapsam 3 emisyon takibini uygulayın' },
  res_r_1_d:      { en: 'Establish supplier emissions reporting requirements. Currently the largest gap in your environmental score.', tr: 'Tedarikçi emisyon raporlama gerekliliklerini oluşturun. Şu anda çevresel puanınızdaki en büyük boşluk.' },
  res_r_2_t:      { en: 'Publish quarterly D&I metrics externally', tr: 'Üç aylık çeşitlilik metriklerini dışa açıklayın' },
  res_r_2_d:      { en: 'Internal tracking is strong; external disclosure would meaningfully raise governance score.', tr: 'İç takip güçlü; dışsal açıklama yönetişim puanını anlamlı şekilde yükseltir.' },
  res_r_3_t:      { en: 'Expand board independence ratio', tr: 'Yönetim kurulu bağımsızlık oranını artırın' },
  res_r_3_d:      { en: 'Add 1–2 independent directors to reach the 50%+ threshold most peers maintain.', tr: 'Sektör ortalamasındaki %50+ eşiğine ulaşmak için 1–2 bağımsız üye ekleyin.' },
  res_r_4_t:      { en: 'Formalize whistleblower program', tr: 'İhbar programını resmileştirin' },
  res_r_4_d:      { en: 'A documented anonymous reporting channel would close a key ethics indicator.', tr: 'Belgelenmiş anonim raporlama kanalı önemli bir etik göstergeyi kapatır.' },
  res_r_5_t:      { en: 'Set science-based emissions targets', tr: 'Bilim temelli emisyon hedefleri belirleyin' },
  res_r_5_d:      { en: 'Commit to SBTi-validated reduction pathway by next reporting cycle.', tr: 'Bir sonraki raporlama döngüsüne kadar SBTi onaylı azaltım yoluna bağlanın.' },

  /* Course detail */
  course_back:         { en: '← Back to Courses',           tr: '← Kurslara Dön' },
  course_not_found:    { en: 'Course not found.',            tr: 'Kurs bulunamadı.' },
  course_load_fail:    { en: 'Failed to load course.',       tr: 'Kurs yüklenemedi.' },
  course_complete_err: { en: 'Could not save progress. Please try again.', tr: 'İlerleme kaydedilemedi. Lütfen tekrar deneyin.' },
  course_progress:     { en: 'Progress',                     tr: 'İlerleme' },
  course_lessons_word: { en: 'lessons',                      tr: 'ders' },
  course_lessons_head: { en: 'Lessons',                      tr: 'Dersler' },
  course_complete_msg: { en: 'Course complete!',             tr: 'Kurs tamamlandı!' },
  course_start:        { en: 'Start lesson',                 tr: 'Derse başla' },
  course_mark_done:    { en: 'Mark complete',                tr: 'Tamamlandı olarak işaretle' },
  course_completing:   { en: 'Saving…',                      tr: 'Kaydediliyor…' },
  course_completed_b:  { en: '✓ Completed',                  tr: '✓ Tamamlandı' },
  course_mins:         { en: 'min',                          tr: 'dk' },
  course_attachment:   { en: 'Attachment',                   tr: 'Ek dosya' },
  course_attachments:  { en: 'Attachments',                  tr: 'Ekler' },
  course_video:        { en: 'Watch video',                  tr: 'Videoyu izle' },
  course_remaining:    { en: 'lessons remaining',            tr: 'ders kaldı' },
  course_back_dash:    { en: 'Back to Dashboard',            tr: 'Panele Dön' },
  t_loading:           { en: 'Loading…',                     tr: 'Yükleniyor…' },

  /* Login extras */
  login_remember:      { en: 'Remember me',                  tr: 'Beni hatırla' },
  login_no_account:    { en: 'No account?',                  tr: 'Hesabınız yok mu?' },
  login_fail:          { en: 'Login failed. Please check your credentials.', tr: 'Giriş başarısız. Bilgilerinizi kontrol edin.' },
  login_submitting:    { en: 'Signing in…',                  tr: 'Giriş yapılıyor…' },
  t_or:                { en: 'or',                           tr: 'veya' },

  /* Dashboard extras */
  dash_cont_learn:     { en: 'Continue Learning',            tr: 'Öğrenmeye Devam Et' },
  dash_all_courses:    { en: 'All courses',                  tr: 'Tüm kurslar' },
  dash_coming_soon:    { en: '🔒 More courses coming soon — content being prepared.', tr: '🔒 Daha fazla kurs yakında eklenecek.' },
  dash_e_learning:     { en: 'E-Learning',                   tr: 'E-Öğrenim' },
  dash_sust_courses:   { en: 'Sustainability courses',       tr: 'Sürdürülebilirlik kursları' },
  dash_view_all:       { en: 'View All',                     tr: 'Tüm Kurslar' },

  /* About */
  about_eye:       { en: 'About sustindex',           tr: 'Sustindex hakkında' },
  about_title_1:   { en: "A platform built by people who'd been", tr: 'On yıl boyunca ESG hesap çizelgeleri' },
  about_title_2:   { en: 'filling out',                tr: 'doldurmuş insanlar tarafından' },
  about_title_3:   { en: 'ESG spreadsheets for a decade.', tr: 'kurulmuş bir platform.' },
  about_desc:      { en: "Sustindex is the ESG assessment platform from Academia Consulting. We've spent years guiding companies through their sustainability journeys — sustindex is the tool we wished we had.", tr: "Sustindex, Academia Danışmanlık'ın ESG değerlendirme platformudur. Yıllardır şirketleri sürdürülebilirlik yolculuklarında yönlendiriyoruz — sustindex, sahip olmak istediğimiz araçtı." },
  about_mission:   { en: 'Mission',   tr: 'Misyon' },
  about_mission_h: { en: 'Help every company measure, understand, and improve their sustainability performance.', tr: 'Her şirketin sürdürülebilirlik performansını ölçmesine, anlamasına ve iyileştirmesine yardımcı olmak.' },
  about_mission_d: { en: 'We provide comprehensive ESG assessments based on international standards — GRI, SASB, UN SDGs, and ISO 26000 — and we package them in a workflow that respects the time of the people doing the work.', tr: 'GRI, SASB, BM SKA ve ISO 26000 gibi uluslararası standartlara dayalı kapsamlı ESG değerlendirmeleri sunuyoruz — ve bunları işi yapanların zamanına saygı duyan bir iş akışında paketliyoruz.' },
  about_offer:     { en: 'What we offer',              tr: 'Sunduklarımız' },
  about_o_1_t:     { en: 'Comprehensive assessment',   tr: 'Kapsamlı değerlendirme' },
  about_o_1_d:     { en: 'Detailed evaluation across 30+ sustainability indicators spanning Environmental, Social, and Governance.', tr: 'Çevresel, Sosyal ve Yönetişim alanlarında 30+ sürdürülebilirlik göstergesi üzerinde ayrıntılı değerlendirme.' },
  about_o_2_t:     { en: 'Executive-ready reports',    tr: 'Yönetici düzeyinde raporlar' },
  about_o_2_d:     { en: 'Professional PDFs with benchmarking, trend analysis, and prioritized recommendations — ready for the board.', tr: 'Kıyaslama, trend analizi ve önceliklendirilmiş önerilerle profesyonel PDF\'ler — yönetim kuruluna hazır.' },
  about_o_3_t:     { en: 'Industry standards',         tr: 'Sektör standartları' },
  about_o_3_d:     { en: 'Based on internationally recognized frameworks including GRI, SASB, ISO 26000, and UN SDGs.', tr: 'GRI, SASB, ISO 26000 ve BM SKA gibi uluslararası kabul görmüş çerçevelere dayanmaktadır.' },
  about_o_4_t:     { en: 'Actionable insights',        tr: 'Eyleme dönüştürülebilir içgörüler' },
  about_o_4_d:     { en: 'Receive prioritized recommendations tied to specific gaps in your performance.', tr: 'Performansınızdaki belirli boşluklara bağlı önceliklendirilmiş öneriler alın.' },
  about_contact:   { en: 'Contact',   tr: 'İletişim' },
  about_address:   { en: 'Address',   tr: 'Adres' },
  about_address_v: {
    en: 'Bilişim Vadisi — İstinye Üniversitesi\nAyazağa Mah. Kemerburgaz Cad.\nVadi İstanbul Park, 7A Blok No:7 B\nİç Kapı No:4, Sarıyer / İstanbul',
    tr: 'Bilişim Vadisi — İstinye Üniversitesi\nAyazağa Mah. Kemerburgaz Cad.\nVadi İstanbul Park, 7A Blok No:7 B\nİç Kapı No:4, Sarıyer / İstanbul',
  },
  about_phone:  { en: 'Phone',        tr: 'Telefon' },
  about_fax:    { en: 'Fax',          tr: 'Faks' },
  about_parent: { en: 'Parent company', tr: 'Ana şirket' },

  /* Profile */
  // Fix R4-L-04: client-side email validation message
  profile_email_invalid: {
    en: 'Please enter a valid email address.',
    tr: 'Lütfen geçerli bir e-posta adresi girin.',
  },

  /* ── Forgot Password (R13-02) ────────────────────────────────────────────── */
  fp_back_login:    { en: '← Back to Login',          tr: '← Girişe Dön' },
  fp_eyebrow:       { en: 'Password Reset',            tr: 'Şifre Sıfırlama' },
  fp_title:         { en: 'Forgot your password?',     tr: 'Şifreni mi unuttun?' },
  fp_desc:          {
    en: "Enter the email address associated with your account and we'll send you a reset link.",
    tr: 'Hesabınla ilişkili e-posta adresini gir; sıfırlama bağlantısını göndereceğiz.',
  },
  fp_email_label:   { en: 'Email Address',             tr: 'E-posta Adresi' },
  fp_sending:       { en: 'Sending…',                  tr: 'Gönderiliyor…' },
  fp_submit:        { en: 'Send Reset Link',            tr: 'Sıfırlama Bağlantısı Gönder' },
  fp_sent_title:    { en: '✓  Link sent',              tr: '✓  Bağlantı gönderildi' },
  // {email} is replaced at runtime via t('fp_sent_body', { email }) — see R13-05.
  fp_sent_body:     {
    en: 'A reset link was sent to {email} (if an account exists). Check your inbox — it may take a minute.',
    tr: '{email} adresine bir sıfırlama bağlantısı gönderildi (hesap mevcutsa). Gelen kutunuzu kontrol edin.',
  },
  fp_spam_hint:     {
    en: "If it doesn't arrive, check your spam folder or try again.",
    tr: 'E-posta gelmezse spam klasörünü kontrol edin veya tekrar deneyin.',
  },
  fp_try_different: { en: 'Try a Different Email',     tr: 'Farklı E-posta ile Tekrar Dene' },
  fp_return_login:  { en: 'Return to login',           tr: 'Girişe geri dön' },
  fp_err_required:  { en: 'Email address is required.', tr: 'E-posta adresi gereklidir.' },
  fp_err_generic:   {
    en: 'Something went wrong. Please try again.',
    tr: 'Bir hata oluştu. Lütfen tekrar deneyin.',
  },

  /* ── Reset Password (R13-03) ─────────────────────────────────────────────── */
  rp_title:         { en: 'Set a new password',        tr: 'Yeni şifre belirle' },
  rp_invalid_title: { en: 'Invalid Link',              tr: 'Geçersiz Bağlantı' },
  rp_invalid_body:  {
    en: 'This password-reset link is invalid or has expired. Please request a new one.',
    tr: 'Bu sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeni bir bağlantı isteyin.',
  },
  rp_req_new_link:  { en: 'Request New Link',          tr: 'Yeni Bağlantı İste' },
  rp_success_title: { en: '✓  Password changed successfully', tr: '✓  Şifre başarıyla değiştirildi' },
  rp_success_body:  {
    en: 'Redirecting you to login in 3 seconds…',
    tr: '3 saniye içinde giriş sayfasına yönlendirileceksiniz…',
  },
  rp_desc:          {
    en: 'Set a new password for your account. It must be at least 8 characters.',
    tr: 'Hesabınız için yeni bir şifre belirleyin. Şifreniz en az 8 karakter olmalıdır.',
  },
  rp_pw1_label:     { en: 'New Password',              tr: 'Yeni Şifre' },
  rp_pw2_label:     { en: 'Confirm New Password',      tr: 'Şifreyi Onayla' },
  rp_saving:        { en: 'Saving…',                   tr: 'Kaydediliyor…' },
  rp_submit:        { en: 'Update Password',           tr: 'Şifreyi Güncelle' },
  rp_err_short:     {
    en: 'Password must be at least 8 characters.',
    tr: 'Şifre en az 8 karakter olmalıdır.',
  },
  rp_err_expired:   {
    en: 'Reset link is invalid or has expired.',
    tr: 'Bağlantı geçersiz veya süresi dolmuş.',
  },

  /* ── History page (R13-04) ───────────────────────────────────────────────── */
  hist_load_error:       {
    en: 'Failed to load history. Please refresh the page.',
    tr: 'Geçmiş yüklenemedi. Lütfen sayfayı yenileyin.',
  },
  hist_title_1:          { en: 'Assessment',           tr: 'Değerlendirme' },
  hist_title_2:          { en: 'History',              tr: 'Geçmişi' },
  hist_desc:             {
    en: 'View all your sustainability assessments and results.',
    tr: 'Tüm sürdürülebilirlik değerlendirmelerinizi görüntüleyin.',
  },
  hist_stat_total:       { en: 'Total',                tr: 'Toplam' },
  hist_stat_completed:   { en: 'Completed',            tr: 'Tamamlanan' },
  hist_stat_in_progress: { en: 'In Progress',          tr: 'Devam Eden' },
  hist_stat_avg:         { en: 'Avg Score',            tr: 'Ort. Skor' },
  hist_filter_completed: { en: 'Completed',            tr: 'Tamamlanan' },
  hist_filter_progress:  { en: 'In Progress',          tr: 'Devam Eden' },
  hist_empty_all:        { en: 'No assessments yet.',  tr: 'Henüz değerlendirme yok.' },
  hist_empty_completed:  {
    en: 'No completed assessments found.',
    tr: 'Tamamlanan değerlendirme bulunamadı.',
  },
  hist_empty_progress:   {
    en: 'No in-progress assessments found.',
    tr: 'Devam eden değerlendirme bulunamadı.',
  },
  hist_new_assessment:   { en: 'Start New Assessment', tr: 'Yeni Değerlendirme Başlat' },
  hist_status_done:      { en: 'Completed',            tr: 'Tamamlandı' },
  hist_status_ongoing:   { en: 'In Progress',          tr: 'Devam Ediyor' },
  hist_started:          { en: 'Started:',             tr: 'Başl:' },
  hist_finished:         { en: 'Finished:',            tr: 'Bitiş:' },
  hist_view_results:     { en: 'View Results',         tr: 'Sonuçlar' },
};

/* ============================================================
   Context + Provider + Hook
   ============================================================ */
interface LangContextType {
  lang: 'en' | 'tr';
  setLang: (l: 'en' | 'tr') => void;
  // Fix R13-05: optional `vars` map enables runtime variable substitution,
  // e.g. t('fp_sent_body', { email: 'user@example.com' }) → replaces {email}.
  t: (key: string, vars?: Record<string, string>) => string;
}

const LangCtx = createContext<LangContextType>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  // Fix FE-H4: always start with 'en' to match the server render — avoids hydration mismatch.
  // After mount, read localStorage and update if the user has a stored preference.
  const [lang, setLangState] = useState<'en' | 'tr'>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('sx_lang') as 'en' | 'tr' | null;
      if (stored === 'en' || stored === 'tr') setLangState(stored);
    } catch {}
  }, []);

  const setLang = (l: 'en' | 'tr') => {
    setLangState(l);
    try { localStorage.setItem('sx_lang', l); } catch {}
  };

  const t = useCallback((key: string, vars?: Record<string, string>): string => {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    let raw = entry[lang] || entry.en || key;
    // Fix L-05: replace {year} at call time so foot_copy is always the current
    // calendar year, not the year the module was first loaded.
    if (raw.includes('{year}')) raw = raw.replace('{year}', String(new Date().getFullYear()));
    // Fix R13-05: replace arbitrary {name} placeholders with caller-supplied vars.
    // e.g. t('fp_sent_body', { email: 'a@b.com' }) → expands {email} in the string.
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        raw = raw.split(`{${k}}`).join(v);
      }
    }
    return raw;
  }, [lang]);

  // Fix H-4: keep <html lang="..."> in sync with the active language so that
  // screen readers, browser translation prompts, and SEO crawlers see the
  // correct language code rather than the hardcoded "en" in layout.tsx.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang);
    }
  }, [lang]);

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang() { return useContext(LangCtx); }
