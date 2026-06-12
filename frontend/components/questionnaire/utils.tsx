/* ─── Shared questionnaire utilities ────────────────────── */
/* CO-2: Extracted from app/questionnaire/[id]/page.tsx     */

/** Letter labels for choice options A–J */
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/**
 * Stable phase-matching definitions — no lang dependency, safe as module constant.
 * Display labels are lang-dependent and are generated in useQuestionnaire.
 */
export const GRI_PHASE_DEFS = [
  { match: 'Foundation',          num: 1 as const },
  { match: 'General Disclosures', num: 2 as const },
  { match: 'Material Topics',     num: 3 as const },
  { match: 'Sector',              num: 4 as const },
] as const;

/** Resolve the localised text field of a translatable object.
 *
 * Priority:
 *  1. Dedicated text_tr / text_en field (set by translation pipeline)
 *  2. Split combined "Turkish / English" text on the first " / " separator
 *     (v5 import stores choices as "Evet / Yes", "Hayır / No", etc.)
 *  3. Raw text as-is
 */
/** Split a raw string on the FIRST " / " bilingual separator, returning the
 *  language-appropriate half.  Returns the original string unchanged if no
 *  valid separator is found (e.g. "ISO 27001/NIST" has no surrounding spaces).
 */
function splitBilingual(raw: string, lang: string): string {
  const sepIdx = raw.indexOf(' / ');
  if (sepIdx !== -1) {
    const trPart = raw.slice(0, sepIdx).trim();
    const enPart = raw.slice(sepIdx + 3).trim();
    if (trPart && enPart) return lang === 'en' ? enPart : trPart;
  }
  return raw;
}

export function loc(
  obj: { text?: string; text_en?: string; text_tr?: string },
  lang: string
): string {
  // Priority 1: dedicated language field — but ALSO split it in case the field
  // itself stores the combined "TR / EN" string (import pipeline sometimes copies
  // the combined value into text_tr/text_en instead of splitting it first).
  if (lang === 'tr' && obj.text_tr) return splitBilingual(obj.text_tr, 'tr');
  if (lang === 'en' && obj.text_en) return splitBilingual(obj.text_en, 'en');

  // Priority 2: split the combined `text` field.
  // Internal slashes like "ISO 27001/NIST" have no surrounding spaces, so
  // they are not mistakenly treated as language separators.
  return splitBilingual(obj.text || '', lang);
}

/**
 * Strip internal catalogue codes that the import command embeds in the
 * stored question text so they never reach the end user:
 *   - Leading  "[GRI2-18-I]  "  →  removed  (core GRI codes)
 *   - Leading  "[RET-02]  "    →  removed  (sector codes: RET, AG, EN, MFG, …)
 *   - Trailing "  [Implementation]" / "[Results]" / "[Policy]" / "[Measurement]" → removed
 *
 * Works for both plain-text storage and CKEditor HTML (handles <p>/<div> wrappers).
 */
export function cleanQuestionText(raw: string): string {
  if (!raw) return raw;
  const CODE_PREFIX = /\[(?:GRI[^\]]*|[A-Z]{1,6}-\d+)\]/i;
  return raw
    // HTML: strip code after opening block tag  <p>[RET-02]  →  <p>
    .replace(new RegExp(`(<(?:p|div|span)[^>]*>)\\s*${CODE_PREFIX.source}\\s*`, 'gi'), '$1')
    // Plain text: strip code at start of string
    .replace(new RegExp(`^${CODE_PREFIX.source}\\s*`, 'i'), '')
    // HTML: strip layer tag before closing block tag   [Implementation]</p>  →  </p>
    .replace(/\s*\[(?:Policy|Implementation|Measurement|Results)\]\s*(<\/(?:p|div|span)>)/gi, '$1')
    // Plain text: strip layer tag at end of string
    .replace(/\s*\[(?:Policy|Implementation|Measurement|Results)\]\s*$/i, '')
    .trim();
}

/** Inline SVG paperclip icon used in evidence upload UI and attachment links */
export function PaperclipIcon() {
  return (
    <svg
      width="13" height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.44 11.05L12.25 20.24a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.42 17.41a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
