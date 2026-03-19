'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { attemptAPI } from '@/lib/api';
import DashboardNavbar from '@/components/DashboardNavbar';
import { useLanguage } from '@/lib/language';

interface Attempt {
  id: number;
  survey_name: string;
  completed_at: string;
  started_at: string;
  is_completed: boolean;
  total_score: number;
  environmental_score: number;
  social_score: number;
  governance_score: number;
  overall_grade: string;
  category_scores?: Record<string, { name: string; score: number; max_score: number; percentage: number }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadAttempts();
    }
  }, [user]);

  const loadAttempts = async () => {
    try {
      const data = await attemptAPI.getMyAttempts();
      if (Array.isArray(data)) {
        setAttempts(data);
      } else if (data && Array.isArray(data.results)) {
        setAttempts(data.results);
      } else {
        setAttempts([]);
      }
    } catch (error) {
      console.error('Failed to load attempts:', error);
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-green-50 to-emerald-50">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
            <div className="relative w-20 h-20 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-700 font-semibold text-lg">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const completedAttempts = attempts.filter(a => a.is_completed);
  const inProgressAttempts = attempts.filter(a => !a.is_completed);
  const averageScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((sum, a) => sum + a.total_score, 0) / completedAttempts.length)
    : 0;
  const latestAttempt = completedAttempts[0];

  const getGradeColor = (grade: string) => {
    if (grade?.startsWith('A')) return 'text-green-600';
    if (grade?.startsWith('B')) return 'text-blue-600';
    if (grade?.startsWith('C')) return 'text-amber-600';
    return 'text-red-600';
  };

  const getGradeBg = (grade: string) => {
    if (grade?.startsWith('A')) return 'from-green-500 to-emerald-500';
    if (grade?.startsWith('B')) return 'from-blue-500 to-cyan-500';
    if (grade?.startsWith('C')) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-50">
      <DashboardNavbar />
      
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-green-200/20 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-200/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-100/30 rounded-full blur-[120px]"></div>
      </div>
      
      <main className="relative pt-20 pb-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Welcome Section */}
          <div className="relative group mb-5">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-green-100 p-5 overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-green-400/10 to-emerald-400/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-400/10 to-green-400/10 rounded-full blur-3xl"></div>
              
              <div className="relative flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold text-gray-800">
                      {t('dashboard.welcome')}, {user.first_name || user.username}!
                    </h1>
                    <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
                      <i className="fas fa-user-circle text-white text-base"></i>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {user.company_name && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                        <i className="fas fa-building text-gray-600 text-xs"></i>
                        <span className="font-bold text-gray-800 text-xs">{user.company_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <i className="fas fa-crown text-green-600 text-xs"></i>
                      <span className="font-bold text-green-700 text-xs">
                        {user.membership_type.charAt(0).toUpperCase() + user.membership_type.slice(1)} Member
                      </span>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:block">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl blur-lg opacity-40 animate-pulse"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                      <i className="fas fa-user text-2xl text-white"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-4 gap-3 mb-5">
            <StatCard
              icon="fa-clipboard-check"
              label={t('dashboard.stats.total')}
              value={completedAttempts.length.toString()}
              color="green"
              trend="+12%"
            />
            <StatCard
              icon="fa-chart-line"
              label={t('dashboard.stats.average')}
              value={averageScore > 0 ? `${averageScore}%` : '-'}
              color="blue"
              trend="+8%"
            />
            <StatCard
              icon="fa-trophy"
              label={t('dashboard.stats.latest')}
              value={latestAttempt?.overall_grade || '-'}
              color="purple"
              trend="New"
            />
            <StatCard
              icon="fa-clock"
              label={t('dashboard.stats.progress')}
              value={inProgressAttempts.length.toString()}
              color="amber"
              trend=""
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-4 mb-5">
            {/* ESG Score Breakdown - Takes 2 columns */}
            <div className="lg:col-span-2">
              {latestAttempt ? (
                <div className="relative group h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-green-100 p-4 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-gray-800 mb-1">{t('dashboard.esg.title')}</h2>
                        <p className="text-gray-600 font-medium text-xs">{t('dashboard.esg.subtitle')}</p>
                      </div>
                      <Link
                        href={`/results/${latestAttempt.id}`}
                        className="group/btn relative inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold text-sm hover:scale-105 transition-all shadow-md"
                      >
                        <span>{t('dashboard.esg.viewreport')}</span>
                        <i className="fas fa-arrow-right group-hover/btn:translate-x-1 transition-transform text-xs"></i>
                      </Link>
                    </div>
                    
                    <div className="space-y-3">
                      {latestAttempt.category_scores && Object.keys(latestAttempt.category_scores).length > 0 ? (
                        Object.entries(latestAttempt.category_scores).map(([key, cat], index) => {
                          const colors = ['green', 'blue', 'purple', 'amber', 'cyan', 'pink'];
                          const icons = ['fa-leaf', 'fa-users', 'fa-balance-scale', 'fa-laptop', 'fa-globe', 'fa-chart-bar'];
                          return (
                            <ScoreBar
                              key={key}
                              title={cat.name}
                              score={cat.percentage}
                              earned={cat.score}
                              maxScore={cat.max_score}
                              icon={icons[index % icons.length]}
                              color={colors[index % colors.length]}
                            />
                          );
                        })
                      ) : (
                        <>
                          <ScoreBar title={t('dashboard.esg.environmental')} score={latestAttempt.environmental_score} icon="fa-leaf" color="green" />
                          <ScoreBar title={t('dashboard.esg.social')} score={latestAttempt.social_score} icon="fa-users" color="blue" />
                          <ScoreBar title={t('dashboard.esg.governance')} score={latestAttempt.governance_score} icon="fa-balance-scale" color="purple" />
                        </>
                      )}
                    </div>

                    {/* Overall Score */}
                    <div className="mt-4 pt-4 border-t border-green-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-600 font-semibold mb-1">{t('dashboard.esg.overall')}</p>
                          <p className="text-2xl font-bold text-gray-800">{Math.round(latestAttempt.total_score)}%</p>
                        </div>
                        <div className="relative">
                          <div className={`absolute inset-0 bg-gradient-to-br ${getGradeBg(latestAttempt.overall_grade)} rounded-lg blur-md opacity-40`}></div>
                          <div className={`relative px-4 py-2 bg-gradient-to-br ${getGradeBg(latestAttempt.overall_grade)} rounded-lg shadow-lg`}>
                            <span className="text-2xl font-bold text-white">{latestAttempt.overall_grade}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative group h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl blur-xl opacity-10"></div>
                  <div className="relative bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-gray-200 p-6 h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 bg-gray-300 rounded-xl blur-lg opacity-30"></div>
                        <div className="relative w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                          <i className="fas fa-chart-pie text-3xl text-gray-400"></i>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-2">{t('dashboard.esg.nodata')}</h3>
                      <p className="text-gray-600 text-sm mb-4">{t('dashboard.esg.nodata.desc')}</p>
                      <Link
                        href="/surveys"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold text-sm hover:scale-105 transition-all shadow-md"
                      >
                        {t('dashboard.esg.start')}
                        <i className="fas fa-arrow-right text-xs"></i>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions - Takes 1 column */}
            <div className="space-y-3">
              {/* Start New Assessment */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl blur-lg opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl shadow-lg p-4 text-white overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
                  <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
                  
                  <div className="relative">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <i className="fas fa-plus text-lg"></i>
                    </div>
                    <h3 className="text-base font-bold mb-2">{t('dashboard.new.title')}</h3>
                    <p className="text-white/90 text-xs mb-3 leading-relaxed">
                      {t('dashboard.new.desc')}
                    </p>
                    <Link
                      href="/surveys"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-green-600 rounded-lg font-bold text-sm hover:bg-gray-50 transition-all shadow-md hover:scale-105"
                    >
                      {t('dashboard.new.button')}
                      <i className="fas fa-arrow-right text-xs"></i>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl blur-lg opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative bg-white/95 backdrop-blur-2xl rounded-xl shadow-md border border-blue-100 p-3">
                  <h3 className="text-sm font-bold text-gray-800 mb-2">{t('dashboard.quick.title')}</h3>
                  <div className="space-y-1.5">
                    <QuickLink href="/history" icon="fa-history" label={t('dashboard.quick.history')} color="blue" />
                    <QuickLink href="/profile" icon="fa-user-circle" label={t('dashboard.quick.profile')} color="green" />
                    <QuickLink href="/surveys" icon="fa-clipboard-list" label={t('dashboard.quick.surveys')} color="purple" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-purple-100 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-1">{t('dashboard.recent.title')}</h2>
                  <p className="text-gray-600 font-medium text-xs">{t('dashboard.recent.subtitle')}</p>
                </div>
                {completedAttempts.length > 3 && (
                  <Link
                    href="/history"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-pink-50 text-purple-600 hover:text-purple-700 font-bold text-xs rounded-lg border border-purple-200 hover:border-purple-300 transition-all hover:scale-105"
                  >
                    {t('dashboard.recent.viewall')}
                    <i className="fas fa-arrow-right text-xs"></i>
                  </Link>
                )}
              </div>
              
              {completedAttempts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-gray-300 rounded-xl blur-lg opacity-30"></div>
                    <div className="relative w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                      <i className="fas fa-inbox text-3xl text-gray-400"></i>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">{t('dashboard.recent.empty')}</h3>
                  <p className="text-gray-600 text-sm mb-4">{t('dashboard.recent.empty.desc')}</p>
                  <Link
                    href="/surveys"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold text-sm hover:scale-105 transition-all shadow-md"
                  >
                    {t('dashboard.recent.getstarted')}
                    <i className="fas fa-rocket text-xs"></i>
                  </Link>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {completedAttempts.slice(0, 6).map((attempt) => (
                    <Link
                      key={attempt.id}
                      href={`/results/${attempt.id}`}
                      className="group/card relative"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${getGradeBg(attempt.overall_grade)} rounded-lg blur-md opacity-0 group-hover/card:opacity-20 transition-opacity`}></div>
                      <div className="relative p-3 border border-green-100 rounded-lg hover:border-green-300 transition-all bg-gradient-to-br from-white to-green-50/30 hover:shadow-md">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2">{attempt.survey_name}</h4>
                            <p className="text-xs text-gray-600 font-medium flex items-center gap-1">
                              <i className="fas fa-calendar text-xs"></i>
                              {new Date(attempt.completed_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="relative ml-2">
                            <div className={`absolute inset-0 bg-gradient-to-br ${getGradeBg(attempt.overall_grade)} rounded-lg blur-sm opacity-30`}></div>
                            <div className={`relative px-2 py-1 bg-gradient-to-br ${getGradeBg(attempt.overall_grade)} rounded-lg shadow-md`}>
                              <span className="text-base font-bold text-white">{attempt.overall_grade}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-green-100">
                          <span className="text-xs text-gray-600 font-semibold">{t('dashboard.recent.score')}</span>
                          <span className="text-sm font-bold text-gray-800">{Math.round(attempt.total_score)}%</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color, trend }: { 
  icon: string; 
  label: string; 
  value: string; 
  color: string;
  trend?: string;
}) {
  const colorClasses = {
    green: { bg: 'from-green-500 to-emerald-500', text: 'text-green-600', light: 'from-green-50 to-emerald-50', border: 'border-green-100 hover:border-green-300' },
    blue: { bg: 'from-blue-500 to-cyan-500', text: 'text-blue-600', light: 'from-blue-50 to-cyan-50', border: 'border-blue-100 hover:border-blue-300' },
    purple: { bg: 'from-purple-500 to-pink-500', text: 'text-purple-600', light: 'from-purple-50 to-pink-50', border: 'border-purple-100 hover:border-purple-300' },
    amber: { bg: 'from-amber-500 to-orange-500', text: 'text-amber-600', light: 'from-amber-50 to-orange-50', border: 'border-amber-100 hover:border-amber-300' },
  };

  const colors = colorClasses[color as keyof typeof colorClasses];

  return (
    <div className="group relative">
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} rounded-lg blur-lg opacity-0 group-hover:opacity-20 transition-opacity`}></div>
      <div className={`relative bg-white/95 backdrop-blur-xl rounded-lg border ${colors.border} p-3 group-hover:scale-105 transition-all shadow-md`}>
        <div className="flex items-start justify-between mb-2">
          <div className="relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} rounded-lg blur-md opacity-30 group-hover:opacity-40 transition-opacity`}></div>
            <div className={`relative w-8 h-8 bg-gradient-to-br ${colors.light} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-md`}>
              <i className={`fas ${icon} text-sm ${colors.text}`}></i>
            </div>
          </div>
          {trend && (
            <span className={`px-2 py-0.5 bg-gradient-to-r ${colors.light} ${colors.text} rounded-full text-xs font-bold`}>
              {trend}
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-gray-800 mb-1">{value}</div>
        <div className="text-xs text-gray-600 font-semibold">{label}</div>
      </div>
    </div>
  );
}

function ScoreBar({ title, score, earned, maxScore, icon, color }: { 
  title: string; 
  score: number; 
  earned?: number;
  maxScore?: number;
  icon: string;
  color: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string; light: string }> = {
    green: { bg: 'from-green-500 to-emerald-500', text: 'text-green-600', light: 'from-green-100 to-emerald-100' },
    blue: { bg: 'from-blue-500 to-cyan-500', text: 'text-blue-600', light: 'from-blue-100 to-cyan-100' },
    purple: { bg: 'from-purple-500 to-pink-500', text: 'text-purple-600', light: 'from-purple-100 to-pink-100' },
    amber: { bg: 'from-amber-500 to-orange-500', text: 'text-amber-600', light: 'from-amber-100 to-orange-100' },
    cyan: { bg: 'from-cyan-500 to-teal-500', text: 'text-cyan-600', light: 'from-cyan-100 to-teal-100' },
    pink: { bg: 'from-pink-500 to-rose-500', text: 'text-pink-600', light: 'from-pink-100 to-rose-100' },
  };

  const colors = colorClasses[color] || colorClasses.green;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} rounded-lg blur-md opacity-30 group-hover:opacity-50 transition-opacity`}></div>
            <div className={`relative w-8 h-8 bg-gradient-to-br ${colors.light} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-md`}>
              <i className={`fas ${icon} text-sm ${colors.text}`}></i>
            </div>
          </div>
          <span className="font-bold text-gray-800 text-sm">{title}</span>
        </div>
        <div className="text-right">
          <span className={`text-xl font-bold ${colors.text}`}>
            {Math.round(score)}%
          </span>
          {earned !== undefined && maxScore !== undefined && (
            <span className="text-xs text-gray-500 block">{earned}/{maxScore}</span>
          )}
        </div>
      </div>
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
        <div
          className={`h-full bg-gradient-to-r ${colors.bg} rounded-full transition-all duration-1000 shadow-md relative overflow-hidden`}
          style={{ width: `${score}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label, color }: {
  href: string;
  icon: string;
  label: string;
  color: string;
}) {
  const colorClasses = {
    green: 'text-green-600 bg-green-50 hover:bg-green-100',
    blue: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
    purple: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
  };

  const colorClass = colorClasses[color as keyof typeof colorClasses];

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 ${colorClass} rounded-lg transition-all hover:scale-105 font-semibold text-sm`}
    >
      <i className={`fas ${icon} text-xs`}></i>
      <span>{label}</span>
      <i className="fas fa-arrow-right text-xs ml-auto"></i>
    </Link>
  );
}
