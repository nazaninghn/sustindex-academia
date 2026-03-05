'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { surveyAPI } from '@/lib/api';
import DashboardNavbar from '@/components/DashboardNavbar';

interface Survey {
  id: number;
  name: string;
  description: string;
  total_questions: number;
  is_active: boolean;
}

export default function SurveysPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadSurveys();
    }
  }, [user]);

  const loadSurveys = async () => {
    try {
      const data = await surveyAPI.getSurveys();
      if (Array.isArray(data)) {
        setSurveys(data);
      } else if (data && Array.isArray(data.results)) {
        setSurveys(data.results);
      } else {
        setSurveys([]);
      }
    } catch (error) {
      console.error('Failed to load surveys:', error);
      setSurveys([]);
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
          <p className="text-gray-700 font-semibold text-lg">Loading surveys...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-50">
      <DashboardNavbar />
      
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-green-200/20 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-200/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <main className="relative pt-20 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold mb-4 group text-sm"
            >
              <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform text-xs"></i>
              <span>Back to Dashboard</span>
            </Link>
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-green-100 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg blur-md opacity-40"></div>
                    <div className="relative w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
                      <i className="fas fa-clipboard-list text-xl text-white"></i>
                    </div>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                      Available Surveys
                    </h1>
                    <p className="text-gray-600 text-sm font-medium">
                      Choose a sustainability assessment to begin
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Surveys Grid */}
          {surveys.length === 0 ? (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400 rounded-xl blur-xl opacity-10"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-gray-200 p-10 text-center">
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-gray-300 rounded-xl blur-lg opacity-30"></div>
                  <div className="relative w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                    <i className="fas fa-clipboard-list text-3xl text-gray-400"></i>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No Surveys Available</h3>
                <p className="text-gray-600 text-sm">Please contact administrator to add surveys.</p>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {surveys.map((survey) => (
                <div key={survey.id} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl blur-lg opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative bg-white/95 backdrop-blur-xl rounded-xl shadow-md border border-green-100 group-hover:border-green-300 p-4 group-hover:scale-105 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg blur-md opacity-30 group-hover:opacity-40 transition-opacity"></div>
                        <div className="relative w-10 h-10 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                          <i className="fas fa-clipboard-check text-green-600 text-base"></i>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 text-xs font-bold rounded-full border border-green-200">
                        Active
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-gray-800 mb-2">
                      {survey.name}
                    </h3>
                    
                    <p className="text-gray-600 text-sm mb-3 line-clamp-3 leading-relaxed">
                      {survey.description}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold mb-4 px-2 py-1.5 bg-gray-50 rounded-lg">
                      <i className="fas fa-question-circle text-green-600"></i>
                      <span>{survey.total_questions} questions</span>
                    </div>

                    <Link
                      href={`/questionnaire/${survey.id}`}
                      className="group/btn relative block w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-center rounded-lg font-bold text-sm hover:scale-105 transition-all shadow-md overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        Start Assessment
                        <i className="fas fa-arrow-right group-hover/btn:translate-x-1 transition-transform text-xs"></i>
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                    </Link>
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
