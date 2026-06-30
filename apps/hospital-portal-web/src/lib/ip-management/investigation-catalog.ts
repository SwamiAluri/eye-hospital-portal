/**
 * Ward Pre-Op §1 Investigations — frontend display catalog (Phase 4).
 *
 * The investigation DTO does not surface `category` / `captureMode` / reference ranges,
 * so this catalog augments each canonical item by `itemKey` for the redesigned panel:
 *   - clinical grouping (Haematology / Biochemistry / Serology / Imaging / Cardiac …)
 *   - capture mode (numeric value · select · value+report · derived/read-only)
 *   - auto-populated reference range + unit
 *   - result-flag computation (H / L / N) → chip color
 *
 * Items not listed fall back to a numeric/text "General" entry. Keys are the canonical
 * `item_key`s seeded by migrations 142 + 144. See docs/ward-preop-redesign-phase0-mapping.md §1.
 */

export type InvestigationGroupKey =
  | 'haematology'
  | 'biochemistry'
  | 'serology'
  | 'imaging'
  | 'cardiac'
  | 'ophthalmic'
  | 'general';

export interface InvestigationGroupMeta {
  key: InvestigationGroupKey;
  label: string;
  order: number;
}

export const INVESTIGATION_GROUPS: Record<InvestigationGroupKey, InvestigationGroupMeta> = {
  haematology: { key: 'haematology', label: 'Haematology', order: 1 },
  biochemistry: { key: 'biochemistry', label: 'Biochemistry', order: 2 },
  serology: { key: 'serology', label: 'Serology', order: 3 },
  imaging: { key: 'imaging', label: 'Imaging & Biometry', order: 4 },
  cardiac: { key: 'cardiac', label: 'Cardiac', order: 5 },
  ophthalmic: { key: 'ophthalmic', label: 'Ophthalmic', order: 6 },
  general: { key: 'general', label: 'General', order: 7 },
};

export type CaptureMode = 'numeric' | 'text' | 'select' | 'value-report' | 'derived';

export interface InvestigationMeta {
  group: InvestigationGroupKey;
  captureMode: CaptureMode;
  /** Options for `select` capture mode. */
  options?: { value: string; label: string }[];
  /** Auto-populated unit (overrides DTO defaultUnit when set). */
  unit?: string;
  /** Auto-populated reference range, e.g. "70–140". */
  referenceRange?: string;
}

const BLOOD_GROUP_OPTIONS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(v => ({
  value: v,
  label: v,
}));

const SEROLOGY_OPTIONS = [
  { value: 'Non-reactive', label: 'Non-reactive' },
  { value: 'Reactive', label: 'Reactive' },
  { value: 'Pending', label: 'Pending' },
];

const DUCT_OPTIONS = [
  { value: 'Patent', label: 'Patent' },
  { value: 'Blocked', label: 'Blocked' },
  { value: 'Regurgitation', label: 'Regurgitation' },
];

/** Canonical §1 item metadata keyed by `item_key`. */
export const INVESTIGATION_CATALOG: Record<string, InvestigationMeta> = {
  // Haematology
  hemoglobin: { group: 'haematology', captureMode: 'numeric', unit: 'g/dL', referenceRange: '12–16' },
  pt_inr: { group: 'haematology', captureMode: 'numeric', referenceRange: '0.8–1.2' },
  blood_group: { group: 'haematology', captureMode: 'select', options: BLOOD_GROUP_OPTIONS },

  // Biochemistry
  blood_sugar: { group: 'biochemistry', captureMode: 'numeric', unit: 'mg/dL', referenceRange: '70–140' },
  serum_creatinine: { group: 'biochemistry', captureMode: 'numeric', unit: 'mg/dL', referenceRange: '0.6–1.3' },
  blood_urea: { group: 'biochemistry', captureMode: 'numeric', unit: 'mg/dL', referenceRange: '15–40' },
  hba1c_done: { group: 'biochemistry', captureMode: 'numeric', unit: '%', referenceRange: '<6.5' },

  // Serology
  hiv_done: { group: 'serology', captureMode: 'select', options: SEROLOGY_OPTIONS },
  hbsag_done: { group: 'serology', captureMode: 'select', options: SEROLOGY_OPTIONS },
  hcv_done: { group: 'serology', captureMode: 'select', options: SEROLOGY_OPTIONS },

  // Imaging & biometry (report upload optional)
  ascan_done: { group: 'imaging', captureMode: 'value-report', unit: 'mm' },
  bscan_done: { group: 'imaging', captureMode: 'value-report' },
  xray_ga_cases: { group: 'imaging', captureMode: 'value-report' },

  // Cardiac
  ecg_done: { group: 'cardiac', captureMode: 'value-report' },

  // Ophthalmic
  duct_assessed: { group: 'ophthalmic', captureMode: 'select', options: DUCT_OPTIONS },

  // General
  bp_checked: { group: 'general', captureMode: 'derived', unit: 'mmHg' },
  physician_fitness: { group: 'general', captureMode: 'text' },
};

/** Items re-homed elsewhere by the v2 dedupe (Phase 2) — hidden from §1. */
export const INVESTIGATION_HIDDEN_KEYS = new Set<string>(['consent_confirmed']);

const DEFAULT_META: InvestigationMeta = { group: 'general', captureMode: 'text' };

export function investigationMeta(itemKey: string, valueType?: string | null): InvestigationMeta {
  const meta = INVESTIGATION_CATALOG[itemKey];
  if (meta) return meta;
  return {
    ...DEFAULT_META,
    captureMode: valueType === 'numeric' ? 'numeric' : 'text',
  };
}

export function investigationGroup(itemKey: string): InvestigationGroupMeta {
  return INVESTIGATION_GROUPS[investigationMeta(itemKey).group];
}

export function isHiddenInvestigation(itemKey: string): boolean {
  return INVESTIGATION_HIDDEN_KEYS.has(itemKey);
}

/** Ordered group keys for stable section rendering. */
export const INVESTIGATION_GROUP_ORDER: InvestigationGroupKey[] = Object.values(INVESTIGATION_GROUPS)
  .sort((a, b) => a.order - b.order)
  .map(g => g.key);

// ─── Result flag (H / L / N) ────────────────────────────────────────────────────

export type ResultFlag = 'H' | 'L' | 'N';

function firstNumber(s: string): number | null {
  const m = s.replace(',', '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * Compute an out-of-range flag from a numeric value against a reference range.
 * Supports "lo–hi", "lo-hi", "<hi", ">lo". Returns null when not computable.
 */
export function computeResultFlag(
  rawValue: string | null | undefined,
  referenceRange: string | null | undefined,
): ResultFlag | null {
  if (!rawValue || !referenceRange) return null;
  const value = firstNumber(rawValue);
  if (value === null) return null;

  const range = referenceRange.trim();
  if (range.startsWith('<')) {
    const hi = firstNumber(range);
    if (hi === null) return null;
    return value >= hi ? 'H' : 'N';
  }
  if (range.startsWith('>')) {
    const lo = firstNumber(range);
    if (lo === null) return null;
    return value <= lo ? 'L' : 'N';
  }

  const parts = range.split(/[–-]/).map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const lo = firstNumber(parts[0]);
  const hi = firstNumber(parts[1]);
  if (lo === null || hi === null) return null;
  if (value < lo) return 'L';
  if (value > hi) return 'H';
  return 'N';
}

export const RESULT_FLAG_META: Record<ResultFlag, { label: string; className: string }> = {
  H: { label: 'High', className: 'text-red-700 bg-red-50 border-red-200' },
  L: { label: 'Low', className: 'text-amber-700 bg-amber-50 border-amber-200' },
  N: { label: 'Normal', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
};
