import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token and language to requests if available
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add language preference
    const language = localStorage.getItem('language') || 'tr';
    config.headers['Accept-Language'] = language;
    
    // Also add as query param for better compatibility
    if (!config.params) {
      config.params = {};
    }
    config.params.lang = language;
  }
  return config;
});

// Attempt API
export const attemptAPI = {
  getMyAttempts: async () => {
    const response = await api.get('/api/v1/attempts/my_attempts/');
    return response.data;
  },

  getAttempt: async (id: number) => {
    const response = await api.get(`/api/v1/attempts/${id}/`);
    return response.data;
  },

  startAttempt: async (surveyId: number) => {
    const response = await api.post('/api/v1/attempts/', { survey: surveyId });
    return response.data;
  },

  submitAnswer: async (attemptId: number, questionId: number, choiceId: number) => {
    const response = await api.post('/api/v1/answers/', {
      attempt: attemptId,
      question: questionId,
      choice: choiceId,
    });
    return response.data;
  },

  completeAttempt: async (id: number) => {
    const response = await api.post(`/api/v1/attempts/${id}/complete/`);
    return response.data;
  },
};

// Survey API
export const surveyAPI = {
  getSurveys: async () => {
    const response = await api.get('/api/v1/surveys/');
    return response.data;
  },

  getSurvey: async (id: number) => {
    const response = await api.get(`/api/v1/surveys/${id}/`);
    return response.data;
  },
};

// User API
export const userAPI = {
  getProfile: async () => {
    const response = await api.get('/api/v1/accounts/profile/');
    return response.data;
  },

  updateProfile: async (data: any) => {
    const response = await api.put('/api/v1/accounts/profile/', data);
    return response.data;
  },
};

// E-Learning API
export const elearningAPI = {
  getCourses: async () => {
    const response = await api.get('/api/v1/courses/');
    return response.data;
  },

  getCourse: async (id: number) => {
    const response = await api.get(`/api/v1/courses/${id}/`);
    return response.data;
  },

  getLessons: async (courseId?: number) => {
    const url = courseId 
      ? `/api/v1/lessons/?course=${courseId}`
      : '/api/v1/lessons/';
    const response = await api.get(url);
    return response.data;
  },

  getLesson: async (id: number) => {
    const response = await api.get(`/api/v1/lessons/${id}/`);
    return response.data;
  },

  completeLesson: async (id: number) => {
    const response = await api.post(`/api/v1/lessons/${id}/complete/`);
    return response.data;
  },

  getMyProgress: async () => {
    const response = await api.get('/api/v1/lesson-progress/my_progress/');
    return response.data;
  },
};

export default api;
