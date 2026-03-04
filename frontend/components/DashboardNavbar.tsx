'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { useRouter, usePathname } from 'next/navigation';

export default function DashboardNavbar() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
    // Force redirect to homepage
    window.location.href = '/';
  };

  const handleLanguageChange = (lang: 'tr' | 'en') => {
    setLanguage(lang);
    setLanguageMenuOpen(false);
  };

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: 'fa-chart-line' },
    { href: '/surveys', label: t('nav.surveys'), icon: 'fa-clipboard-list' },
    { href: '/courses', label: 'Courses', icon: 'fa-graduation-cap' },
    { href: '/history', label: t('nav.history'), icon: 'fa-history' },
    { href: '/profile', label: t('nav.profile'), icon: 'fa-user-circle' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-green-100 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <i className="fas fa-leaf text-white text-lg"></i>
            </div>
            <span className="text-2xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Sustindex
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  isActive(item.href)
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                }`}
              >
                <i className={`fas ${item.icon}`}></i>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="hidden lg:flex items-center space-x-3">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors text-sm font-semibold text-gray-700"
              >
                <span>{language === 'tr' ? '🇹🇷' : '🇬🇧'}</span>
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

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl hover:border-green-300 transition-all"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                  <i className="fas fa-user text-white text-sm"></i>
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-gray-800">{user?.username}</div>
                  <div className="text-xs text-gray-600">{user?.membership_type || 'Free'}</div>
                </div>
                <i className={`fas fa-chevron-down text-xs text-gray-600 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}></i>
              </button>

              {profileMenuOpen && (
                <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-xl border border-green-100 py-2 min-w-[200px]">
                  <Link
                    href="/profile"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-green-50 transition-colors"
                  >
                    <i className="fas fa-user-circle text-green-600"></i>
                    <span>{t('nav.profile')}</span>
                  </Link>
                  <div className="border-t border-green-100 my-2"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <i className="fas fa-sign-out-alt"></i>
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="lg:hidden p-2 text-gray-700 hover:text-green-600"
          >
            {mobileMenuOpen ? <i className="fas fa-times text-xl"></i> : <i className="fas fa-bars text-xl"></i>}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-green-100">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 py-3 px-4 rounded-xl transition-all ${
                  isActive(item.href)
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-green-50'
                }`}
              >
                <i className={`fas ${item.icon}`}></i>
                <span className="font-semibold">{item.label}</span>
              </Link>
            ))}

            {/* Language Selector Mobile */}
            <div className="pt-2 border-t border-green-100">
              <button 
                onClick={() => { handleLanguageChange('tr'); setMobileMenuOpen(false); }} 
                className={`w-full py-3 px-4 text-left hover:bg-green-50 rounded-xl transition-colors text-sm font-semibold ${language === 'tr' ? 'bg-green-50 text-green-600' : 'text-gray-700'}`}
              >
                🇹🇷 Türkçe
              </button>
              <button 
                onClick={() => { handleLanguageChange('en'); setMobileMenuOpen(false); }} 
                className={`w-full py-3 px-4 text-left hover:bg-green-50 rounded-xl transition-colors text-sm font-semibold ${language === 'en' ? 'bg-green-50 text-green-600' : 'text-gray-700'}`}
              >
                🇬🇧 English
              </button>
            </div>

            {/* Profile Section Mobile */}
            <div className="pt-2 border-t border-green-100">
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-xl mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                  <i className="fas fa-user text-white"></i>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-800">{user?.username}</div>
                  <div className="text-xs text-gray-600">{user?.membership_type || 'Free'} Member</div>
                </div>
              </div>
              <button 
                onClick={handleLogout} 
                className="w-full py-3 px-4 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-semibold text-left"
              >
                <i className="fas fa-sign-out-alt mr-2"></i>
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
