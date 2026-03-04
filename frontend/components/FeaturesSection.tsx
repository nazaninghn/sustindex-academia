'use client';

import { useLanguage } from '@/lib/language';

export default function FeaturesSection() {
  const { t } = useLanguage();
  
  const features = [
    {
      icon: 'fa-chart-line',
      title: t('features.analytics.title'),
      description: t('features.analytics.desc')
    },
    {
      icon: 'fa-file-pdf',
      title: t('features.reports.title'),
      description: t('features.reports.desc')
    },
    {
      icon: 'fa-shield-alt',
      title: t('features.standards.title'),
      description: t('features.standards.desc')
    },
    {
      icon: 'fa-lightbulb',
      title: t('features.insights.title'),
      description: t('features.insights.desc')
    },
    {
      icon: 'fa-history',
      title: t('features.tracking.title'),
      description: t('features.tracking.desc')
    },
    {
      icon: 'fa-users',
      title: t('features.collaboration.title'),
      description: t('features.collaboration.desc')
    }
  ];

  return (
    <section id="features" className="relative py-20 overflow-hidden bg-gradient-to-b from-white via-green-50 to-white">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-green-200/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 right-1/3 w-[600px] h-[600px] bg-emerald-200/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-5xl mx-auto mb-20">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white border-2 border-green-200 rounded-full mb-10 shadow-lg">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <i className="fas fa-rocket text-white text-sm"></i>
            </div>
            <span className="text-sm text-green-700 font-black uppercase tracking-widest">{t('features.badge')}</span>
          </div>
          
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-6 md:mb-8 leading-tight tracking-tight">
            {t('features.title1')}{' '}
            <span className="bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
              {t('features.title2')}
            </span>
          </h2>
          
          <p className="text-base md:text-lg text-gray-600 leading-relaxed">
            {t('features.description')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <div key={index} className="group relative">
              <div className="absolute inset-0 bg-white rounded-3xl border-2 border-green-100 group-hover:border-green-300 group-hover:scale-105 transition-all shadow-xl"></div>
              
              <div className="relative p-6 md:p-8 lg:p-12 h-full">
                <div className="relative inline-block mb-6 md:mb-8 lg:mb-10">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
                  <div className="relative w-16 h-16 md:w-18 md:h-18 lg:w-20 lg:h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center group-hover:rotate-12 group-hover:scale-110 transition-all shadow-xl">
                    <i className={`fas ${feature.icon} text-white text-2xl md:text-3xl`}></i>
                  </div>
                </div>
                
                <h4 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4">
                  {feature.title}
                </h4>
                
                <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-[4rem] blur-3xl opacity-20"></div>
          
          <div className="relative bg-gradient-to-br from-green-500 via-emerald-500 to-green-500 rounded-3xl md:rounded-[3rem] lg:rounded-[4rem] p-8 md:p-16 lg:p-24 overflow-hidden shadow-2xl">
            <div className="relative max-w-4xl mx-auto text-center">
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4 md:mb-6">
                {t('features.cta.title')}
              </h3>
              <p className="text-base md:text-lg text-white/90 mb-8 md:mb-12 leading-relaxed">
                {t('features.cta.desc')}
              </p>
              <a
                href="/register"
                className="inline-flex items-center gap-2 md:gap-3 px-8 md:px-12 py-3 md:py-5 bg-white text-green-600 rounded-xl md:rounded-2xl font-bold text-base md:text-lg hover:bg-gray-50 transition-all shadow-2xl hover:scale-105"
              >
                {t('features.cta.button')}
                <i className="fas fa-arrow-right"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
