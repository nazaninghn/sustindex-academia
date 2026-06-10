/* ─── Shared questionnaire types ─────────────────────────── */
/* CO-2: Extracted from app/questionnaire/[id]/page.tsx      */

export interface Choice {
  id: number;
  text: string;
  text_en?: string;
  text_tr?: string;
  score: number;
  order: number;
}

export interface NumericalThreshold {
  min: number | null;
  max: number | null;
  score: number;
}

export interface Question {
  id: number;
  text: string;
  text_en?: string;
  text_tr?: string;
  category: number;
  category_name: string;
  category_name_en?: string;
  category_name_tr?: string;
  order: number;
  allow_multiple: boolean;
  question_type: string;   // 'binary' | 'single' | 'multi' | 'numerical' | 'text' | 'choice' | 'mixed'
  choices: Choice[];
  attachment?: string;
  // v5 fields
  criterion_code?: string;
  layer?: string;          // 'GATE' | 'P' | 'I' | 'M' | 'R' | 'CONDITIONAL'
  is_gate?: boolean;
  numerical_thresholds?: NumericalThreshold[] | null;
  conditional_on_question?: number | null;
  conditional_on_min_score?: number;
  bonus_points?: number;
}

/** GRI phase with localised display label (lang-dependent, built in useQuestionnaire) */
export interface GriPhase {
  match: string;
  num: 1 | 2 | 3 | 4;
  label: string;
}

/** Question index range + IDs for a single GRI phase */
export interface PhaseBoundary {
  start: number;
  end: number;
  qIds: number[];
}
