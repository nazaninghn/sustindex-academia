'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { sanitizeHtml } from '@/lib/utils';
import Logo from '@/components/Logo';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { elearningAPI } from '@/lib/api';
import { Icon } from '@/components/shared';
import { emitDataChange } from '@/lib/events';

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface Attachment {
  id:          number;
  title:       string;
  file:        string;
  uploaded_at: string;
}

interface Lesson {
  id:               number;
  title_display:    string;
  content:          string;
  video_url:        string | null;
  order:            number;
  duration_minutes: number;
  is_completed:     boolean;
  attachments:      Attachment[];
}

interface Course {
  id:                 number;
  title_display:      string;
  description_display:string;
  tag:                string;
  level:              string;
  level_display:      string;
  icon_emoji:         string;
  duration_hours:     number;
  total_lessons:      number;
  completed_lessons:  number;
  progress_percentage:number;
  lessons:            Lesson[];
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLang();

  const courseId = Number(params?.id);

  const [course,         setCourse]         = useState<Course | null>(null);
  const [loadingCourse,  setLoadingCourse]  = useState(true);
  const [error,          setError]          = useState('');
  const [completing,     setCompleting]     = useState<number | null>(null);  // lessonId being completed
  const [completeErr,    setCompleteErr]    = useState('');
  const [expandedLesson, setExpandedLesson] = useState<number | null>(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  /* ── Load course ── */
  const loadCourse = useCallback(async () => {
    if (!courseId || isNaN(courseId)) return;
    setLoadingCourse(true);
    setError('');
    try {
      const data = await elearningAPI.getCourse(courseId);
      // Sort lessons by order
      data.lessons = (data.lessons ?? []).slice().sort(
        (a: Lesson, b: Lesson) => a.order - b.order,
      );
      setCourse(data);
    } catch {
      setError(t('course_load_fail'));
    } finally {
      setLoadingCourse(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    if (!authLoading && user) {
      loadCourse();
    }
  }, [authLoading, user, loadCourse]);

  /* ── Complete lesson ── */
  const handleComplete = async (lessonId: number) => {
    setCompleting(lessonId);
    setCompleteErr('');
    try {
      await elearningAPI.completeLesson(lessonId);
      emitDataChange({ source: 'lesson', lessonId });  // ← live-refresh dashboard
      // Refresh course to get updated progress / is_completed flags
      await loadCourse();
    } catch {
      // Lesson completion is idempotent — user can safely retry.
      setCompleteErr(t('course_complete_err'));
    } finally {
      setCompleting(null);
    }
  };

  /* ── Loading / error states ── */
  if (authLoading || (loadingCourse && !course)) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          {t('t_loading')}
        </p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--danger)' }}>
          {error || t('course_not_found')}
        </p>
        <Link href="/courses" style={{ textDecoration: 'none' }}>
          <button className="btn btn-outline" style={{ fontSize: 12 }}>
            {t('course_back')}
          </button>
        </Link>
      </div>
    );
  }

  const progressPct = Math.round(course.progress_percentage ?? 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ── */}
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper)' }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 32px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}><Logo size={20} /></Link>
          <Link href="/courses" style={{ textDecoration: 'none', fontSize: 11.5, color: 'var(--ink-3)' }}>
            {t('course_back')}
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, padding: '48px 24px' }}>
        <div className="wrap" style={{ maxWidth: 820, margin: '0 auto' }}>

          {/* ── Course header ── */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '32px 36px', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20 }}>
              {/* Emoji icon */}
              <div style={{
                width: 64, height: 64, fontSize: 32,
                background: 'var(--cream)', border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {course.icon_emoji || '📚'}
              </div>

              <div style={{ flex: 1 }}>
                {/* Tag + level badges */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  {course.tag && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: 'var(--olive-deep)',
                      background: 'var(--olive-wash)', padding: '3px 8px',
                    }}>
                      {course.tag}
                    </span>
                  )}
                  {course.level_display && (
                    <span style={{
                      fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: 'var(--ink-3)',
                      border: '1px solid var(--line)', padding: '3px 8px',
                    }}>
                      {course.level_display}
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, color: 'var(--ink-4)',
                    border: '1px solid var(--line)', padding: '3px 8px',
                  }}>
                    {course.duration_hours}h
                  </span>
                </div>

                <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.25 }}>
                  {course.title_display}
                </h1>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65 }}>
                  {course.description_display}
                </p>
              </div>
            </div>

            {/* ── Progress bar ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {t('course_progress')}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                  {course.completed_lessons} / {course.total_lessons}
                  <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 6 }}>
                    {t('course_lessons_word')}
                  </span>
                  <span style={{ color: 'var(--ink-4)', margin: '0 6px' }}>·</span>
                  {progressPct}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--cream)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: progressPct === 100 ? 'var(--olive-deep)' : 'var(--olive)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              {progressPct === 100 && (
                <p style={{ fontSize: 11.5, color: 'var(--olive-deep)', marginTop: 8, fontWeight: 500 }}>
                  ✓ {t('course_complete_msg')}
                </p>
              )}
            </div>
          </div>

          {/* ── Lesson completion error ── */}
          {completeErr && (
            <div style={{
              background: '#FEF2F0', border: '1px solid #F5C6BB',
              padding: '10px 16px', marginBottom: 16,
              fontSize: 12, color: 'var(--danger)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{completeErr}</span>
              <button
                onClick={() => setCompleteErr('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--danger)', lineHeight: 1 }}
                aria-label="Dismiss"
              >×</button>
            </div>
          )}

          {/* ── Lesson list ── */}
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 16 }}>
              {t('course_lessons_head')}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {course.lessons.map((lesson, idx) => {
                const isExpanded = expandedLesson === lesson.id;
                const isBeingCompleted = completing === lesson.id;

                return (
                  <div
                    key={lesson.id}
                    style={{
                      background: 'var(--paper)',
                      border: '1px solid var(--line)',
                      borderLeft: lesson.is_completed
                        ? '3px solid var(--olive-deep)'
                        : '3px solid transparent',
                    }}
                  >
                    {/* Lesson header row */}
                    <div
                      role="button"
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} lesson: ${lesson.title_display}`}
                      tabIndex={0}
                      onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedLesson(isExpanded ? null : lesson.id); } }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 16,
                        padding: '16px 20px', cursor: 'pointer',
                      }}
                    >
                      {/* Number / checkmark */}
                      <div style={{
                        width: 28, height: 28, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: lesson.is_completed ? 14 : 11,
                        fontWeight: 600,
                        color: lesson.is_completed ? 'var(--olive-deep)' : 'var(--ink-4)',
                        background: lesson.is_completed ? 'var(--olive-wash)' : 'var(--cream)',
                        border: `1px solid ${lesson.is_completed ? 'var(--olive)' : 'var(--line)'}`,
                      }}>
                        {lesson.is_completed ? '✓' : String(idx + 1).padStart(2, '0')}
                      </div>

                      {/* Title */}
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontSize: 13, fontWeight: 500,
                          color: lesson.is_completed ? 'var(--ink-3)' : 'var(--ink)',
                          marginBottom: 2,
                        }}>
                          {lesson.title_display}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                          {lesson.duration_minutes} {t('course_mins')}
                          {lesson.attachments.length > 0 && (
                            <span style={{ marginLeft: 8 }}>
                              · {lesson.attachments.length} {t('course_attachment')}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Mark-complete button (only for incomplete lessons) */}
                      {!lesson.is_completed && (
                        <button
                          className="btn btn-outline"
                          disabled={isBeingCompleted}
                          onClick={(e) => { e.stopPropagation(); handleComplete(lesson.id); }}
                          style={{ fontSize: 11, padding: '6px 12px', opacity: isBeingCompleted ? 0.5 : 1 }}
                        >
                          {isBeingCompleted ? t('course_completing') : t('course_mark_done')}
                        </button>
                      )}

                      {/* Expand chevron */}
                      <span style={{
                        fontSize: 10, color: 'var(--ink-4)',
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                        flexShrink: 0,
                      }}>▼</span>
                    </div>

                    {/* Expanded lesson content */}
                    {isExpanded && (
                      <div style={{ padding: '0 20px 20px 64px', borderTop: '1px solid var(--line)' }}>
                        {/* Video */}
                        {lesson.video_url && (
                          <div style={{ marginBottom: 16, paddingTop: 16 }}>
                            <a
                              href={lesson.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, color: 'var(--olive-deep)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              ▶ {t('course_video')}
                            </a>
                          </div>
                        )}

                        {/* Content */}
                        {lesson.content && (
                          <div
                            style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.7, paddingTop: lesson.video_url ? 0 : 16 }}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.content) }}
                          />
                        )}

                        {/* Attachments */}
                        {lesson.attachments.length > 0 && (
                          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 10 }}>
                              {t('course_attachments')}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {lesson.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={att.file}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: 12, color: 'var(--olive-deep)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>↓</span>
                                  {att.title}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Bottom nav ── */}
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/courses" style={{ textDecoration: 'none' }}>
              <button className="btn btn-outline" style={{ fontSize: 12, padding: '10px 16px' }}>
                ← {t('dash_all_courses')}
              </button>
            </Link>
            {progressPct < 100 && (
              <p style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
                {course.total_lessons - course.completed_lessons} {t('course_remaining')}
              </p>
            )}
            {progressPct === 100 && (
              <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary" style={{ fontSize: 12, padding: '10px 16px' }}>
                  {t('course_back_dash')} <Icon.arrow />
                </button>
              </Link>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
