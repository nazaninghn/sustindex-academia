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
    <section id="methodology" className="relative py-20 overflow-hidden bg-gradient-to-b from-white via-emerald-50 to-white">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-green-200/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 left-0 w-[600px] h-[600px] bg-emerald-200/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white border-2 border-green-200 rounded-full mb-10 shadow-lg">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <i className="fas fa-clipboard-check text-white text-sm"></i>
            </div>
            <span className="text-sm text-green-700 font-black uppercase tracking-widest">{t('methodology.badge')}</span>
          </div>
          
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-6 md:mb-8 leading-tight tracking-tight">
            {t('methodology.title1')}{' '}
            <span className="bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
              {t('methodology.title2')}
            </span>
          </h2>
          
          <p className="text-base md:text-lg text-gray-600 max-w-5xl mx-auto leading-relaxed">
            {t('methodology.description')}
          </p>
        </div>

        {/* Steps */}
        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {steps.map((step, index) => (
            <div key={index} className="group relative">
              <div className="absolute inset-0 bg-white rounded-[3rem] border-2 border-green-100 group-hover:border-green-300 group-hover:scale-105 transition-all shadow-2xl"></div>
              
              <div className="relative p-6 md:p-8 lg:p-10 h-full">
                {/* Number Badge */}
                <div className="absolute -top-4 -right-4 md:-top-6 md:-right-6 w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-2xl shadow-green-500/40 group-hover:rotate-12 transition-transform">
                  <span className="text-lg md:text-2xl font-bold text-white">{step.number}</span>
                </div>
                
                {/* Icon */}
                <div className="relative inline-block mb-6 md:mb-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-lg opacity-30 group-hover:opacity-40 transition-opacity"></div>
                  <div className="relative w-16 h-16 md:w-18 md:h-18 lg:w-20 lg:h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                    <i className={`fas ${step.icon} text-white text-2xl md:text-3xl`}></i>
                  </div>
                </div>
                
                {/* Content */}
                <h3 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-800 mb-4 md:mb-6">{step.title}</h3>
                <p className="text-sm md:text-base text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-[4rem] blur-3xl opacity-30 animate-pulse"></div>
          
          <div className="relative bg-gradient-to-br from-green-500 via-emerald-500 to-green-500 rounded-3xl md:rounded-[3rem] lg:rounded-[4rem] p-8 md:p-16 lg:p-24 text-center overflow-hidden shadow-2xl">
            <div className="relative">
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-6 md:mb-8">
                {t('methodology.cta.title')}
              </h3>
              <p className="text-base md:text-lg text-white/90 mb-8 md:mb-12 max-w-4xl mx-auto leading-relaxed">
                {t('methodology.cta.desc')}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 md:gap-3 px-8 md:px-12 py-3 md:py-5 bg-white text-green-600 rounded-xl md:rounded-2xl font-bold text-base md:text-lg hover:bg-gray-50 transition-all shadow-2xl hover:scale-105"
                >
                  {t('methodology.cta.start')}
                  <i className="fas fa-arrow-right"></i>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 md:gap-3 px-8 md:px-12 py-3 md:py-5 bg-transparent border-2 md:border-3 border-white text-white rounded-xl md:rounded-2xl font-bold text-base md:text-lg hover:bg-white/10 transition-all hover:scale-105"
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
