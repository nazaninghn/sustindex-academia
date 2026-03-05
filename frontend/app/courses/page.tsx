'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { elearningAPI } from '@/lib/api';
import DashboardNavbar from '@/components/DashboardNavbar';

interface Course {
  id: number;
  title: string;
  description: string;
  thumbnail: string;
  total_lessons: number;
  completed_lessons: number;
  progress_percentage: number;
}

export default function CoursesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadCourses();
    }
  }, [user]);

  const loadCourses = async () => {
    try {
      const data = await elearningAPI.getCourses();
      setCourses(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Failed to load courses:', error);
      setCourses([]);
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
          <p className="text-gray-700 font-semibold text-lg">Loading courses...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-50">
      <DashboardNavbar />
      
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-green-200/20 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-200/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <main className="relative pt-20 pb-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-5">
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
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg blur-md opacity-40"></div>
                    <div className="relative w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
                      <i className="fas fa-graduation-cap text-xl text-white"></i>
                    </div>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">E-Learning Courses</h1>
                    <p className="text-gray-600 text-sm font-medium">Enhance your sustainability knowledge</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {courses.length === 0 ? (
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400 rounded-xl blur-xl opacity-10"></div>
              <div className="relative bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-gray-200 p-10 text-center">
                <div className="relative inline-block mb-4">
                  <div className="absolute inset-0 bg-gray-300 rounded-xl blur-lg opacity-30"></div>
                  <div className="relative w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                    <i className="fas fa-book-open text-3xl text-gray-400"></i>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No Courses Available</h3>
                <p className="text-gray-600 text-sm">Check back later for new courses.</p>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course) => (
                <Link key={course.id} href={`/courses/${course.id}`} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl blur-lg opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative bg-white/95 backdrop-blur-xl rounded-xl shadow-md border border-green-100 group-hover:border-green-300 overflow-hidden group-hover:scale-105 transition-all">
                    {course.thumbnail && (
                      <img src={course.thumbnail} alt={course.title} className="w-full h-32 object-cover" />
                    )}
                    <div className="p-4">
                      <h3 className="text-base font-bold text-gray-800 mb-2">{course.title}</h3>
                      <div 
                        className="text-gray-600 text-sm mb-3 line-clamp-3"
                        dangerouslySetInnerHTML={{ __html: course.description }}
                      />
                      
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 font-semibold mb-3">
                        <i className="fas fa-book text-green-600"></i>
                        <span>{course.total_lessons} lessons</span>
                      </div>

                      {course.progress_percentage > 0 && (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-600 font-semibold">Progress</span>
                            <span className="text-green-600 font-bold">{course.progress_percentage}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-green-600 to-emerald-600 transition-all"
                              style={{ width: `${course.progress_percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-green-100">
                        <span className="text-xs text-gray-600 font-semibold">
                          {course.completed_lessons} / {course.total_lessons} completed
                        </span>
                        <i className="fas fa-arrow-right text-green-600 text-xs group-hover:translate-x-1 transition-transform"></i>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
