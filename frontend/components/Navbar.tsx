'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
    setMobileMenuOpen(false);
  };

  const handleLanguageChange = (lang: 'tr' | 'en') => {
    setLanguage(lang);
    setLanguageMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-b border-green-100 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <i className="fas fa-leaf text-white text-xl"></i>
            </div>
            <span className="text-2xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Sustindex</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            <Link href="/#features" className="text-gray-700 hover:text-green-600 transition-colors text-sm font-semibold">
              {t('nav.features')}
            </Link>
            <Link href="/#methodology" className="text-gray-700 hover:text-green-600 transition-colors text-sm font-semibold">
              {t('nav.methodology')}
            </Link>
            {user && (
              <>
                <Link href="/dashboard" className="text-gray-700 hover:text-green-600 transition-colors text-sm font-semibold">
                  {t('nav.dashboard')}
                </Link>
                <Link href="/surveys" className="text-gray-700 hover:text-green-600 transition-colors text-sm font-semibold">
                  {t('nav.surveys')}
                </Link>
              </>
            )}
            <Link href="/about" className="text-gray-700 hover:text-green-600 transition-colors text-sm font-semibold">
              {t('nav.about')}
            </Link>
            
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors text-sm font-semibold text-gray-700"
              >
                <span>{language === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}</span>
                <i className={`fas fa-chevron-down text-xs transition-transform ${languageMenuOpen ? 'rotate-180' : ''}`}></i>
              </button>
              
              {languageMenuOpen && (
                <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-xl border border-green-100 py-1 min-w-[120px]">
                  <button 
                    onClick={() => handleLanguageChange('tr')}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-green-50 transition-colors ${language === 'tr' ? 'bg-green-50 text-green-600 font-semibold' : 'text-gray-700'}`}
                  >
                    🇹🇷 Türkçe
                  </button>
                  <button 
                    onClick={() => handleLanguageChange('en')}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-green-50 transition-colors ${language === 'en' ? 'bg-green-50 text-green-600 font-semibold' : 'text-gray-700'}`}
                  >
                    🇬🇧 English
                  </button>
                </div>
              )}
            </div>

            {/* Auth Section */}
            {user ? (
              <div className="flex items-center space-x-3">
                <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-green-600 transition-colors text-sm font-semibold">
                  <i className="fas fa-user"></i>
                  <span>{user.username}</span>
                </Link>
                <button onClick={handleLogout} className="px-4 py-2 text-gray-700 hover:text-green-600 transition-colors text-sm font-semibold">
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link href="/login" className="px-4 py-2 text-gray-700 hover:text-green-600 transition-colors text-sm font-semibold">
                  {t('nav.signin')}
                </Link>
                <Link href="/register" className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-sm font-black hover:scale-105 transition-all shadow-lg shadow-green-600/30">
                  {t('nav.getstarted')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-gray-700 hover:text-green-600">
            {mobileMenuOpen ? <i className="fas fa-times text-xl"></i> : <i className="fas fa-bars text-xl"></i>}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-green-100">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
            <Link href="/#features" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 text-gray-700 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors text-sm font-semibold">
              {t('nav.features')}
            </Link>
            <Link href="/#methodology" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 text-gray-700 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors text-sm font-semibold">
              {t('nav.methodology')}
            </Link>
            {user && (
              <>
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 text-gray-700 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors text-sm font-semibold">
                  {t('nav.dashboard')}
                </Link>
                <Link href="/surveys" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 text-gray-700 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors text-sm font-semibold">
                  {t('nav.surveys')}
                </Link>
              </>
            )}
            <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="block py-2 px-3 text-gray-700 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors text-sm font-semibold">
              {t('nav.about')}
            </Link>

            {/* Language Selector Mobile */}
            <div className="pt-2 border-t border-green-100">
              <button onClick={() => { handleLanguageChange('tr'); setMobileMenuOpen(false); }} className={`w-full py-2 px-3 text-left hover:bg-green-50 rounded-lg transition-colors text-sm font-semibold ${language === 'tr' ? 'bg-green-50 text-green-600' : 'text-gray-700'}`}>
                🇹🇷 Türkçe
              </button>
              <button onClick={() => { handleLanguageChange('en'); setMobileMenuOpen(false); }} className={`w-full py-2 px-3 text-left hover:bg-green-50 rounded-lg transition-colors text-sm font-semibold ${language === 'en' ? 'bg-green-50 text-green-600' : 'text-gray-700'}`}>
                🇬🇧 English
              </button>
            </div>

            {/* Auth Buttons Mobile */}
            <div className="pt-2 border-t border-green-100 space-y-2">
              {user ? (
                <button onClick={handleLogout} className="w-full py-2 px-3 text-gray-700 hover:bg-green-50 rounded-lg transition-colors text-sm font-semibold text-left">
                  {t('nav.logout')}
                </button>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block w-full py-2 px-3 text-center border-2 border-green-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-green-50 transition-colors">
                    {t('nav.signin')}
                  </Link>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="block w-full py-2 px-3 text-center bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-sm font-black hover:scale-105 transition-all">
                    {t('nav.getstarted')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
