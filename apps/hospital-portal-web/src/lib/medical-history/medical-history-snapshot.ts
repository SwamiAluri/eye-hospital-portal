import type { Patient } from '@/lib/api/patients.api';
import type { DisplayAllergy } from '@/lib/medical-history/allergy-utils';
import { parseJsonAllergies } from '@/lib/medical-history/allergy-utils';
import type {
  ChronicCondition,
  FamilyCondition,
  Immunization,
  Medication,
  Surgery,
} from '@/lib/medical-history/medical-history-constants';
import type { MedicalHistorySnapshot } from '@/components/examination/medical-history/medical-history-handle';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';

const ACCOMMODATIONS_PREFIX = 'Accommodations:';

function parseSpecialNeedsForSnapshot(raw: string): { flags: string[]; needs: string } {
  if (!raw?.startsWith(ACCOMMODATIONS_PREFIX)) {
    return { flags: [], needs: raw || '' };
  }
  const [first, ...rest] = raw.split('\n');
  const flags = first
    .replace(ACCOMMODATIONS_PREFIX, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { flags, needs: rest.join('\n').trim() };
}

function parseJsonField(field: unknown): unknown[] {
  if (!field) return [];
  try {
    return typeof field === 'string' ? JSON.parse(field) : Array.isArray(field) ? field : [];
  } catch {
    return [];
  }
}

/** Strip `{ version: 1, ... }` wrapper from persisted segment bundles. */
export function normalizeMedicalHistoryBundleData(data: unknown): MedicalHistorySnapshot | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if ('version' in record && typeof record.version === 'number') {
    const { version: _v, ...rest } = record;
    return rest as MedicalHistorySnapshot;
  }
  return data as MedicalHistorySnapshot;
}

function hasItems(arr: unknown): arr is unknown[] {
  return Array.isArray(arr) && arr.length > 0;
}

/** Choose snapshot to hydrate MH on exam load: visit segment → draft → patient master. */
export function pickMedicalHistoryLoadSnapshot(sources: {
  draft?: MedicalHistorySnapshot | null;
  visitSegment?: MedicalHistorySnapshot | null;
  patient?: Patient | null;
}): MedicalHistorySnapshot | null {
  if (sources.visitSegment && medicalHistorySnapshotHasClinicalData(sources.visitSegment)) {
    return sources.visitSegment;
  }
  if (sources.draft && medicalHistorySnapshotHasClinicalData(sources.draft)) {
    return sources.draft;
  }
  if (sources.patient) {
    return medicalHistorySnapshotFromPatient(sources.patient);
  }
  return null;
}

/** True when snapshot has at least one MH field worth applying (avoids empty bundles wiping patient data). */
export function medicalHistorySnapshotHasClinicalData(
  snap: MedicalHistorySnapshot | null | undefined,
): boolean {
  if (!snap) return false;
  if (snap.nkda) return true;
  if (hasItems(snap.allergies)) return true;
  if (hasItems(snap.chronicConditions)) return true;
  if (hasItems(snap.medications)) return true;
  if (hasItems(snap.surgeries)) return true;
  if (hasItems(snap.familyHistory)) return true;
  if (hasItems(snap.immunizations)) return true;
  if (trim(snap.smokingStatus)) return true;
  if (trim(snap.alcoholUse)) return true;
  if (trim(snap.exerciseHabits)) return true;
  if (trim(snap.dietType)) return true;
  if (trim(snap.lifestyleNotes)) return true;
  if (trim(snap.disabilityStatus)) return true;
  if (trim(snap.specialNeeds)) return true;
  if (hasItems(snap.disabilityFlags)) return true;
  return false;
}

/** Build MH snapshot from patient master record (re-exam / never opened MH tab). */
export function medicalHistorySnapshotFromPatient(patient: Patient): MedicalHistorySnapshot {
  const chronicConditions = parseJsonField(patient.chronicConditions) as ChronicCondition[];
  const medications = parseJsonField(patient.currentMedications) as Medication[];
  const surgeries = parseJsonField(patient.pastSurgeries) as Surgery[];
  const familyHistory = parseJsonField(patient.familyMedicalHistory) as FamilyCondition[];
  const immunizations = parseJsonField(patient.immunizationRecords) as Immunization[];

  const nkda =
    Array.isArray(patient.allergies) &&
    patient.allergies.some((a) => a.toUpperCase() === 'NKDA');

  let allergies: DisplayAllergy[] = [];
  const jsonRows = parseJsonAllergies(patient.knownAllergiesDetails);
  if (jsonRows.length) {
    allergies = jsonRows.map((row, i) => ({
      id: row.id || `patient-${i}`,
      allergenName: row.name,
      allergenType: row.type || 'medication',
      severity: row.severity || 'moderate',
      reaction: row.reactions,
      notes: row.notes,
      status: 'active',
      fromJsonOnly: true,
    }));
  } else if (!nkda && Array.isArray(patient.allergies)) {
    allergies = patient.allergies
      .filter((a) => a.toUpperCase() !== 'NKDA')
      .map((allergenName, i) => ({
        id: `patient-label-${i}`,
        allergenName,
        allergenType: 'medication',
        severity: 'moderate',
        status: 'active',
        fromJsonOnly: true,
      }));
  }

  const parsedNeeds = parseSpecialNeedsForSnapshot(patient.specialNeeds || '');

  return {
    allergies,
    nkda,
    chronicConditions,
    medications,
    allergiesLegacy: [],
    surgeries,
    familyHistory,
    immunizations,
    smokingStatus: patient.smokingStatus || '',
    alcoholUse: patient.alcoholUse || '',
    exerciseHabits: patient.exerciseHabits || '',
    dietType: patient.dietType || '',
    lifestyleNotes: patient.lifestyleNotes || '',
    disabilityStatus: patient.disabilityStatus || '',
    specialNeeds: patient.specialNeeds || '',
    disabilityFlags: parsedNeeds.flags,
    smokingQuitDate: '',
    smokingPackYears: '',
  };
}

export type MedicalHistoryLifestyleFields = {
  smokingStatus: string;
  smokingQuitDate: string;
  smokingPackYears: string;
  alcoholUse: string;
  exerciseHabits: string;
  dietType: string;
  lifestyleNotes: string;
  disabilityStatus: string;
  specialNeeds: string;
  disabilityFlags: string[];
};

function trim(s: string | undefined): string {
  return (s ?? '').trim();
}

function normalizeAllergies(allergies: DisplayAllergy[]): DisplayAllergy[] {
  return [...allergies]
    .map((a) => ({
      id: a.id,
      allergenName: trim(a.allergenName),
      allergenType: trim(a.allergenType) || 'medication',
      severity: trim(a.severity) || 'moderate',
      reaction: trim(a.reaction) || undefined,
      notes: trim(a.notes) || undefined,
      status: a.status,
      isNew: a.isNew,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeConditions(items: ChronicCondition[]): ChronicCondition[] {
  return [...items]
    .map((c) => ({
      id: c.id,
      name: trim(c.name),
      diagnosedYear: trim(c.diagnosedYear) || undefined,
      severity: trim(c.severity) || undefined,
      status: trim(c.status) || undefined,
      notes: trim(c.notes) || undefined,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeMedications(items: Medication[]): Medication[] {
  return [...items]
    .map((m) => ({
      id: m.id,
      name: trim(m.name),
      dosage: trim(m.dosage) || undefined,
      frequency: trim(m.frequency) || undefined,
      route: trim(m.route) || undefined,
      startDate: trim(m.startDate) || undefined,
      notes: trim(m.notes) || undefined,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeSurgeries(items: Surgery[]): Surgery[] {
  return [...items]
    .map((s) => ({
      id: s.id,
      name: trim(s.name),
      date: trim(s.date) || undefined,
      outcome: trim(s.outcome) || undefined,
      notes: trim(s.notes) || undefined,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeFamily(items: FamilyCondition[]): FamilyCondition[] {
  return [...items]
    .map((f) => ({
      id: f.id,
      condition: trim(f.condition),
      relationship: trim(f.relationship) || undefined,
      ageOfOnset: trim(f.ageOfOnset) || undefined,
      notes: trim(f.notes) || undefined,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeImmunizations(items: Immunization[]): Immunization[] {
  return [...items]
    .map((i) => ({
      id: i.id,
      vaccine: trim(i.vaccine),
      date: trim(i.date) || undefined,
      doseNumber: trim(i.doseNumber) || undefined,
      notes: trim(i.notes) || undefined,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Canonical JSON string for dirty comparison (stable ordering, trimmed strings). */
export function serializeMedicalHistorySnapshot(
  allergies: DisplayAllergy[],
  nkda: boolean,
  chronicConditions: ChronicCondition[],
  medications: Medication[],
  surgeries: Surgery[],
  familyHistory: FamilyCondition[],
  immunizations: Immunization[],
  lifestyle: MedicalHistoryLifestyleFields,
): string {
  return JSON.stringify({
    nkda: Boolean(nkda),
    allergies: normalizeAllergies(allergies),
    chronicConditions: normalizeConditions(chronicConditions),
    medications: normalizeMedications(medications),
    surgeries: normalizeSurgeries(surgeries),
    familyHistory: normalizeFamily(familyHistory),
    immunizations: normalizeImmunizations(immunizations),
    smokingStatus: trim(lifestyle.smokingStatus),
    smokingQuitDate: trim(lifestyle.smokingQuitDate),
    smokingPackYears: trim(lifestyle.smokingPackYears),
    alcoholUse: trim(lifestyle.alcoholUse),
    exerciseHabits: trim(lifestyle.exerciseHabits),
    dietType: trim(lifestyle.dietType),
    lifestyleNotes: trim(lifestyle.lifestyleNotes),
    disabilityStatus: trim(lifestyle.disabilityStatus),
    specialNeeds: trim(lifestyle.specialNeeds),
    disabilityFlags: [...lifestyle.disabilityFlags].sort(),
  });
}

export function serializeMedicalHistorySnapshotFromRecord(
  snap: MedicalHistorySnapshot,
  buildSpecialNeeds: (flags: string[], needs: string) => string,
  parseSpecialNeeds: (raw: string) => { flags: string[]; needs: string },
): string {
  const flags = snap.disabilityFlags;
  const specialNeeds =
    flags && flags.length > 0
      ? snap.specialNeeds ?? ''
      : parseSpecialNeeds(snap.specialNeeds ?? '').needs;
  const disabilityFlags =
    flags && flags.length > 0 ? flags : parseSpecialNeeds(snap.specialNeeds ?? '').flags;

  return serializeMedicalHistorySnapshot(
    (snap.allergies ?? []) as DisplayAllergy[],
    Boolean(snap.nkda),
    (snap.chronicConditions ?? []) as ChronicCondition[],
    (snap.medications ?? []) as Medication[],
    (snap.surgeries ?? []) as Surgery[],
    (snap.familyHistory ?? []) as FamilyCondition[],
    (snap.immunizations ?? []) as Immunization[],
    {
      smokingStatus: snap.smokingStatus ?? '',
      smokingQuitDate: (snap as { smokingQuitDate?: string }).smokingQuitDate ?? '',
      smokingPackYears: (snap as { smokingPackYears?: string }).smokingPackYears ?? '',
      alcoholUse: snap.alcoholUse ?? '',
      exerciseHabits: snap.exerciseHabits ?? '',
      dietType: snap.dietType ?? '',
      lifestyleNotes: snap.lifestyleNotes ?? '',
      disabilityStatus: snap.disabilityStatus ?? '',
      specialNeeds: buildSpecialNeeds(disabilityFlags, specialNeeds),
      disabilityFlags,
    },
  );
}

function parseStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v : (v as { name?: string })?.name))
      .filter((v): v is string => Boolean(v && String(v).trim()))
      .map((v) => String(v).trim());
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseStringList(parsed);
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  return [];
}

/** Build partial MH state from prior visit summary/raw payload. */
export function medicalHistoryFromPriorVisit(
  prior: PriorVisitSnapshot,
): Partial<MedicalHistorySnapshot> | null {
  const raw = prior.raw as Record<string, unknown> | undefined;
  if (!raw) return null;

  const bundle = raw.medicalHistoryBundle as MedicalHistorySnapshot | undefined;
  if (bundle && typeof bundle === 'object') {
    const ts = Date.now();
    const reId = <T extends { id: string }>(items: T[] | undefined, offset: number): T[] =>
      (items ?? []).map((item, i) => ({ ...item, id: `prior-${ts}-${offset + i}` }));
    return {
      nkda: bundle.nkda,
      allergies: reId(bundle.allergies as DisplayAllergy[], 200),
      chronicConditions: reId(bundle.chronicConditions as ChronicCondition[], 0),
      medications: reId(bundle.medications as Medication[], 100),
      surgeries: reId(bundle.surgeries as Surgery[], 300),
      familyHistory: reId(bundle.familyHistory as FamilyCondition[], 400),
      immunizations: reId(bundle.immunizations as Immunization[], 500),
      smokingStatus: bundle.smokingStatus,
      smokingQuitDate: bundle.smokingQuitDate,
      smokingPackYears: bundle.smokingPackYears,
      alcoholUse: bundle.alcoholUse,
      exerciseHabits: bundle.exerciseHabits,
      dietType: bundle.dietType,
      lifestyleNotes: bundle.lifestyleNotes,
      disabilityStatus: bundle.disabilityStatus,
      specialNeeds: bundle.specialNeeds,
      disabilityFlags: bundle.disabilityFlags,
    };
  }

  const ts = Date.now();
  const nextId = (i: number) => `prior-${ts}-${i}`;

  const conditionNames = parseStringList(raw.conditions ?? raw.chronicConditions);
  const medNames = parseStringList(raw.medications ?? raw.currentMedications);
  const allergyNames = parseStringList(raw.allergies);

  const nkda = allergyNames.some((a) => a.toUpperCase() === 'NKDA');
  const allergyFiltered = allergyNames.filter((a) => a.toUpperCase() !== 'NKDA');

  const result: Partial<MedicalHistorySnapshot> = {};

  if (conditionNames.length) {
    result.chronicConditions = conditionNames.map((name, i) => ({
      id: nextId(i),
      name,
    }));
  }

  if (medNames.length) {
    result.medications = medNames.map((name, i) => ({
      id: nextId(100 + i),
      name,
    }));
  }

  if (nkda) {
    result.nkda = true;
    result.allergies = [];
  } else if (allergyFiltered.length) {
    result.nkda = false;
    result.allergies = allergyFiltered.map((allergenName, i) => ({
      id: nextId(200 + i),
      allergenName,
      allergenType: 'medication',
      severity: 'moderate',
      status: 'active',
    })) as DisplayAllergy[];
  }

  if (
    !result.chronicConditions?.length &&
    !result.medications?.length &&
    !result.allergies?.length &&
    !result.nkda
  ) {
    return null;
  }

  return result;
}
