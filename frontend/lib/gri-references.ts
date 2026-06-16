/**
 * GRI Standard Reference Lookup
 *
 * Maps question criterion codes and category names to the corresponding
 * GRI (Global Reporting Initiative) standard reference and documentation URL.
 * Used to display an informational badge in the questionnaire view.
 *
 * Based on the GRI Standards 2021 framework:
 *  GRI 1  – Foundation 2021
 *  GRI 2  – General Disclosures 2021
 *  GRI 3  – Material Topics 2021
 *  GRI Sector Standards – sector-specific
 */

export interface GriRef {
  /** Short standard label, e.g. "GRI 2" or "GRI 2-6" */
  standard: string;
  /** Documentation URL on globalreporting.org */
  url: string;
  /** Brief description for tooltip */
  description: string;
}

/* ─── Phase-level base references ─────────────────────────
   category_name contains one of these patterns (case-insensitive).          */
const PHASE_MAP: { match: string; ref: GriRef }[] = [
  {
    match: 'Foundation',
    ref: {
      standard: 'GRI 1',
      url: 'https://www.globalreporting.org/standards/media/2455/gri-1-foundation-2021.pdf',
      description: 'GRI 1: Foundation 2021 — sets out requirements and principles for all GRI reporting.',
    },
  },
  {
    match: 'General Disclosures',
    ref: {
      standard: 'GRI 2',
      url: 'https://www.globalreporting.org/standards/media/2456/gri-2-general-disclosures-2021.pdf',
      description: 'GRI 2: General Disclosures 2021 — covers organizational profile, governance, strategy, policies and practices.',
    },
  },
  {
    match: 'Material Topics',
    ref: {
      standard: 'GRI 3',
      url: 'https://www.globalreporting.org/standards/media/2452/gri-3-material-topics-2021.pdf',
      description: 'GRI 3: Material Topics 2021 — process to determine, manage, and report material topics.',
    },
  },
  {
    match: 'Sector',
    ref: {
      standard: 'GRI Sector',
      url: 'https://www.globalreporting.org/standards/sector-program/',
      description: 'GRI Sector Standard — sector-specific requirements for material topics and disclosures.',
    },
  },
];

/**
 * Derive a GRI standard reference from the question's category_name and
 * criterion_code. Returns null when no match is found (e.g. legacy questions).
 *
 * @param categoryName  - e.g. "GRI 2 · General Disclosures"
 * @param _criterionCode - e.g. "G1" (reserved for future fine-grained mapping)
 */
export function getGriRef(
  categoryName: string | undefined,
  _criterionCode?: string,
): GriRef | null {
  if (!categoryName) return null;
  const lower = categoryName.toLowerCase();

  for (const entry of PHASE_MAP) {
    if (lower.includes(entry.match.toLowerCase())) {
      return entry.ref;
    }
  }
  return null;
}
