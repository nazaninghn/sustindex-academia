'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/language';

export default function HeroSection() {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-white via-green-50 to-emerald-50">
      {/* Organic Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-green-200/30 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-200/30 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-100/40 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 z-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          {/* Left Content */}
          <div className="space-y-10">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-full shadow-lg shadow-green-500/10">
              <div className="relative">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
              </div>
              <span className="text-sm text-green-700 font-black uppercase tracking-wider">{t('hero.badge')}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              <span className="block text-gray-800 mb-3">{t('hero.title1')}</span>
              <span className="block bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                {t('hero.title2')}
              </span>
            </h1>

            <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-xl">
              {t('hero.description')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 md:gap-5 pt-4 md:pt-6">
              <Link
                href="/register"
                className="group relative inline-flex items-center justify-center gap-2 md:gap-3 px-8 md:px-12 py-4 md:py-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-bold text-base md:text-lg overflow-hidden transition-all hover:scale-105 shadow-2xl shadow-green-600/30 hover:shadow-green-600/50"
              >
                <span className="relative z-10">{t('hero.getstarted')}</span>
                <i className="fas fa-arrow-right relative z-10 group-hover:translate-x-2 transition-transform"></i>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </Link>
              
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 md:gap-3 px-8 md:px-12 py-4 md:py-6 bg-white border-2 border-green-200 text-gray-900 rounded-2xl font-bold text-base md:text-lg hover:border-green-400 hover:bg-green-50 transition-all hover:scale-105 shadow-xl"
              >
                {t('hero.signin')}
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 md:gap-8 lg:gap-12 pt-8 md:pt-12">
              {[
                { value: '500+', label: t('hero.stats.companies'), icon: 'fa-building' },
                { value: '98%', label: t('hero.stats.accuracy'), icon: 'fa-chart-line' },
                { value: '12', label: t('hero.stats.criteria'), icon: 'fa-award' }
              ].map((stat, index) => (
                <div key={index} className="group text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl mb-2 md:mb-3 group-hover:scale-110 transition-transform shadow-lg">
                    <i className={`fas ${stat.icon} text-green-600 text-base md:text-xl`}></i>
                  </div>
                  <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-1">{stat.value}</div>
                  <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Content - Nature-Inspired Dashboard */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-400 rounded-[3rem] blur-3xl opacity-20 animate-pulse"></div>
            
            <div className="relative bg-white/90 backdrop-blur-2xl rounded-[3rem] p-12 shadow-2xl border-2 border-green-100">
              <div className="flex justify-between items-start mb-6 md:mb-10">
                <div>
                  <h3 className="text-lg md:text-2xl font-bold text-gray-800 mb-1">ESG Score</h3>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Live Performance</p>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative px-4 md:px-6 py-2 md:py-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-xl">
                    <span className="text-2xl md:text-4xl font-bold text-white">A-</span>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <MetricBar 
                  label="Environmental"
                  score={85}
                  icon="fa-leaf"
                  mounted={mounted}
                />
                <MetricBar 
                  label="Social"
                  score={78}
                  icon="fa-users"
                  mounted={mounted}
                />
                <MetricBar 
                  label="Governance"
                  score={92}
                  icon="fa-balance-scale"
                  mounted={mounted}
                />
              </div>

              <div className="mt-8 md:mt-12 grid grid-cols-2 gap-4 md:gap-6">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl group-hover:scale-105 transition-transform"></div>
                  <div className="relative p-4 md:p-6 text-center">
                    <div className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">255</div>
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Points</div>
                  </div>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl group-hover:scale-105 transition-transform"></div>
                  <div className="relative p-4 md:p-6 text-center">
                    <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-1">Top 15%</div>
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Industry Rank</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-green-500/50 hover:scale-110 transition-transform">
              <i className="fas fa-check text-5xl text-white"></i>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricBar({ label, score, icon, mounted }: { 
  label: string; 
  score: number; 
  icon: string;
  mounted: boolean;
}) {
  return (
    <div className="group">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg blur-md opacity-40 group-hover:opacity-60 transition-opacity"></div>
            <div className="relative w-11 h-11 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
              <i className={`fas ${icon} text-white text-base`}></i>
            </div>
          </div>
          <span className="text-base font-bold text-gray-800">{label}</span>
        </div>
        <span className="text-2xl font-bold text-gray-800">{score}</span>
      </div>
      <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
        <div
          style={{ 
            width: mounted ? `${score}%` : '0%',
            transition: 'width 2s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full relative overflow-hidden shadow-lg"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
        </div>
      </div>
    </div>
  );
}
