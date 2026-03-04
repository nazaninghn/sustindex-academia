'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/language';

export default function Footer() {
  const { t } = useLanguage();
  
  return (
    <footer className="relative bg-gradient-to-br from-green-50 to-emerald-50 border-t border-green-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-4 gap-16 mb-16">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="inline-flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <i className="fas fa-leaf text-white text-2xl"></i>
              </div>
              <span className="text-3xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Sustindex</span>
            </Link>
            <p className="text-gray-700 leading-relaxed mb-8 text-lg">
              {t('footer.description')}
            </p>
            <div className="flex gap-4">
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white border-2 border-green-200 hover:border-green-400 hover:bg-green-50 rounded-xl flex items-center justify-center transition-all hover:scale-110 shadow-lg">
                <i className="fab fa-linkedin-in text-green-600 text-xl"></i>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xl font-black text-gray-900 mb-6">{t('footer.platform')}</h4>
            <ul className="space-y-4">
              <li><Link href="/about" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.about')}</Link></li>
              <li><Link href="/#features" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.features')}</Link></li>
              <li><Link href="/#methodology" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.methodology')}</Link></li>
              <li><Link href="/surveys" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.assessments')}</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xl font-black text-gray-900 mb-6">{t('footer.resources')}</h4>
            <ul className="space-y-4">
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.documentation')}</Link></li>
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.api')}</Link></li>
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.support')}</Link></li>
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.blog')}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xl font-black text-gray-900 mb-6">{t('footer.getstarted')}</h4>
            <ul className="space-y-4">
              <li><Link href="/register" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.signup')}</Link></li>
              <li><Link href="/login" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.signin')}</Link></li>
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.pricing')}</Link></li>
              <li><Link href="#" className="text-gray-700 hover:text-green-600 transition-colors text-lg">{t('footer.contact')}</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-10 border-t border-green-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-gray-600 text-lg">
              &copy; 2025 Sustindex. {t('footer.rights')}
            </p>
            <div className="flex gap-8 text-lg">
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
