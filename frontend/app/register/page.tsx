'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    company_name: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.password_confirm) {
      setError(t('error.register.password'));
      return;
    }

    setLoading(true);

    try {
      await register(formData);
      router.push('/dashboard');
    } catch (err: any) {
      const errorMsg = err.response?.data?.username?.[0] || 
                       err.response?.data?.email?.[0] || 
                       err.response?.data?.detail ||
                       t('error.register.failed');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-50 flex items-center justify-center p-4 py-12">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-green-200/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-200/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative max-w-4xl w-full">
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
          <p className="text-gray-600 mt-6 text-base font-medium">{t('auth.register.subtitle')}</p>
        </div>

        {/* Register Form */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border-2 border-green-100 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">{t('auth.register.title')}</h2>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border-2 border-green-200">
              <i className="fas fa-check-circle text-green-600"></i>
              <span className="text-sm text-green-700 font-bold">{t('auth.register.freebadge')}</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-3">
              <i className="fas fa-exclamation-circle text-lg mt-0.5"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Info */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                <i className="fas fa-user-circle text-green-600"></i>
                {t('auth.register.account')}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('auth.register.username')} *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-user text-gray-400 text-sm"></i>
                    </div>
                    <input
                      id="username"
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-green-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition bg-white text-gray-800"
                      placeholder={t('auth.register.placeholder.username')}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('auth.register.email')} *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-envelope text-gray-400 text-sm"></i>
                    </div>
                    <input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-green-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition bg-white text-gray-800"
                      placeholder={t('auth.register.placeholder.email')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                <i className="fas fa-id-card text-emerald-600"></i>
                {t('auth.register.personal')}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('auth.register.firstname')}
                  </label>
                  <input
                    id="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-green-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition bg-white text-gray-800"
                    placeholder={t('auth.register.placeholder.firstname')}
                  />
                </div>

                <div>
                  <label htmlFor="last_name" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('auth.register.lastname')}
                  </label>
                  <input
                    id="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-green-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition bg-white text-gray-800"
                    placeholder={t('auth.register.placeholder.lastname')}
                  />
                </div>
              </div>
            </div>

            {/* Company Info */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                <i className="fas fa-building text-green-600"></i>
                {t('auth.register.company')}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="company_name" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('auth.register.companyname')}
                  </label>
                  <input
                    id="company_name"
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-green-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition bg-white text-gray-800"
                    placeholder={t('auth.register.placeholder.company')}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('auth.register.phone')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-phone text-gray-400 text-sm"></i>
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-green-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition bg-white text-gray-800"
                      placeholder={t('auth.register.placeholder.phone')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                <i className="fas fa-lock text-emerald-600"></i>
                {t('auth.register.security')}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('auth.register.password')} *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-lock text-gray-400 text-sm"></i>
                    </div>
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-green-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition bg-white text-gray-800"
                      placeholder={t('auth.register.placeholder.password')}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password_confirm" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('auth.register.confirmpassword')} *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <i className="fas fa-lock text-gray-400 text-sm"></i>
                    </div>
                    <input
                      id="password_confirm"
                      type="password"
                      required
                      value={formData.password_confirm}
                      onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-green-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition bg-white text-gray-800"
                      placeholder={t('auth.register.placeholder.confirmpassword')}
                    />
                  </div>
                </div>
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
                  {t('auth.register.loading')}
                </span>
              ) : (
                t('auth.register.button')
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-green-100 text-center">
            <p className="text-gray-600 text-sm">
              {t('auth.register.hasaccount')}{' '}
              <Link href="/login" className="text-green-600 font-bold hover:text-green-700 transition-colors">
                {t('auth.register.signin')}
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              <i className="fas fa-arrow-left"></i>
              {t('auth.register.backhome')}
            </Link>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border-2 border-green-100 hover:scale-105 transition-transform shadow-lg">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-chart-line text-green-600 text-xl"></i>
            </div>
            <h4 className="font-bold text-gray-800 mb-2 text-center text-sm">{t('auth.register.benefit1.title')}</h4>
            <p className="text-xs text-gray-600 text-center">{t('auth.register.benefit1.desc')}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border-2 border-green-100 hover:scale-105 transition-transform shadow-lg">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-file-pdf text-emerald-600 text-xl"></i>
            </div>
            <h4 className="font-bold text-gray-800 mb-2 text-center text-sm">{t('auth.register.benefit2.title')}</h4>
            <p className="text-xs text-gray-600 text-center">{t('auth.register.benefit2.desc')}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border-2 border-green-100 hover:scale-105 transition-transform shadow-lg">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-shield-alt text-green-600 text-xl"></i>
            </div>
            <h4 className="font-bold text-gray-800 mb-2 text-center text-sm">{t('auth.register.benefit3.title')}</h4>
            <p className="text-xs text-gray-600 text-center">{t('auth.register.benefit3.desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
