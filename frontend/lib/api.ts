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

    // Fix A: use the same key ('sx_lang') that LangProvider writes to.
    const lang = localStorage.getItem('sx_lang') || 'en';
    config.headers['Accept-Language'] = lang;
    config.params = { ...(config.params || {}), lang };
  }
  return config;
});

// ── Response interceptor: silent JWT refresh on 401 ───────
let isRefreshing  = false;
let failedQueue: { resolve: (t: string) => void; reject: (e: any) => void }[] = [];

const flushQueue = (error: any, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
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

  getAttempt: async (id: number) => {
    const { data } = await api.get(`/api/v1/attempts/${id}/`);
    return data;
  },

  startAttempt: async (surveyId: number) => {
    const { data } = await api.post('/api/v1/attempts/', { survey: surveyId });
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
    const payload: Record<string, any> = { attempt: attemptId, question: questionId };
    if (choiceIds && choiceIds.length > 0) payload.choices_ids = choiceIds;
    else if (choiceId !== null && choiceId !== undefined) payload.choice = choiceId;
    if (notes)      payload.notes       = notes;
    if (textAnswer) payload.text_answer = textAnswer;
    const { data } = await api.post('/api/v1/answers/', payload);
    return data;  // includes { id, ... }
  },

  completeAttempt: async (id: number) => {
    const { data } = await api.post(`/api/v1/attempts/${id}/complete/`);
    return data;
  },

  /** Upload a supporting document for a saved answer (uses native fetch so FormData boundary is set correctly) */
  uploadDocument: async (answerId: number, file: File, title?: string): Promise<any> => {
    if (typeof window === 'undefined') throw new Error('uploadDocument is browser-only');
    const token = localStorage.getItem('access_token');
    const form  = new FormData();
    form.append('answer', String(answerId));
    form.append('file',   file);
    form.append('title',  title || file.name);

    const res = await fetch(`${API_URL}/api/v1/documents/`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(JSON.stringify(err) || `Upload failed (${res.status})`);
    }
    return res.json();
  },
};

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
    const url = courseId ? `/api/v1/lessons/?course=${courseId}` : '/api/v1/lessons/';
    const { data } = await api.get(url);
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
