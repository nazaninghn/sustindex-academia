'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { attemptAPI } from '@/lib/api';
import DashboardNavbar from '@/components/DashboardNavbar';

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
  category_scores?: { id: number; key: string; name: string; score: number; max_score: number; percentage: number }[];
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'in-progress'>('all');

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
          <p className="text-gray-700 font-semibold text-lg">Loading history...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const filteredAttempts = attempts.filter(a => {
    if (filter === 'completed') return a.is_completed;
    if (filter === 'in-progress') return !a.is_completed;
    return true;
  });

  const completedAttempts = attempts.filter(a => a.is_completed);
  const averageScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((sum, a) => sum + a.total_score, 0) / completedAttempts.length)
    : 0;

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
      </div>
      
      <main className="relative pt-20 pb-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-5">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold mb-4 group text-sm"
            >
              <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform text-xs"></i>
              <span>Back to Dashboard</span>
            </Link>
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-purple-100 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg blur-md opacity-40"></div>
                    <div className="relative w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg">
                      <i className="fas fa-history text-xl text-white"></i>
                    </div>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                      Assessment History
                    </h1>
                    <p className="text-gray-600 text-sm font-medium">
                      View all your sustainability assessments
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-4 gap-3 mb-5">
            <StatCard icon="fa-clipboard-list" label="Total" value={attempts.length.toString()} color="purple" />
            <StatCard icon="fa-check-circle" label="Completed" value={completedAttempts.length.toString()} color="green" />
            <StatCard icon="fa-clock" label="In Progress" value={attempts.filter(a => !a.is_completed).length.toString()} color="amber" />
            <StatCard icon="fa-chart-line" label="Avg Score" value={averageScore > 0 ? `${averageScore}%` : '-'} color="blue" />
          </div>

          {/* Filters */}
          <div className="relative group mb-5">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg blur-lg opacity-10"></div>
            <div className="relative bg-white/95 backdrop-blur-xl rounded-lg shadow-md border border-green-100 p-3">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    filter === 'all'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md scale-105'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  All ({attempts.length})
                </button>
                <button
                  onClick={() => setFilter('completed')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    filter === 'completed'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md scale-105'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  Completed ({completedAttempts.length})
                </button>
                <button
                  onClick={() => setFilter('in-progress')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    filter === 'in-progress'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md scale-105'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  In Progress ({attempts.filter(a => !a.is_completed).length})
                </button>
              </div>
            </div>
          </div>

          {/* Attempts List */}
          {filteredAttempts.length === 0 ? (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400 rounded-xl blur-xl opacity-10"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-gray-200 p-10 text-center">
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-gray-300 rounded-xl blur-lg opacity-30"></div>
                  <div className="relative w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                    <i className="fas fa-inbox text-3xl text-gray-400"></i>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No Assessments Found</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {filter === 'all'
                    ? 'Start your first assessment to see it here'
                    : `No ${filter} assessments found`}
                </p>
                <Link
                  href="/surveys"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold text-sm hover:scale-105 transition-all shadow-md"
                >
                  Start New Assessment
                  <i className="fas fa-arrow-right text-xs"></i>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAttempts.map((attempt) => (
                <div key={attempt.id} className="group relative">
                  <div className={`absolute inset-0 bg-gradient-to-br ${attempt.is_completed ? getGradeBg(attempt.overall_grade) : 'from-amber-500 to-orange-500'} rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity`}></div>
                  <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border-2 border-green-100 group-hover:border-green-300 p-6 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold text-gray-800">
                            {attempt.survey_name}
                          </h3>
                          {attempt.is_completed ? (
                            <span className="px-4 py-1 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 text-sm font-bold rounded-full border-2 border-green-200">
                              <i className="fas fa-check-circle mr-1"></i>
                              Completed
                            </span>
                          ) : (
                            <span className="px-4 py-1 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 text-sm font-bold rounded-full border-2 border-amber-200">
                              <i className="fas fa-clock mr-1"></i>
                              In Progress
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-600 font-medium">
                          <span className="flex items-center gap-2">
                            <i className="fas fa-calendar text-green-600"></i>
                            Started: {new Date(attempt.started_at).toLocaleDateString()}
                          </span>
                          {attempt.is_completed && (
                            <span className="flex items-center gap-2">
                              <i className="fas fa-check-circle text-green-600"></i>
                              Completed: {new Date(attempt.completed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {attempt.is_completed ? (
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="relative inline-block">
                              <div className={`absolute inset-0 bg-gradient-to-br ${getGradeBg(attempt.overall_grade)} rounded-xl blur-md opacity-30`}></div>
                              <div className={`relative px-6 py-3 bg-gradient-to-br ${getGradeBg(attempt.overall_grade)} rounded-xl shadow-xl`}>
                                <span className="text-4xl font-bold text-white">{attempt.overall_grade}</span>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600 font-semibold mt-2">
                              {Math.round(attempt.total_score)}%
                            </div>
                          </div>
                          <Link
                            href={`/results/${attempt.id}`}
                            className="group/btn relative px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-xl overflow-hidden"
                          >
                            <span className="relative z-10 flex items-center gap-2">
                              View Results
                              <i className="fas fa-arrow-right group-hover/btn:translate-x-1 transition-transform"></i>
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                          </Link>
                        </div>
                      ) : (
                        <Link
                          href={`/questionnaire/${attempt.id}`}
                          className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-xl"
                        >
                          Continue
                        </Link>
                      )}
                    </div>

                    {attempt.is_completed && (
                      <div className="mt-6 pt-6 border-t-2 border-green-100">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                          {attempt.category_scores && attempt.category_scores.length > 0 ? (
                            attempt.category_scores.map((cat, index) => {
                              const colors = ['green', 'blue', 'purple', 'amber', 'cyan', 'pink'];
                              return (
                                <ScoreItem key={cat.id} label={cat.name} score={cat.percentage} color={colors[index % colors.length]} />
                              );
                            })
                          ) : (
                            <>
                              <ScoreItem label="Environmental" score={attempt.environmental_score} color="green" />
                              <ScoreItem label="Social" score={attempt.social_score} color="blue" />
                              <ScoreItem label="Governance" score={attempt.governance_score} color="purple" />
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: string;
  label: string;
  value: string;
  color: string;
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
        <div className="relative inline-block mb-2">
          <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} rounded-lg blur-md opacity-30 group-hover:opacity-40 transition-opacity`}></div>
          <div className={`relative w-8 h-8 bg-gradient-to-br ${colors.light} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-md`}>
            <i className={`fas ${icon} text-sm ${colors.text}`}></i>
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-800 mb-1">{value}</div>
        <div className="text-xs text-gray-600 font-semibold">{label}</div>
      </div>
    </div>
  );
}

function ScoreItem({ label, score, color }: {
  label: string;
  score: number;
  color: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    green: { bg: 'from-green-500 to-emerald-500', text: 'text-green-600' },
    blue: { bg: 'from-blue-500 to-cyan-500', text: 'text-blue-600' },
    purple: { bg: 'from-purple-500 to-pink-500', text: 'text-purple-600' },
    amber: { bg: 'from-amber-500 to-orange-500', text: 'text-amber-600' },
    cyan: { bg: 'from-cyan-500 to-teal-500', text: 'text-cyan-600' },
    pink: { bg: 'from-pink-500 to-rose-500', text: 'text-pink-600' },
  };

  const colors = colorClasses[color] || colorClasses.green;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-600 font-bold uppercase tracking-wide">{label}</p>
        <span className={`text-sm font-bold ${colors.text}`}>
          {Math.round(score)}%
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
        <div
          className={`h-full bg-gradient-to-r ${colors.bg} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}
