import axios from 'axios';
import { getToken, setToken, clearTokens } from '@/lib/token-storage';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Shared axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach token + lang ──────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Fix: use token-storage helper — reads from both localStorage & sessionStorage
    const token = getToken('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Fix BUG-15: wrap in try/catch — localStorage throws in Safari ITP / incognito / quota exceeded.
    let lang = 'en';
    try { lang = (typeof window !== 'undefined' && localStorage.getItem('sx_lang')) || 'en'; } catch { /* ignore */ }
    config.headers['Accept-Language'] = lang;
    // Fix M-2: only append ?lang= on safe/read methods (GET, HEAD, OPTIONS).
    // Appending it to POST/PUT/PATCH/DELETE mutations is redundant (Accept-Language
    // header already carries the preference) and risks confusing backend URL routing.
    const method = (config.method || 'get').toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      config.params = { ...(config.params || {}), lang };
    }
  }
  return config;
});

// ── Response interceptor: silent JWT refresh on 401 ───────
let isRefreshing  = false;
// Fix CRITICAL: reject(unknown) instead of any; null-guard before resolve() so a
// null token doesn't propagate as a Bearer header through the non-null assertion.
let failedQueue: { resolve: (t: string) => void; reject: (e: unknown) => void }[] = [];

const flushQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => {
    if (error)         p.reject(error);
    else if (token !== null) p.resolve(token);
    else p.reject(new Error('Token refresh produced a null access token'));
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig = error.config;
    if (error.response?.status !== 401 || orig._retry) {
      return Promise.reject(error);
    }

    const refresh = getToken('refresh_token');
    if (!refresh) {
      // Fix CRIT-02: flush the queue before redirecting so any requests that
      // stacked up in failedQueue while isRefreshing=true are rejected cleanly
      // rather than being left as unresolved promises (memory leak + hung UX).
      flushQueue(error, null);
      if (typeof window !== 'undefined') {
        clearTokens();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        orig.headers.Authorization = `Bearer ${token}`;
        return api(orig);
      });
    }

    orig._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${API_URL}/api/v1/auth/token/refresh/`, { refresh });
      // setToken respects the storage where the refresh token currently lives
      setToken('access_token', data.access);
      // Fix R6-02: ROTATE_REFRESH_TOKENS=True means the old refresh token is
      // blacklisted server-side after each refresh cycle.  Without storing the
      // new refresh token the next 401-refresh will fail → forced logout.
      if (data.refresh) setToken('refresh_token', data.refresh);
      api.defaults.headers.common.Authorization = `Bearer ${data.access}`;
      flushQueue(null, data.access);
      orig.headers.Authorization = `Bearer ${data.access}`;
      return api(orig);
    } catch (err) {
      flushQueue(err, null);
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

/* ════════════════════════════════════════════════════════
   Attempt API
   ════════════════════════════════════════════════════════ */
export const attemptAPI = {
  getMyAttempts: async () => {
    const { data } = await api.get('/api/v1/attempts/my_attempts/');
    return data;
  },

  // Fix HIGH-06: accept an optional AbortSignal so callers (results page) can
  // cancel the request when the component unmounts, preventing state updates
  // on an already-unmounted component.
  getAttempt: async (id: number, signal?: AbortSignal) => {
    const { data } = await api.get(`/api/v1/attempts/${id}/`, signal ? { signal } : {});
    return data;
  },

  /**
   * Start a new attempt for the given survey.
   * @param surveyId   - The survey to attempt.
   * @param sector     - Optional industry sector code (e.g. 'tech', 'agri').
   *                     When provided the backend stores it on the attempt so
   *                     sector-specific questions are included in the questionnaire.
   *                     Omit or pass '' for a universal (no-sector) attempt.
   */
  startAttempt: async (surveyId: number, sector?: string) => {
    const payload: Record<string, number | string> = { survey: surveyId };
    if (sector) payload.selected_sector = sector;
    const { data } = await api.post('/api/v1/attempts/', payload);
    return data;
  },

  submitAnswer: async (
    attemptId:   number,
    questionId:  number,
    choiceId:    number | null,
    choiceIds?:  number[],
    notes?:      string,
    textAnswer?: string,
  ) => {
    const payload: Record<string, number | number[] | string | null | undefined> = {
      attempt: attemptId,
      question: questionId,
    };
    if (choiceIds && choiceIds.length > 0) payload.choices_ids = choiceIds;
    else if (choiceId !== null && choiceId !== undefined) payload.choice = choiceId;
    // Fix M-29: always include notes/text_answer even when empty so the backend
    // clears the field if the user had previously typed something and then erased it.
    // The old `if (notes)` guard skipped the empty string, leaving stale data on the server.
    payload.notes       = notes       ?? '';
    payload.text_answer = textAnswer  ?? '';
    const { data } = await api.post('/api/v1/answers/', payload);
    return data;  // includes { id, ... }
  },

  completeAttempt: async (id: number) => {
    const { data } = await api.post(`/api/v1/attempts/${id}/complete/`);
    return data;
  },

  /** Upload a supporting document for a saved answer.
   *
   * Fix R5-C-02: migrated from native `fetch` to the shared `api` axios instance
   * so the 401-refresh interceptor fires automatically when the access token
   * expires mid-upload, instead of silently failing with a 401.
   * Fix R7-10: do NOT set Content-Type manually — when the body is a FormData
   * instance, axios automatically sets Content-Type: multipart/form-data WITH
   * the correct boundary parameter.  Manually setting the header removes the
   * auto-generated boundary, causing the server to return HTTP 400.
   */
  uploadDocument: async (answerId: number, file: File, title?: string): Promise<{
    id: number;
    title: string;
    description: string;
    file: string;
    uploaded_at: string;
    file_size: number;
    file_size_display: string;
  }> => {
    const form = new FormData();
    form.append('answer', String(answerId));
    form.append('file',   file);
    form.append('title',  title || file.name);

    // No explicit Content-Type header — axios injects multipart/form-data + boundary automatically.
    const { data } = await api.post('/api/v1/documents/', form);
    return data;
  },
};

/**
 * Fix R5-H-03: return the authenticated download URL for a document.
 * Use this instead of `doc.file` directly so the request goes through
 * the Django auth check rather than hitting the public /media/ path.
 */
export function documentDownloadUrl(documentId: number): string {
  return `${API_URL}/api/v1/documents/${documentId}/download/`;
}

/* ════════════════════════════════════════════════════════
   Survey API
   ════════════════════════════════════════════════════════ */
export const surveyAPI = {
  getSurveys: async () => {
    const { data } = await api.get('/api/v1/surveys/');
    return data;
  },
  getSurvey: async (id: number) => {
    const { data } = await api.get(`/api/v1/surveys/${id}/`);
    return data;
  },
  /**
   * Fetch questions for a survey, filtered by the attempt's selected sector.
   * The backend returns: universal questions (sector='') + questions matching
   * the attempt's sector.  For a combined survey this gives 172+8 = 180 Qs.
   * Without `attemptId` it returns ALL active questions (unfiltered).
   */
  getQuestions: async (surveyId: number, attemptId?: number) => {
    const params = attemptId ? { attempt: attemptId } : {};
    const { data } = await api.get(`/api/v1/surveys/${surveyId}/questions/`, { params });
    return data as unknown[];
  },
};

/* ════════════════════════════════════════════════════════
   User API
   ════════════════════════════════════════════════════════ */
export interface ProfilePayload {
  first_name?: string;
  last_name?:  string;
  email?:      string;
  company_name?: string;
  phone?:      string;
}

export const userAPI = {
  getProfile: async () => {
    const { data } = await api.get('/api/v1/users/me/');
    return data;
  },
  updateProfile: async (payload: ProfilePayload) => {
    const { data } = await api.patch('/api/v1/users/update_me/', payload);
    return data;
  },
  changePassword: async (oldPassword: string, newPassword: string) => {
    const { data } = await api.post('/api/v1/users/change_password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return data;
  },
  forgotPassword: async (email: string) => {
    const { data } = await api.post('/api/v1/users/forgot_password/', { email });
    return data;
  },
  resetPassword: async (uid: string, token: string, newPassword: string) => {
    const { data } = await api.post('/api/v1/users/reset_password/', {
      uid,
      token,
      new_password: newPassword,
    });
    return data;
  },
};

/* ════════════════════════════════════════════════════════
   E-Learning API
   ════════════════════════════════════════════════════════ */
export const elearningAPI = {
  getCourses: async () => {
    const { data } = await api.get('/api/v1/courses/');
    return data;
  },
  getCourse: async (id: number) => {
    const { data } = await api.get(`/api/v1/courses/${id}/`);
    return data;
  },
  getLessons: async (courseId?: number) => {
    // Fix L-07: use axios params instead of template-literal URL construction
    // so the value is properly encoded and the pattern stays consistent with
    // the rest of the API helpers.
    const { data } = await api.get('/api/v1/lessons/', {
      params: courseId !== undefined ? { course: courseId } : undefined,
    });
    return data;
  },
  getLesson: async (id: number) => {
    const { data } = await api.get(`/api/v1/lessons/${id}/`);
    return data;
  },
  completeLesson: async (id: number) => {
    const { data } = await api.post(`/api/v1/lessons/${id}/complete/`);
    return data;
  },
  getMyProgress: async () => {
    const { data } = await api.get('/api/v1/lesson-progress/my_progress/');
    return data;
  },
};

export default api;
