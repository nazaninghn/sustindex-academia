'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { attemptAPI } from '@/lib/api';
import DashboardNavbar from '@/components/DashboardNavbar';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Document {
  id: number;
  title: string;
  file: string;
  uploaded_at: string;
  file_size_display: string;
}

interface Answer {
  id: number;
  question_text: string;
  choice_text?: string;
  choices_display?: string;
  text_answer?: string;
  notes?: string;
  total_score: number;
  documents: Document[];
}

interface CategoryScore {
  name: string;
  score: number;
  max_score: number;
  percentage: number;
}

interface Attempt {
  id: number;
  survey_name: string;
  completed_at: string;
  total_score: number;
  environmental_score: number;
  social_score: number;
  governance_score: number;
  overall_grade: string;
  recommendations: Recommendation[];
  answers: Answer[];
  category_scores: Record<string, CategoryScore>;
}

interface Recommendation {
  category: string;
  priority: string;
  suggestion: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const attemptId = parseInt(params.id as string);
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && attemptId) {
      loadResults();
    }
  }, [user, attemptId]);

  const loadResults = async () => {
    try {
      const data = await attemptAPI.getAttempt(attemptId);
      setAttempt(data);
    } catch (error) {
      console.error('Failed to load results:', error);
      alert(t('error.results.load'));
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-600';
    if (grade.startsWith('B')) return 'text-emerald-600';
    if (grade.startsWith('C')) return 'text-yellow-600';
    return 'text-red-500';
  };

  const getGradeBg = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-green-600';
    if (grade.startsWith('B')) return 'bg-emerald-600';
    if (grade.startsWith('C')) return 'bg-yellow-600';
    return 'bg-red-500';
  };

  const handleExport = async () => {
    if (!contentRef.current || !attempt) return;
    
    setExporting(true);
    try {
      // Create canvas from the content
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      // Download the PDF
      const fileName = `${attempt.survey_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert(t('results.exporterror'));
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-primary">{t('results.loading')}</div>
      </div>
    );
  }

  if (!user || !attempt) {
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
      
      <main className="relative pt-24 pb-12">
        <div ref={contentRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className={`inline-block px-8 py-4 ${getGradeBg(attempt.overall_grade)} text-white rounded-2xl text-6xl font-bold mb-4`}>
              {attempt.overall_grade}
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              {t('results.complete')}
            </h1>
            <p className="text-gray-600 text-lg">
              {attempt.survey_name}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              {t('results.completedon')} {new Date(attempt.completed_at).toLocaleDateString()}
            </p>
          </div>

          {/* Overall Score */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-green-100 p-8 mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('results.overall')}</h2>
            <div className="text-6xl font-bold text-green-600 mb-2">
              {Math.round(attempt.total_score)}%
            </div>
            {attempt.category_scores && Object.keys(attempt.category_scores).length > 0 && (
              <p className="text-gray-500 text-lg mb-1">
                {Object.values(attempt.category_scores).reduce((sum, c) => sum + c.score, 0)} / {Object.values(attempt.category_scores).reduce((sum, c) => sum + c.max_score, 0)} pts
              </p>
            )}
            <p className="text-gray-600">{t('results.outof')}</p>
          </div>

          {/* Dynamic Category Scores */}
          {attempt.category_scores && Object.keys(attempt.category_scores).length > 0 && (
          <div className={`grid gap-6 mb-8 ${Object.keys(attempt.category_scores).length === 1 ? 'md:grid-cols-1' : Object.keys(attempt.category_scores).length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
            {Object.entries(attempt.category_scores).map(([key, cat], index) => {
              const colors = ['green', 'emerald', 'yellow', 'blue', 'purple', 'orange'];
              const icons = ['fa-leaf', 'fa-users', 'fa-balance-scale', 'fa-laptop', 'fa-globe', 'fa-chart-bar'];
              return (
                <ScoreCard
                  key={key}
                  title={cat.name}
                  score={cat.percentage}
                  earned={cat.score}
                  maxScore={cat.max_score}
                  icon={icons[index % icons.length]}
                  color={colors[index % colors.length]}
                />
              );
            })}
          </div>
          )}

          {/* Recommendations */}
          {attempt.recommendations && attempt.recommendations.length > 0 && (
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-green-100 p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                <i className="fas fa-lightbulb text-yellow-500 mr-2"></i>
                {t('results.recommendations')}
              </h2>
              <div className="space-y-4">
                {attempt.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="border-l-4 border-green-600 bg-green-50 p-4 rounded-r-lg"
                  >
                    <div className="flex items-center mb-2">
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full mr-3 border-2 border-green-200">
                        {rec.category}
                      </span>
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                        rec.priority === 'High' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        {rec.priority === 'High' ? t('results.high') : rec.priority === 'Medium' ? t('results.medium') : t('results.low')} {t('results.priority')}
                      </span>
                    </div>
                    <p className="text-gray-700">{rec.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Answers */}
          {attempt.answers && attempt.answers.length > 0 && (
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-green-100 p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                <i className="fas fa-list-check mr-2"></i>
                {t('results.answers')}
              </h2>
              <div className="space-y-6">
                {attempt.answers.map((answer, index) => (
                  <div key={answer.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <span className="text-sm text-gray-500 font-semibold">{t('results.question')} {index + 1}</span>
                        <div 
                          className="text-gray-800 font-medium mt-1"
                          dangerouslySetInnerHTML={{ __html: answer.question_text }}
                        />
                      </div>
                      <div className="ml-4 px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full border-2 border-green-200">
                        {answer.total_score} pts
                      </div>
                    </div>
                    
                    <div className="ml-4 pl-4 border-l-2 border-green-300">
                      {/* Choice-based answer */}
                      {answer.choice_text && (
                      <p className="text-gray-700">
                        <i className="fas fa-check-circle text-green-600 mr-2"></i>
                        {answer.choice_text}
                      </p>
                      )}
                      
                      {/* Multiple choices display (only show if there are actual choices, not text answer) */}
                      {!answer.choice_text && answer.choices_display && 
                       answer.choices_display !== 'No answer provided' && 
                       answer.choices_display !== '-' &&
                       answer.choices_display !== answer.text_answer && 
                       !answer.choices_display.endsWith(`| ${answer.text_answer}`) && (
                      <p className="text-gray-700">
                        <i className="fas fa-check-circle text-green-600 mr-2"></i>
                        {answer.choices_display}
                      </p>
                      )}
                      
                      {/* Text Answer - show separately */}
                      {answer.text_answer && answer.text_answer.trim() && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-gray-600 font-semibold mb-1">
                            <i className="fas fa-pen text-blue-600 mr-1"></i>
                            {t('results.textAnswer') || 'Written Answer'}:
                          </p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {answer.text_answer}
                          </p>
                        </div>
                      )}
                      
                      {/* No answer provided */}
                      {!answer.choice_text && !answer.text_answer && (!answer.choices_display || answer.choices_display === 'No answer provided' || answer.choices_display === '-') && (
                        <p className="text-gray-400 italic">
                          <i className="fas fa-minus-circle text-gray-400 mr-2"></i>
                          {t('results.noAnswer') || 'No answer provided'}
                        </p>
                      )}
                      
                      {/* Uploaded Documents */}
                      {answer.documents && answer.documents.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm text-gray-600 font-semibold">
                            <i className="fas fa-paperclip mr-1"></i>
                            Uploaded Documents:
                          </p>
                          {answer.documents.map((doc) => (
                            <a
                              key={doc.id}
                              href={doc.file}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
                            >
                              <i className="fas fa-file-alt text-blue-600 mr-3"></i>
                              <div className="flex-1">
                                <p className="text-sm text-blue-700 font-medium group-hover:underline">
                                  {doc.title}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {doc.file_size_display} • {new Date(doc.uploaded_at).toLocaleDateString()}
                                </p>
                              </div>
                              <i className="fas fa-external-link-alt text-blue-600 text-sm"></i>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Notes/Comments */}
                      {answer.notes && answer.notes.trim() && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-gray-600 font-semibold mb-1">
                            <i className="fas fa-comment-dots text-amber-600 mr-1"></i>
                            {t('results.notes')}:
                          </p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {answer.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center print:hidden">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-8 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all text-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  {t('results.exporting')}
                </>
              ) : (
                <>
                  <i className="fas fa-download mr-2"></i>
                  {t('results.export')}
                </>
              )}
            </button>
            <Link
              href="/dashboard"
              className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-center shadow-lg"
            >
              {t('results.back')}
            </Link>
            <Link
              href="/surveys"
              className="px-8 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-all text-center shadow-lg"
            >
              {t('nav.surveys')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function ScoreCard({ title, score, earned, maxScore, icon, color }: { title: string; score: number; earned?: number; maxScore?: number; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-600',
    emerald: 'bg-emerald-600',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-600',
    purple: 'bg-purple-600',
    orange: 'bg-orange-500',
  };

  const bgColor = colorClasses[color] || 'bg-green-600';

  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border-2 border-green-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className={`w-10 h-10 ${bgColor}/10 rounded-full flex items-center justify-center`}>
          <i className={`fas ${icon} ${bgColor.replace('bg-', 'text-')} text-lg`}></i>
        </div>
      </div>
      <div className="text-4xl font-bold text-green-600 mb-1">
        {Math.round(score)}%
      </div>
      {earned !== undefined && maxScore !== undefined && (
        <p className="text-sm text-gray-500 mb-3">
          {earned} / {maxScore} pts
        </p>
      )}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${bgColor} transition-all duration-1000`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}
