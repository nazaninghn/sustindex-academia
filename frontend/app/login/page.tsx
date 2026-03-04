'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.username, formData.password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || t('error.login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-50 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-green-200/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-200/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative max-w-md w-full">
        {/* Language Selector */}
        <div className="flex justify-end mb-6">
          <div className="inline-flex items-center gap-2 bg-white rounded-xl border-2 border-green-100 p-1 shadow-lg">
            <button
              onClick={() => setLanguage('tr')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                language === 'tr' 
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🇹🇷 Türkçe
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                language === 'en' 
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🇬🇧 English
            </button>
          </div>
        </div>

        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block group">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
              Sustindex
            </h1>
            <div className="h-1 w-20 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full mx-auto"></div>
          </Link>
          <p className="text-gray-600 mt-6 text-base font-medium">{t('auth.login.welcome')}</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-green-100 p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('auth.login.title')}</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-3">
              <i className="fas fa-exclamation-circle text-lg mt-0.5"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                {t('auth.login.username')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <i className="fas fa-user text-gray-400"></i>
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 border-2 border-green-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition bg-white text-gray-800"
                  placeholder={t('auth.register.placeholder.username')}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                  {t('auth.login.password')}
                </label>
                <Link 
                  href="/forgot-password" 
                  className="text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
                >
                  {t('auth.login.forgotpassword')}
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <i className="fas fa-lock text-gray-400"></i>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 border-2 border-green-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition bg-white text-gray-800"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-xl shadow-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i>
                  {t('auth.login.loading')}
                </span>
              ) : (
                t('auth.login.button')
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-green-100 text-center">
            <p className="text-gray-600 text-sm">
              {t('auth.login.noaccount')}{' '}
              <Link href="/register" className="text-green-600 font-bold hover:text-green-700 transition-colors">
                {t('auth.login.signup')}
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              <i className="fas fa-arrow-left"></i>
              {t('auth.login.backhome')}
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border-2 border-green-100 text-center hover:scale-105 transition-transform shadow-lg">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <i className="fas fa-shield-alt text-green-600 text-lg"></i>
            </div>
            <p className="text-xs text-gray-700 font-semibold">{t('auth.login.secure')}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border-2 border-green-100 text-center hover:scale-105 transition-transform shadow-lg">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <i className="fas fa-bolt text-emerald-600 text-lg"></i>
            </div>
            <p className="text-xs text-gray-700 font-semibold">{t('auth.login.fast')}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border-2 border-green-100 text-center hover:scale-105 transition-transform shadow-lg">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <i className="fas fa-check-circle text-green-600 text-lg"></i>
            </div>
            <p className="text-xs text-gray-700 font-semibold">{t('auth.login.reliable')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
