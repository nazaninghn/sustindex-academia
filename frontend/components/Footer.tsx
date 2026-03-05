'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/language';

export default function Footer() {
  const { t } = useLanguage();
  
  return (
    <footer className="relative bg-gradient-to-br from-green-50 to-emerald-50 border-t border-green-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="inline-flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
                <i className="fas fa-leaf text-white text-lg"></i>
              </div>
              <span className="text-xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Sustindex</span>
            </Link>
            <p className="text-gray-700 leading-relaxed mb-4 text-sm">
              {t('footer.description')}
            </p>
            <div className="flex gap-2">
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white border border-green-200 hover:border-green-400 hover:bg-green-50 rounded-lg flex items-center justify-center transition-all hover:scale-110 shadow-md">
                <i className="fab fa-linkedin-in text-green-600 text-base"></i>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-base font-bold text-gray-900 mb-3">{t('footer.platform')}</h4>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.about')}</Link></li>
              <li><Link href="/#features" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.features')}</Link></li>
              <li><Link href="/#methodology" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.methodology')}</Link></li>
              <li><Link href="/surveys" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.assessments')}</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-base font-bold text-gray-900 mb-3">{t('footer.resources')}</h4>
            <ul className="space-y-2">
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.documentation')}</Link></li>
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.api')}</Link></li>
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.support')}</Link></li>
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.blog')}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-base font-bold text-gray-900 mb-3">{t('footer.getstarted')}</h4>
            <ul className="space-y-2">
              <li><Link href="/register" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.signup')}</Link></li>
              <li><Link href="/login" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.signin')}</Link></li>
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.pricing')}</Link></li>
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-sm">{t('footer.contact')}</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-green-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-600 text-sm">
              &copy; 2025 Sustindex. {t('footer.rights')}
            </p>
            <div className="flex gap-4 text-sm">
              <Link href="#" className="text-gray-600 hover:text-green-600 transition-colors">{t('footer.privacy')}</Link>
              <Link href="#" className="text-gray-600 hover:text-green-600 transition-colors">{t('footer.terms')}</Link>
              <Link href="#" className="text-gray-600 hover:text-green-600 transition-colors">{t('footer.cookies')}</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
