'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/language';

export default function NotFound() {
  const { t } = useLanguage();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-50 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-green-200/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-200/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative text-center">
        <div className="mb-8">
          <div className="text-9xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-4">404</div>
          <div className="text-6xl mb-4">🌱</div>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-800 mb-4">{t('notfound.title')}</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-md mx-auto">
          {t('notfound.description')}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg hover:scale-105 transition-all shadow-xl shadow-green-600/30"
          >
            <i className="fas fa-home mr-2"></i>
            {t('notfound.home')}
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-4 bg-white text-gray-800 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all border-2 border-green-200 shadow-lg"
          >
            <i className="fas fa-chart-line mr-2"></i>
            {t('notfound.dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
