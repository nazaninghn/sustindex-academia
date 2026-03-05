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
    <section id="features" className="relative py-12 overflow-hidden bg-gradient-to-b from-white via-green-50 to-white">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/3 w-[400px] h-[400px] bg-green-200/20 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] bg-emerald-200/20 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-4xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-green-200 rounded-full mb-6 shadow-md">
            <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <i className="fas fa-rocket text-white text-xs"></i>
            </div>
            <span className="text-xs text-green-700 font-bold uppercase tracking-wide">{t('features.badge')}</span>
          </div>
          
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 mb-4 leading-tight tracking-tight">
            {t('features.title1')}{' '}
            <span className="bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
              {t('features.title2')}
            </span>
          </h2>
          
          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
            {t('features.description')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {features.map((feature, index) => (
            <div key={index} className="group relative">
              <div className="absolute inset-0 bg-white rounded-xl border border-green-100 group-hover:border-green-300 group-hover:scale-105 transition-all shadow-md"></div>
              
              <div className="relative p-4 h-full">
                <div className="relative inline-block mb-3">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl blur-md opacity-30 group-hover:opacity-50 transition-opacity"></div>
                  <div className="relative w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center group-hover:rotate-12 group-hover:scale-110 transition-all shadow-lg">
                    <i className={`fas ${feature.icon} text-white text-lg`}></i>
                  </div>
                </div>
                
                <h4 className="text-base font-bold text-gray-800 mb-2">
                  {feature.title}
                </h4>
                
                <p className="text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-2xl opacity-20"></div>
          
          <div className="relative bg-gradient-to-br from-green-500 via-emerald-500 to-green-500 rounded-2xl p-6 md:p-10 overflow-hidden shadow-xl">
            <div className="relative max-w-3xl mx-auto text-center">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
                {t('features.cta.title')}
              </h3>
              <p className="text-sm md:text-base text-white/90 mb-6 leading-relaxed">
                {t('features.cta.desc')}
              </p>
              <a
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-green-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all shadow-lg hover:scale-105"
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
