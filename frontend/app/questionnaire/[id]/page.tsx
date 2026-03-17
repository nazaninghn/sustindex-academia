'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import api, { attemptAPI } from '@/lib/api';
import DashboardNavbar from '@/components/DashboardNavbar';

interface Question {
  id: number;
  text: string;
  category_name: string;
  question_type: 'choice' | 'text' | 'mixed';
  allow_multiple: boolean;
  attachment?: string;
  choices: Choice[];
}

interface Choice {
  id: number;
  text: string;
  score: number;
}

interface Answer {
  question: number;
  choice?: number;
  choices_ids?: number[];
  text_answer?: string;
}

export default function QuestionnairePage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = parseInt(params.id as string);
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, Answer>>(new Map());
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Map<number, File[]>>(new Map());

  // Debug log
  useEffect(() => {
    console.log('Submitting state changed:', submitting);
  }, [submitting]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && surveyId) {
      initQuestionnaire();
    }
  }, [user, surveyId]);

  const initQuestionnaire = async () => {
    try {
      // Create attempt
      const attempt = await attemptAPI.startAttempt(surveyId);
      console.log('Attempt created:', attempt);
      setAttemptId(attempt.id);

      // Load questions
      const response = await api.get(`/api/v1/surveys/${surveyId}/questions/`);
      console.log('Questions loaded:', response.data.length);
      setQuestions(response.data);
      
      // Load existing answers for this attempt
      try {
        const answersResponse = await api.get(`/api/v1/answers/?attempt=${attempt.id}`);
        const existingAnswers = new Map<number, Answer>();
        
        if (answersResponse.data && Array.isArray(answersResponse.data)) {
          answersResponse.data.forEach((answer: any) => {
            const answerObj: Answer = { question: answer.question };
            
            if (answer.choice) {
              answerObj.choice = answer.choice;
            }
            if (answer.choices_ids && answer.choices_ids.length > 0) {
              answerObj.choices_ids = answer.choices_ids;
            }
            if (answer.text_answer) {
              answerObj.text_answer = answer.text_answer;
            }
            
            existingAnswers.set(answer.question, answerObj);
          });
        }
        
        console.log('Existing answers loaded:', existingAnswers.size);
        setAnswers(existingAnswers);
      } catch (error) {
        console.log('No existing answers found');
      }
    } catch (error: any) {
      console.error('Failed to initialize:', error);
      alert(`${t('error.questionnaire.init')}: ${error.response?.data?.detail || error.message}`);
      router.push('/surveys');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: number, choiceId: number, allowMultiple: boolean) => {
    const newAnswers = new Map(answers);
    
    if (allowMultiple) {
      const current = newAnswers.get(questionId);
      const currentChoices = current?.choices_ids || [];
      
      if (currentChoices.includes(choiceId)) {
        // Remove choice
        const filtered = currentChoices.filter(id => id !== choiceId);
        if (filtered.length > 0) {
          newAnswers.set(questionId, { question: questionId, choices_ids: filtered });
        } else {
          newAnswers.delete(questionId);
        }
      } else {
        // Add choice
        newAnswers.set(questionId, {
          question: questionId,
          choices_ids: [...currentChoices, choiceId]
        });
      }
    } else {
      newAnswers.set(questionId, { question: questionId, choice: choiceId });
    }
    
    setAnswers(newAnswers);
  };

  const handleTextAnswer = (questionId: number, text: string) => {
    const newAnswers = new Map(answers);
    const current = newAnswers.get(questionId);
    newAnswers.set(questionId, { ...current, question: questionId, text_answer: text });
    setAnswers(newAnswers);
  };

  const handleFileUpload = (questionId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const newFiles = new Map(uploadedFiles);
    const currentFiles = newFiles.get(questionId) || [];
    const filesArray = Array.from(files);
    
    newFiles.set(questionId, [...currentFiles, ...filesArray]);
    setUploadedFiles(newFiles);
  };

  const removeFile = (questionId: number, fileIndex: number) => {
    const newFiles = new Map(uploadedFiles);
    const currentFiles = newFiles.get(questionId) || [];
    currentFiles.splice(fileIndex, 1);
    
    if (currentFiles.length > 0) {
      newFiles.set(questionId, currentFiles);
    } else {
      newFiles.delete(questionId);
    }
    
    setUploadedFiles(newFiles);
  };

  const saveAnswer = async (questionId: number) => {
    const answer = answers.get(questionId);
    if (!answer || !attemptId) return;

    try {
      // Save answer
      const response = await api.post('/api/v1/answers/', {
        attempt: attemptId,
        ...answer
      });

      // Upload files if any
      const files = uploadedFiles.get(questionId);
      if (files && files.length > 0 && response.data.id) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('answer', response.data.id.toString());
          formData.append('title', file.name);
          formData.append('file', file);

          await api.post('/api/v1/documents/', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
        }
      }
    } catch (error) {
      console.error('Failed to save answer:', error);
      throw error;
    }
  };

  const handleNext = async () => {
    const currentQuestion = questions[currentIndex];
    
    try {
      await saveAnswer(currentQuestion.id);
      
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (error) {
      alert(t('error.questionnaire.save'));
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    console.log('Submit clicked!', { attemptId, currentIndex, questionsLength: questions.length });
    
    if (!attemptId) {
      console.error('No attemptId!');
      alert(t('error.questionnaire.noid'));
      return;
    }
    
    // Check if current question is answered
    const currentQuestion = questions[currentIndex];
    const currentAnswer = answers.get(currentQuestion.id);
    
    console.log('Current answer:', currentAnswer);
    
    if (!currentAnswer) {
      alert(t('error.questionnaire.answer'));
      return;
    }

    // For text questions, ensure text is provided
    if (currentQuestion.question_type === 'text' && !currentAnswer.text_answer?.trim()) {
      alert(t('error.questionnaire.answer'));
      return;
    }
    
    setSubmitting(true);
    try {
      // Save last answer
      console.log('Saving last answer...');
      await saveAnswer(currentQuestion.id);

      // Complete attempt
      console.log('Completing attempt with ID:', attemptId);
      const result = await attemptAPI.completeAttempt(attemptId);
      console.log('Complete result:', result);
      
      console.log('Redirecting to results...');
      alert(t('error.questionnaire.success'));
      router.push(`/results/${attemptId}`);
    } catch (error: any) {
      console.error('Failed to submit:', error);
      console.error('Error details:', error.response?.data);
      alert(`${t('error.questionnaire.submit')}: ${error.response?.data?.error || error.message || t('error.register.failed')}`);
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-primary">{t('questionnaire.loading')}</div>
      </div>
    );
  }

  if (!user || questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const currentAnswer = answers.get(currentQuestion.id);
  const currentFiles = uploadedFiles.get(currentQuestion.id) || [];
  
  console.log('Render state:', { 
    currentIndex, 
    questionsLength: questions.length, 
    currentQuestionId: currentQuestion.id,
    currentAnswer,
    answersSize: answers.size,
    allAnswers: Array.from(answers.entries()),
    attemptId: attemptId
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-50">
      <DashboardNavbar />
      
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-green-200/20 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-200/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <main className="relative pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{t('questionnaire.question')} {currentIndex + 1} {t('questionnaire.of')} {questions.length}</span>
              <span>{Math.round(progress)}% {t('questionnaire.complete')}</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="mb-6">
              <span className="px-4 py-2 bg-green-50 text-green-700 text-sm font-semibold rounded-full border-2 border-green-200">
                {currentQuestion.category_name}
              </span>
            </div>

            <div 
              className="text-xl text-neutral mb-8 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: currentQuestion.text }}
            />

            {/* Question Attachment */}
            {currentQuestion.attachment && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <i className="fas fa-paperclip text-blue-600 mr-2"></i>
                <a 
                  href={currentQuestion.attachment} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Attachment
                </a>
              </div>
            )}

            {/* Choices - show for choice and mixed types */}
            {(currentQuestion.question_type === 'choice' || currentQuestion.question_type === 'mixed') && currentQuestion.choices.length > 0 && (
            <div className="space-y-3 mb-6">
              {currentQuestion.choices.map((choice) => {
                const isSelected = currentQuestion.allow_multiple
                  ? currentAnswer?.choices_ids?.includes(choice.id)
                  : currentAnswer?.choice === choice.id;

                return (
                  <button
                    key={choice.id}
                    onClick={() => handleAnswer(currentQuestion.id, choice.id, currentQuestion.allow_multiple)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-5 h-5 rounded ${
                        currentQuestion.allow_multiple ? 'rounded-md' : 'rounded-full'
                      } border-2 mr-3 flex items-center justify-center ${
                        isSelected ? 'border-green-600 bg-green-600' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <i className="fas fa-check text-white text-xs"></i>
                        )}
                      </div>
                      <span className="text-gray-800">{choice.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            )}

            {/* Text Answer - show for text and mixed types */}
            {(currentQuestion.question_type === 'text' || currentQuestion.question_type === 'mixed') && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-pen mr-2"></i>
                  {t('questionnaire.textAnswer') || 'Your Answer'}
                </label>
                <textarea
                  value={currentAnswer?.text_answer || ''}
                  onChange={(e) => handleTextAnswer(currentQuestion.id, e.target.value)}
                  placeholder={t('questionnaire.textPlaceholder') || 'Type your answer here...'}
                  rows={5}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all resize-y text-gray-800 placeholder-gray-400"
                />
              </div>
            )}

            {currentQuestion.allow_multiple && (
              <p className="text-sm text-gray-500 mb-4">
                <i className="fas fa-info-circle mr-1"></i>
                {t('questionnaire.multiple')}
              </p>
            )}

            {/* File Upload Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <i className="fas fa-upload mr-2"></i>
                {t('questionnaire.upload')}
              </label>
              
              {/* Custom File Upload Button */}
              <div className="relative">
                <input
                  type="file"
                  multiple
                  id={`file-upload-${currentQuestion.id}`}
                  onChange={(e) => handleFileUpload(currentQuestion.id, e.target.files)}
                  className="hidden"
                />
                <label
                  htmlFor={`file-upload-${currentQuestion.id}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 cursor-pointer transition-all"
                >
                  <i className="fas fa-folder-open"></i>
                  {t('questionnaire.choose')}
                </label>
                <span className="ml-4 text-sm text-gray-500">
                  {currentFiles.length > 0 
                    ? `${currentFiles.length} ${currentFiles.length === 1 ? t('questionnaire.file') : t('questionnaire.files')} ${t('questionnaire.selected')}`
                    : t('questionnaire.nofile')
                  }
                </span>
              </div>

              {/* Uploaded Files List */}
              {currentFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {currentFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <i className="fas fa-file text-green-600 mr-3"></i>
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(currentQuestion.id, index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← {t('questionnaire.previous')}
            </button>

            {currentIndex === questions.length - 1 ? (
              <div>
                <p className="text-xs text-gray-600 mb-2">Debug: submitting={submitting.toString()}, disabled={submitting.toString()}</p>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('Button clicked! submitting:', submitting);
                    if (submitting) {
                      console.log('Button is disabled because submitting is true');
                      return;
                    }
                    handleSubmit();
                  }}
                  disabled={submitting}
                  type="button"
                  className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      {t('questionnaire.submitting')}
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check mr-2"></i>
                      {t('questionnaire.submit')}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={handleNext}
                disabled={!currentAnswer || (currentQuestion.question_type === 'text' && !currentAnswer?.text_answer?.trim())}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('questionnaire.next')} →
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
