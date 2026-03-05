'use client';

import { useLanguage } from '@/lib/language';

export default function StatsSection() {
  const { t } = useLanguage();

  return (
    <section className="relative py-8 overflow-hidden bg-white">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-0 w-[400px] h-[400px] bg-green-200/20 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-emerald-200/20 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { value: '500+', label: t('stats.companies'), icon: 'fa-building' },
            { value: '12', label: t('stats.questions'), icon: 'fa-clipboard-list' },
            { value: '3', label: t('stats.pillars'), icon: 'fa-layer-group' },
            { value: '98%', label: t('stats.satisfaction'), icon: 'fa-star' }
          ].map((stat, index) => (
            <div key={index} className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl group-hover:scale-105 transition-all shadow-md"></div>
              
              <div className="relative p-4 text-center">
                <div className="relative inline-block mb-3">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl blur-md opacity-30 group-hover:opacity-40 transition-opacity"></div>
                  <div className="relative w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg">
                    <i className={`fas ${stat.icon} text-white text-lg`}></i>
                  </div>
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">{stat.value}</div>
                <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
