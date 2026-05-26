/**
 * Shared utilities — import from here, not from individual pages.
 */

/* ─── HTML Sanitizer (XSS protection for CKEditor content) ── */
// Fix MEDIUM: import DOMPurify at module level. The SSR guard (typeof window)
// prevents it from running on Node.js — consistent with courses/[id]/page.tsx.
import DOMPurify from 'dompurify';

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  // Server-side: DOMPurify requires a DOM; return plain text stripped of tags.
  if (typeof window === 'undefined') {
    return dirty.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'a', 'code', 'pre', 'blockquote'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    FORCE_BODY: false,
  });
}

/* ─── Grade colour (single source of truth) ─────────────── */
export function gradeColor(g: string | null | undefined): string {
  if (!g) return 'var(--ink-3)';
  if (g.startsWith('A')) return 'var(--olive-deep)';
  if (g.startsWith('B')) return '#4a7c6f';
  if (g.startsWith('C')) return 'var(--amber)';
  return 'var(--danger)';
}

/* ─── Priority colour (recommendations) ─────────────────── */
export function priorityColor(p: string | null | undefined): string {
  const lp = p?.toLowerCase() ?? '';
  if (lp.includes('high') || lp.includes('yüksek')) return 'var(--danger)';
  if (lp.includes('med')  || lp.includes('orta'))   return 'var(--amber)';
  return 'var(--olive-deep)';
}

/* ─── Format file size ───────────────────────────────────── */
export function formatBytes(bytes: number): string {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ─── Pad number to 2 digits ─────────────────────────────── */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
