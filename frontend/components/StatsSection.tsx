'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/language';

export default function StatsSection() {
  const [mounted, setMounted] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="relative py-20 overflow-hidden bg-white">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-green-200/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-0 w-[600px] h-[600px] bg-emerald-200/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-8 mb-20">
          {[
            { value: '500+', label: t('stats.companies'), icon: 'fa-building' },
            { value: '12', label: t('stats.questions'), icon: 'fa-clipboard-list' },
            { value: '3', label: t('stats.pillars'), icon: 'fa-layer-group' },
            { value: '98%', label: t('stats.satisfaction'), icon: 'fa-star' }
          ].map((stat, index) => (
            <div key={index} className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl group-hover:scale-105 transition-all shadow-xl"></div>
              
              <div className="relative p-8 text-center">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-lg opacity-30 group-hover:opacity-40 transition-opacity"></div>
                  <div className="relative w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-xl">
                    <i className={`fas ${stat.icon} text-white text-2xl`}></i>
                  </div>
                </div>
                <div className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-3">{stat.value}</div>
                <div className="text-xs md:text-sm text-gray-600 font-medium uppercase tracking-wide">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Performance Card */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-400 rounded-[4rem] blur-3xl opacity-10"></div>
          
          <div className="relative bg-white rounded-[4rem] p-20 border-2 border-green-100 shadow-2xl">
            <div className="text-center mb-12 md:mb-16">
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-3 md:mb-4">
                ESG <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Performance</span>
              </h3>
              <p className="text-sm md:text-base text-gray-600 font-medium uppercase tracking-wide">Real-time Sustainability Metrics</p>
            </div>
            
            <div className="space-y-12 max-w-6xl mx-auto">
              <DistributionBar 
                label="Environmental" 
                percentage={35} 
                score={85}
                icon="fa-leaf"
                mounted={mounted} 
              />
              <DistributionBar 
                label="Social" 
                percentage={30} 
                score={78}
                icon="fa-users"
                mounted={mounted} 
              />
              <DistributionBar 
                label="Governance" 
                percentage={35} 
                score={92}
                icon="fa-balance-scale"
                mounted={mounted} 
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DistributionBar({ label, percentage, score, icon, mounted }: {
  label: string;
  percentage: number;
  score: number;
  icon: string;
  mounted: boolean;
}) {
  return (
    <div className="group relative">
      <div className="absolute inset-0 bg-green-50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="relative p-6 md:p-8 lg:p-10 rounded-3xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-lg opacity-30 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                <i className={`fas ${icon} text-white text-lg md:text-xl`}></i>
              </div>
            </div>
            <div>
              <span className="text-lg md:text-xl lg:text-2xl font-bold text-gray-800 block mb-1">{label}</span>
              <span className="text-xs md:text-sm text-gray-600 font-medium uppercase tracking-wide">{percentage}% weight</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{score}</div>
            <div className="text-xs md:text-sm text-gray-600 font-medium">/ 100</div>
          </div>
        </div>
        
        <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
          <div
            style={{ 
              width: mounted ? `${score}%` : '0%',
              transition: 'width 2.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full relative overflow-hidden shadow-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
