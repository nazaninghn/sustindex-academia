'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/lib/language';

export default function AboutPage() {
  const { t } = useLanguage();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-50">
      <Navbar />
      
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-green-200/20 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-200/20 rounded-full blur-[150px]"></div>
      </div>
      
      <main className="relative pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border-2 border-green-200 mb-6">
              <i className="fas fa-leaf text-green-600"></i>
              <span className="text-sm font-bold text-green-700">{t('about.title')}</span>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-4">
              Sustindex
            </h1>
            <p className="text-xl text-gray-600">
              {t('about.subtitle')}
            </p>
          </div>

          {/* Academia Company Info */}
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-green-100 p-8 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center">
                <i className="fas fa-building text-white text-xl"></i>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">{t('about.company.title')}</h2>
            </div>
            <p className="text-gray-700 leading-relaxed text-lg mb-6">
              {t('about.company.desc')}
            </p>
            <a
              href="https://www.academiadanismanlik.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-green-600/30"
            >
              <i className="fas fa-external-link-alt"></i>
              {t('about.company.visit')}
            </a>
          </div>

          {/* Contact Info */}
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-green-100 p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center">
                <i className="fas fa-map-marker-alt text-white text-xl"></i>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">{t('about.contact.title')}</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-map-marker-alt text-green-600"></i>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">{t('about.contact.address')}</h3>
                  <p className="text-gray-600">
                    Bilişim Vadisi - İstinye Üniversitesi<br />
                    Ayazağa Mah. Kemerburgaz Cad. Vadi İstanbul Park<br />
                    7A Blok No:7 B İç Kapı No:4<br />
                    Sarıyer / İstanbul
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-phone text-green-600"></i>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">{t('about.contact.phone')}</h3>
                  <p className="text-gray-600">212-613 58 80</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-fax text-green-600"></i>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">{t('about.contact.fax')}</h3>
                  <p className="text-gray-600">212-322 04 11</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mission */}
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-green-100 p-8 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center">
                <i className="fas fa-bullseye text-white text-xl"></i>
              </div>
              <h2 className="text-3xl font-bold text-gray-800">{t('about.mission.title')}</h2>
            </div>
            <p className="text-gray-700 leading-relaxed text-lg">
              {t('about.mission.desc')}
            </p>
          </div>

          {/* Features */}
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-green-100 p-8 mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">{t('about.offer.title')}</h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-chart-line text-green-600 text-xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{t('about.offer.assessment.title')}</h3>
                  <p className="text-gray-600">
                    {t('about.offer.assessment.desc')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-file-pdf text-emerald-600 text-xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{t('about.offer.reports.title')}</h3>
                  <p className="text-gray-600">
                    {t('about.offer.reports.desc')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-shield-alt text-green-600 text-xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{t('about.offer.standards.title')}</h3>
                  <p className="text-gray-600">
                    {t('about.offer.standards.desc')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-lightbulb text-emerald-600 text-xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{t('about.offer.insights.title')}</h3>
                  <p className="text-gray-600">
                    {t('about.offer.insights.desc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Methodology */}
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-green-100 p-8 mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">{t('about.methodology.title')}</h2>
            <div className="space-y-4">
              <div className="border-l-4 border-green-600 pl-4 py-2">
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  <span className="text-green-600">1.</span> {t('about.methodology.env')}
                </h3>
                <p className="text-gray-600">
                  {t('about.methodology.env.desc')}
                </p>
              </div>

              <div className="border-l-4 border-emerald-600 pl-4 py-2">
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  <span className="text-emerald-600">2.</span> {t('about.methodology.social')}
                </h3>
                <p className="text-gray-600">
                  {t('about.methodology.social.desc')}
                </p>
              </div>

              <div className="border-l-4 border-green-600 pl-4 py-2">
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  <span className="text-green-600">3.</span> {t('about.methodology.gov')}
                </h3>
                <p className="text-gray-600">
                  {t('about.methodology.gov.desc')}
                </p>
              </div>

              <div className="border-l-4 border-emerald-600 pl-4 py-2">
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  <span className="text-emerald-600">4.</span> {t('about.methodology.scoring')}
                </h3>
                <p className="text-gray-600">
                  {t('about.methodology.scoring.desc')}
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl shadow-2xl p-8 text-white text-center">
            <div className="mb-4">
              <i className="fas fa-rocket text-5xl opacity-90"></i>
            </div>
            <h2 className="text-3xl font-bold mb-4">{t('about.cta.title')}</h2>
            <p className="text-xl mb-6 opacity-90">
              {t('about.cta.desc')}
            </p>
            <Link
              href="/register"
              className="inline-block px-8 py-4 bg-white text-green-600 rounded-xl font-bold text-lg hover:scale-105 transition-all shadow-xl"
            >
              <i className="fas fa-user-plus mr-2"></i>
              {t('about.cta.button')}
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
