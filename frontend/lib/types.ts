/* ── Shared API types ── */

export interface CategoryScore {
  id: number;
  key: string;
  name: string;
  score: number;
  max_score: number;
  percentage: number;
}

export interface AttemptResponse {
  id: number;
  user: number;
  user_name: string;
  survey: number | null;
  survey_name: string | null;
  session: number | null;
  session_name: string | null;
  started_at: string;
  completed_at: string | null;
  is_completed: boolean;
  total_score: number;
  overall_grade: string | null;
  answers?: AnswerResponse[];
  recommendations?: Recommendation[];
  category_scores: CategoryScore[];
}

export interface AnswerResponse {
  id: number;
  question_text: string;
  choice_text?: string;
  choices_display?: string;
  text_answer?: string;
  notes?: string;
  total_score: number;
  documents: DocumentResponse[];
}

export interface DocumentResponse {
  id: number;
  title: string;
  file: string;
  uploaded_at: string;
  file_size_display: string;
}

export interface Recommendation {
  category: string;
  priority: string;
  suggestion: string;
}

export interface CompleteAttemptResponse {
  attempt: AttemptResponse;
  summary: {
    total_score: number;
    total_possible: number;
    total_percentage: number;
    grade: string | null;
  };
}

/* ── UI helpers ── */

export type ScoreTone = 'danger' | 'warning' | 'good' | 'excellent';

export function getScoreTone(score: number): ScoreTone {
  if (score < 50) return 'danger';
  if (score < 70) return 'warning';
  if (score < 85) return 'good';
  return 'excellent';
}

export const toneTailwind: Record<ScoreTone, { bar: string; text: string; bg: string }> = {
  danger:    { bar: 'bg-red-500',    text: 'text-red-600',    bg: 'from-red-500 to-pink-500' },
  warning:   { bar: 'bg-orange-500', text: 'text-orange-600', bg: 'from-orange-500 to-amber-500' },
  good:      { bar: 'bg-green-500',  text: 'text-green-600',  bg: 'from-green-500 to-emerald-500' },
  excellent: { bar: 'bg-emerald-600',text: 'text-emerald-600',bg: 'from-emerald-500 to-green-500' },
};
