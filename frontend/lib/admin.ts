/**
 * Admin console data layer — typed wrappers around /api/v1/admin/*.
 * Every endpoint is staff-only on the server (IsAdminUser); nothing here grants access.
 */
import api, { API_URL } from '@/lib/api';

export type RangeDays = 30 | 90 | 365 | 0;

export interface Delta { value: number | null; previous: number | null; delta_pct?: number | null; delta_pts?: number | null }
export interface SeriesPoint { date: string; signups: number; started: number; completed: number }

export interface Overview {
  range_days: RangeDays;
  generated_at: string;
  stalled_after_days: number;
  kpis: {
    total_users: number;
    signups: Delta; completed: Delta; avg_score: Delta; completion_rate: Delta;
    in_progress: number; stalled: number; open_tasks: number; documents: number; inactive_accounts: number;
  };
  series: SeriesPoint[];
  calendar: { date: string; count: number }[];
  esg: { environmental: number | null; social: number | null; governance: number | null };
  grades: { grade: string; count: number }[];
  score_distribution: { from: number; to: number; count: number }[];
  sectors: { sector: string; label: string; count: number; avg_score: number | null }[];
  memberships: { type: string; count: number }[];
  funnel: { key: 'registered' | 'started' | 'completed' | 'action_plan'; count: number }[];
  surveys: { id: number | null; name: string; completed: number; avg_score: number | null }[];
  recent: {
    type: 'completed' | 'signup'; at: string | null; user_id: number; user: string; company: string;
    survey?: string; score?: number; grade?: string;
  }[];
}

export interface Page<T> { count: number; page: number; pages: number; page_size: number; results: T[] }

export interface AdminUser {
  id: number; username: string; email: string; name: string; company_name: string;
  membership_type: string; is_active: boolean; is_staff: boolean; is_superuser: boolean;
  date_joined: string; last_login: string | null;
  attempts_count: number; completed_count: number; last_score: number | null; last_grade: string | null;
}

export interface AdminAttempt {
  id: number; survey_id: number | null; survey: string; is_completed: boolean;
  score: number | null; grade: string | null;
  environmental: number | null; social: number | null; governance: number | null;
  sector: string; sector_label: string; cycle_name: string;
  started_at: string; completed_at: string | null; answers_count: number;
  user_id?: number; username?: string; user?: string; company_name?: string; last_answer_at?: string | null;
}

export interface AdminUserDetail extends AdminUser {
  phone: string;
  profile: { industry: string; employee_count: number | null; website: string; registration_number: string } | null;
  has_google: boolean; documents: number; lessons_completed: number;
  tasks: Record<string, number>;
  attempts: AdminAttempt[];
  membership_history: { membership_type: string; start_date: string; end_date: string | null; is_active: boolean }[];
}

export interface AssessmentPage extends Page<AdminAttempt> {
  filters: { surveys: { id: number; name: string }[]; sectors: { value: string; label: string }[]; grades: string[] };
}

export interface AdminSurvey {
  id: number; name: string; is_active: boolean; questions: number; categories: number;
  attempts: number; completed: number; completion_rate: number | null; avg_score: number | null;
  last_activity: string | null; updated_at: string;
}
export interface AdminCourse {
  id: number; title: string; tag: string; level: string; is_active: boolean;
  lessons: number; learners: number; lesson_completions: number; avg_progress: number | null; created_at: string;
}
export interface Content {
  surveys: AdminSurvey[]; courses: AdminCourse[];
  totals: { surveys: number; active_surveys: number; questions: number; courses: number; active_courses: number; lessons: number };
}

type Params = Record<string, string | number | undefined>;
const clean = (p: Params) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== ''));

async function download(path: string, params: Params, fallbackName: string) {
  const res = await api.get(path, { params: clean(params), responseType: 'blob' });
  const match = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '');
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url; a.download = match?.[1] || fallbackName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export const adminAPI = {
  overview: async (days: RangeDays) => (await api.get<Overview>('/api/v1/admin/overview/', { params: { days } })).data,
  users: async (p: Params) => (await api.get<Page<AdminUser>>('/api/v1/admin/users/', { params: clean(p) })).data,
  user: async (id: number) => (await api.get<AdminUserDetail>(`/api/v1/admin/users/${id}/`)).data,
  updateUser: async (id: number, body: { membership_type?: string; is_active?: boolean }) =>
    (await api.patch<AdminUserDetail>(`/api/v1/admin/users/${id}/`, body)).data,
  exportUsers: (p: Params) => download('/api/v1/admin/users/export/', p, 'sustindex-users.csv'),
  assessments: async (p: Params) => (await api.get<AssessmentPage>('/api/v1/admin/assessments/', { params: clean(p) })).data,
  exportAssessments: (p: Params) => download('/api/v1/admin/assessments/export/', p, 'sustindex-assessments.csv'),
  content: async () => (await api.get<Content>('/api/v1/admin/content/')).data,
  setSurveyActive: async (id: number, is_active: boolean) =>
    (await api.patch<{ id: number; is_active: boolean }>(`/api/v1/admin/surveys/${id}/`, { is_active })).data,
  setCourseActive: async (id: number, is_active: boolean) =>
    (await api.patch<{ id: number; is_active: boolean }>(`/api/v1/admin/courses/${id}/`, { is_active })).data,
};

/** Django admin (deep editing: questions, choices, lessons) lives on the API host. */
export const djangoAdminUrl = (path = '') => `${API_URL}/en/admin/${path}`;

/** Human-readable message from an axios error, preferring what the server said. */
export function apiError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === 'object') {
    const first = Object.values(data as Record<string, unknown>)[0];
    if (typeof first === 'string') return first;
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  }
  return fallback;
}

/* ── formatting ─────────────────────────────────────────── */
export type Lang = 'en' | 'tr';
const locale = (lang: Lang) => (lang === 'tr' ? 'tr-TR' : 'en-GB');

export const fmtInt = (n: number, lang: Lang) => n.toLocaleString(locale(lang));
export const fmtDate = (iso: string | null | undefined, lang: Lang, opts?: Intl.DateTimeFormatOptions) =>
  iso ? new Date(iso).toLocaleDateString(locale(lang), opts || { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function fmtAgo(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  if (mins < 60) return rtf.format(-mins, 'minute');
  if (mins < 60 * 24) return rtf.format(-Math.round(mins / 60), 'hour');
  if (mins < 60 * 24 * 30) return rtf.format(-Math.round(mins / 1440), 'day');
  return fmtDate(iso, lang);
}

export const initialsOf = (name: string) =>
  name.split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
