import type { PatientAllergy } from '@/lib/api/patient-allergies.api';

/** JSON shape stored on patient.knownAllergiesDetails */
export interface JsonAllergyRecord {
  id: string;
  name: string;
  type?: string;
  severity?: string;
  reactions?: string;
  notes?: string;
}

export interface DisplayAllergy {
  id: string;
  allergenName: string;
  allergenType: string;
  severity: string;
  reaction?: string;
  notes?: string;
  status: string;
  /** True when record exists only in JSON (not yet in API). */
  fromJsonOnly?: boolean;
  /** True for newly added rows not yet persisted to API. */
  isNew?: boolean;
}

const SEVERITY_API_TO_LABEL: Record<string, string> = {
  life_threatening: 'Life-threatening',
  severe: 'Severe',
  moderate: 'Moderate',
  mild: 'Mild',
};

const SEVERITY_LABEL_TO_API: Record<string, string> = {
  'life-threatening': 'life_threatening',
  'life threatening': 'life_threatening',
  severe: 'severe',
  moderate: 'moderate',
  mild: 'mild',
};

export function severityToLabel(severity: string | undefined): string {
  if (!severity) return 'Moderate';
  const key = severity.toLowerCase().replace(/\s+/g, '_');
  if (SEVERITY_API_TO_LABEL[key]) return SEVERITY_API_TO_LABEL[key];
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function severityToApi(severity: string | undefined): string {
  if (!severity) return 'moderate';
  const normalized = severity.toLowerCase().trim();
  if (SEVERITY_LABEL_TO_API[normalized]) return SEVERITY_LABEL_TO_API[normalized];
  if (normalized.includes('life')) return 'life_threatening';
  return normalized.replace(/-/g, '_');
}

export function parseJsonAllergies(field: unknown): JsonAllergyRecord[] {
  if (!field) return [];
  try {
    const parsed = typeof field === 'string' ? JSON.parse(field) : field;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function allergyKey(name: string, type: string): string {
  return `${name.trim().toLowerCase()}|${type.trim().toLowerCase()}`;
}

export function mergeAllergies(
  apiAllergies: PatientAllergy[],
  jsonAllergies: JsonAllergyRecord[],
): DisplayAllergy[] {
  const map = new Map<string, DisplayAllergy>();

  for (const row of apiAllergies) {
    if (row.status === 'inactive' || row.status === 'resolved') continue;
    const key = allergyKey(row.allergenName, row.allergenType);
    map.set(key, {
      id: row.id,
      allergenName: row.allergenName,
      allergenType: row.allergenType,
      severity: row.severity,
      reaction: row.reaction,
      notes: row.notes,
      status: row.status || 'active',
    });
  }

  for (const row of jsonAllergies) {
    const type = row.type || 'other';
    const key = allergyKey(row.name, type);
    if (map.has(key)) continue;
    map.set(key, {
      id: row.id || `json-${key}`,
      allergenName: row.name,
      allergenType: type,
      severity: severityToApi(row.severity),
      reaction: row.reactions,
      notes: row.notes,
      status: 'active',
      fromJsonOnly: true,
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.allergenName.localeCompare(b.allergenName),
  );
}

export function allergiesToJsonSnapshot(allergies: DisplayAllergy[]): string {
  const payload: JsonAllergyRecord[] = allergies
    .filter((a) => a.status === 'active')
    .map((a) => ({
      id: a.id.startsWith('json-') || a.id.startsWith('new-') ? Date.now().toString() : a.id,
      name: a.allergenName,
      type: a.allergenType,
      severity: severityToLabel(a.severity),
      reactions: a.reaction,
      notes: a.notes,
    }));
  return JSON.stringify(payload);
}

export function allergyDisplayLabel(a: DisplayAllergy): string {
  return `${a.allergenName} (${severityToLabel(a.severity)})`;
}

export function isCriticalSeverity(severity: string | undefined): boolean {
  const s = severity?.toLowerCase() ?? '';
  return s === 'life_threatening' || s.includes('life');
}

export function isHighSeverity(severity: string | undefined): boolean {
  const s = severity?.toLowerCase() ?? '';
  return s === 'severe' || isCriticalSeverity(s);
}

export const ALLERGEN_TYPES = [
  { value: 'medication', label: 'Drug' },
  { value: 'food', label: 'Food' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'latex', label: 'Latex' },
  { value: 'other', label: 'Other' },
] as const;

export const ALLERGY_SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
  { value: 'life_threatening', label: 'Life-threatening' },
] as const;

export const COMMON_ALLERGENS = [
  'Penicillin',
  'Amoxicillin',
  'Sulfa Drugs',
  'Aspirin',
  'NSAIDs',
  'Latex',
  'Peanuts',
  'Shellfish',
  'Pollen',
  'Dust Mites',
  'Other',
] as const;
