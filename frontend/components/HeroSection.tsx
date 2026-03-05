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
    <section className="relative py-16 overflow-hidden bg-gradient-to-br from-white via-green-50 to-emerald-50">
      {/* Organic Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-200/30 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-200/30 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 z-10">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Left Content */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-xl border border-green-200 rounded-full shadow-md">
              <div className="relative">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
              </div>
              <span className="text-xs text-green-700 font-bold uppercase tracking-wide">{t('hero.badge')}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
              <span className="block text-gray-800 mb-2">{t('hero.title1')}</span>
              <span className="block bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                {t('hero.title2')}
              </span>
            </h1>

            <p className="text-sm md:text-base text-gray-600 leading-relaxed max-w-xl">
              {t('hero.description')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/register"
                className="group relative inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-sm overflow-hidden transition-all hover:scale-105 shadow-lg shadow-green-600/30"
              >
                <span className="relative z-10">{t('hero.getstarted')}</span>
                <i className="fas fa-arrow-right relative z-10 group-hover:translate-x-1 transition-transform text-xs"></i>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </Link>
              
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-green-200 text-gray-900 rounded-xl font-bold text-sm hover:border-green-400 hover:bg-green-50 transition-all hover:scale-105 shadow-md"
              >
                {t('hero.signin')}
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6">
              {[
                { value: '500+', label: t('hero.stats.companies'), icon: 'fa-building' },
                { value: '98%', label: t('hero.stats.accuracy'), icon: 'fa-chart-line' },
                { value: '12', label: t('hero.stats.criteria'), icon: 'fa-award' }
              ].map((stat, index) => (
                <div key={index} className="group text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl mb-2 group-hover:scale-110 transition-transform shadow-md">
                    <i className={`fas ${stat.icon} text-green-600 text-sm`}></i>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-gray-800 mb-1">{stat.value}</div>
                  <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Content - Nature-Inspired Dashboard */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-400 rounded-2xl blur-2xl opacity-20 animate-pulse"></div>
            
            <div className="relative bg-white/90 backdrop-blur-2xl rounded-2xl p-6 shadow-xl border border-green-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-base md:text-lg font-bold text-gray-800 mb-1">ESG Score</h3>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Live Performance</p>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg blur-md opacity-40 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative px-3 py-1.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg shadow-lg">
                    <span className="text-xl md:text-2xl font-bold text-white">A-</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
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

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl group-hover:scale-105 transition-transform"></div>
                  <div className="relative p-3 text-center">
                    <div className="text-xl md:text-2xl font-bold text-gray-800 mb-1">255</div>
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Points</div>
                  </div>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl group-hover:scale-105 transition-transform"></div>
                  <div className="relative p-3 text-center">
                    <div className="text-xl md:text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-1">Top 15%</div>
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Industry Rank</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 -right-4 w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-xl shadow-green-500/50 hover:scale-110 transition-transform">
              <i className="fas fa-check text-2xl text-white"></i>
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
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg blur-sm opacity-40 group-hover:opacity-60 transition-opacity"></div>
            <div className="relative w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-md">
              <i className={`fas ${icon} text-white text-xs`}></i>
            </div>
          </div>
          <span className="text-sm font-bold text-gray-800">{label}</span>
        </div>
        <span className="text-lg font-bold text-gray-800">{score}</span>
      </div>
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
        <div
          style={{ 
            width: mounted ? `${score}%` : '0%',
            transition: 'width 2s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full relative overflow-hidden shadow-md"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
        </div>
      </div>
    </div>
  );
}
