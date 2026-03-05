'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/language';

export default function MethodologySection() {
  const { t } = useLanguage();
  
  const steps = [
    {
      number: '01',
      title: t('methodology.env.title'),
      description: t('methodology.env.desc'),
      icon: 'fa-leaf'
    },
    {
      number: '02',
      title: t('methodology.social.title'),
      description: t('methodology.social.desc'),
      icon: 'fa-users'
    },
    {
      number: '03',
      title: t('methodology.gov.title'),
      description: t('methodology.gov.desc'),
      icon: 'fa-balance-scale'
    }
  ];

  return (
    <section id="methodology" className="relative py-12 overflow-hidden bg-gradient-to-b from-white via-emerald-50 to-white">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-green-200/20 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-emerald-200/20 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-green-200 rounded-full mb-6 shadow-md">
            <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <i className="fas fa-clipboard-check text-white text-xs"></i>
            </div>
            <span className="text-xs text-green-700 font-bold uppercase tracking-wide">{t('methodology.badge')}</span>
          </div>
          
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 mb-4 leading-tight tracking-tight">
            {t('methodology.title1')}{' '}
            <span className="bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
              {t('methodology.title2')}
            </span>
          </h2>
          
          <p className="text-sm md:text-base text-gray-600 max-w-4xl mx-auto leading-relaxed">
            {t('methodology.description')}
          </p>
        </div>

        {/* Steps */}
        <div className="grid lg:grid-cols-3 gap-4 mb-10">
          {steps.map((step, index) => (
            <div key={index} className="group relative">
              <div className="absolute inset-0 bg-white rounded-xl border border-green-100 group-hover:border-green-300 group-hover:scale-105 transition-all shadow-md"></div>
              
              <div className="relative p-4 h-full">
                {/* Number Badge */}
                <div className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-green-500/40 group-hover:rotate-12 transition-transform">
                  <span className="text-base font-bold text-white">{step.number}</span>
                </div>
                
                {/* Icon */}
                <div className="relative inline-block mb-3">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl blur-md opacity-30 group-hover:opacity-40 transition-opacity"></div>
                  <div className="relative w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                    <i className={`fas ${step.icon} text-white text-lg`}></i>
                  </div>
                </div>
                
                {/* Content */}
                <h3 className="text-base font-bold text-gray-800 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-2xl opacity-30 animate-pulse"></div>
          
          <div className="relative bg-gradient-to-br from-green-500 via-emerald-500 to-green-500 rounded-2xl p-6 md:p-10 text-center overflow-hidden shadow-xl">
            <div className="relative">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
                {t('methodology.cta.title')}
              </h3>
              <p className="text-sm md:text-base text-white/90 mb-6 max-w-3xl mx-auto leading-relaxed">
                {t('methodology.cta.desc')}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-green-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all shadow-lg hover:scale-105"
                >
                  {t('methodology.cta.start')}
                  <i className="fas fa-arrow-right"></i>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-transparent border-2 border-white text-white rounded-xl font-bold text-sm hover:bg-white/10 transition-all hover:scale-105"
                >
                  {t('methodology.cta.signin')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
