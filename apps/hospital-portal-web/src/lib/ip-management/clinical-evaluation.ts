import type { PreOpCompletionDto } from '@/lib/api/ip-management.api';
import {
  parseDiagnosisJson,
  serializeDiagnosisJson,
  type DiagnosisEntry,
} from '@/lib/ccms/clinical-code-fields';

/** Evaluation checklist rows owned by the structured Clinical Evaluation form (Phase 5). */
export const CLINICAL_EVAL_STRUCTURED_KEYS = [
  'risk_classification',
  'comorbidities_reviewed',
  'surgical_plan_confirmed',
  'patient_counselled',
  'doctor_evaluation_completed',
  'doctor_evaluation_signed',
] as const;

/** Retired from the ward form — ASA in PAC is the risk source of truth. */
export const CLINICAL_EVAL_RETIRED_KEYS = ['risk_classification'] as const;

/** Sign-off writes both; only count the signed row toward readiness. */
export const CLINICAL_EVAL_SIGNOFF_DEDUPE_KEYS = ['doctor_evaluation_completed'] as const;

export type DiagnosisLaterality = 'OD' | 'OS' | 'OU';

export interface WardDiagnosisEntry extends DiagnosisEntry {
  laterality?: DiagnosisLaterality;
}

export type DiagnosisConfirmationStatus = 'confirmed' | 'overridden' | 'pending';

export interface OutpatientDiagnosisSource {
  description: string;
  icd10?: string;
  laterality?: DiagnosisLaterality;
}

export type IolPlanStatus = 'pending' | 'confirmed' | 'changed';

export interface WardIolPlan {
  counsellingIolId: string | null;
  wardIolId: string | null;
  power: string;
  toricAxis: string;
  status: IolPlanStatus;
  changeReason: string;
}

export interface EvaluationStructuredPayload {
  v: 1;
  diagnoses: WardDiagnosisEntry[];
  diagnosisStatus: DiagnosisConfirmationStatus;
  sourceDiagnosis: OutpatientDiagnosisSource | null;
  diagnosisOverrideReason: string;
  clinicalNote: string;
  iol: WardIolPlan;
}

export const COMORBIDITY_CHECKLIST_ITEMS = [
  { key: 'diabetes_controlled', label: 'Diabetes mellitus (controlled)' },
  { key: 'diabetes_uncontrolled', label: 'Diabetes mellitus (uncontrolled)' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'cardiac', label: 'Cardiac disease / recent MI' },
  { key: 'renal', label: 'Renal disease' },
  { key: 'respiratory', label: 'Respiratory disease (asthma/COPD)' },
  { key: 'anticoagulation', label: 'Anticoagulation / antiplatelet therapy' },
] as const;

export type ComorbidityCheckKey = (typeof COMORBIDITY_CHECKLIST_ITEMS)[number]['key'];

export interface ComorbidityReviewState {
  nad: boolean;
  items: Partial<Record<ComorbidityCheckKey, boolean>>;
  other: string;
}

export interface ClinicalEvaluationFields {
  diagnoses: WardDiagnosisEntry[];
  diagnosisStatus: DiagnosisConfirmationStatus;
  sourceDiagnosis: OutpatientDiagnosisSource | null;
  diagnosisOverrideReason: string;
  comorbidities: ComorbidityReviewState;
  iol: WardIolPlan;
  clinicalNote: string;
  surgicalPlanConfirmed: boolean;
  patientCounselled: boolean;
  /** Legacy plain-text diagnosis mirror for PAC display. */
  diagnosisSummary: string;
}

export interface AmendClinicalEvaluationContext {
  kind: 'ward' | 'in_ot';
  reason: string;
  category?: string;
}

const EMPTY_IOL: WardIolPlan = {
  counsellingIolId: null,
  wardIolId: null,
  power: '',
  toricAxis: '',
  status: 'pending',
  changeReason: '',
};

const EMPTY_COMORBIDITIES: ComorbidityReviewState = {
  nad: false,
  items: {},
  other: '',
};

export function emptyClinicalEvaluationFields(): ClinicalEvaluationFields {
  return {
    diagnoses: [],
    diagnosisStatus: 'pending',
    sourceDiagnosis: null,
    diagnosisOverrideReason: '',
    comorbidities: { ...EMPTY_COMORBIDITIES, items: {} },
    iol: { ...EMPTY_IOL },
    clinicalNote: '',
    surgicalPlanConfirmed: false,
    patientCounselled: false,
    diagnosisSummary: '',
  };
}

export function completionByKey(
  completions: PreOpCompletionDto[],
  key: string,
): PreOpCompletionDto | undefined {
  return completions.find(c => c.itemKey === key);
}

function parseStructuredPayload(raw?: string | null): Partial<EvaluationStructuredPayload> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as EvaluationStructuredPayload;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function serializeStructuredPayload(payload: EvaluationStructuredPayload): string {
  return JSON.stringify(payload);
}

export function parseComorbidityNotes(raw?: string | null): ComorbidityReviewState {
  if (!raw?.trim()) return { ...EMPTY_COMORBIDITIES, items: {} };
  try {
    const parsed = JSON.parse(raw) as ComorbidityReviewState & { v?: number };
    if (parsed && typeof parsed === 'object' && ('nad' in parsed || 'items' in parsed)) {
      const items = { ...(parsed.items ?? {}) } as Partial<Record<string, boolean>>;
      if (items.diabetes && !items.diabetes_controlled && !items.diabetes_uncontrolled) {
        items.diabetes_controlled = true;
        delete items.diabetes;
      }
      return {
        nad: !!parsed.nad,
        items: items as ComorbidityReviewState['items'],
        other: parsed.other?.trim() ?? '',
      };
    }
  } catch {
    /* legacy plain text */
  }
  const legacy = raw.trim();
  if (legacy.toUpperCase() === 'NAD') {
    return { nad: true, items: {}, other: '' };
  }
  return { nad: false, items: {}, other: legacy };
}

export function serializeComorbidityNotes(state: ComorbidityReviewState): string {
  if (state.nad) {
    return JSON.stringify({ v: 1, nad: true, items: {}, other: '' });
  }
  const hasChecked = Object.values(state.items).some(Boolean);
  if (!hasChecked && !state.other.trim()) return '';
  return JSON.stringify({
    v: 1,
    nad: false,
    items: state.items,
    other: state.other.trim(),
  });
}

export function formatComorbiditySummary(state: ComorbidityReviewState): string {
  if (state.nad) return 'NAD';
  const labels = Object.entries(state.items)
    .filter(([, checked]) => checked)
    .map(([key]) => {
      const item = COMORBIDITY_CHECKLIST_ITEMS.find(i => i.key === key);
      if (item) return item.label;
      if (key === 'diabetes') return 'Diabetes mellitus';
      return key.replace(/_/g, ' ');
    });
  if (state.other.trim()) labels.push(state.other.trim());
  return labels.join('; ');
}

export function isComorbidityReviewComplete(state: ComorbidityReviewState): boolean {
  if (state.nad) return true;
  const hasChecked = Object.values(state.items).some(Boolean);
  return hasChecked || !!state.other.trim();
}

export function readClinicalEvaluationFields(
  completions: PreOpCompletionDto[],
): ClinicalEvaluationFields {
  const surgical = completionByKey(completions, 'surgical_plan_confirmed');
  const comorb = completionByKey(completions, 'comorbidities_reviewed');
  const counsel = completionByKey(completions, 'patient_counselled');

  const structured =
    parseStructuredPayload(surgical?.notes)
    ?? parseStructuredPayload(surgical?.resultUnit);
  const legacyDiagnosis = surgical?.resultValue?.trim() ?? '';

  let diagnoses: WardDiagnosisEntry[] = structured?.diagnoses ?? [];
  if (diagnoses.length === 0 && legacyDiagnosis) {
    diagnoses = parseDiagnosisJson(legacyDiagnosis).map(d => ({
      ...d,
      laterality: undefined,
    }));
    if (diagnoses.length === 1 && !diagnoses[0].icd10 && diagnoses[0].description === legacyDiagnosis) {
      diagnoses = [{ icd10: '', description: legacyDiagnosis, isPrimary: true }];
    }
  }

  const iolFromStructured = structured?.iol;
  const legacyIolNotes = structured ? '' : (surgical?.notes?.trim() ?? '');
  const iol: WardIolPlan = iolFromStructured
    ? { ...EMPTY_IOL, ...iolFromStructured }
    : legacyIolNotes
      ? {
          ...EMPTY_IOL,
          wardIolId: null,
          power: '',
          status: 'pending',
          changeReason: '',
          counsellingIolId: null,
        }
      : { ...EMPTY_IOL };

  const diagnosisSummary =
    formatWardDiagnosisSummary(diagnoses) || legacyDiagnosis;

  const inferredDiagnosisStatus: DiagnosisConfirmationStatus =
    structured?.diagnosisStatus
    ?? (diagnoses.length > 0 && !!surgical?.isCompleted ? 'confirmed' : 'pending');

  return {
    diagnoses,
    diagnosisStatus: inferredDiagnosisStatus,
    sourceDiagnosis: structured?.sourceDiagnosis ?? null,
    diagnosisOverrideReason: structured?.diagnosisOverrideReason ?? '',
    clinicalNote: structured?.clinicalNote?.trim() ?? '',
    comorbidities: parseComorbidityNotes(comorb?.notes),
    iol: legacyIolNotes && !iolFromStructured
      ? { ...iol, power: legacyIolNotes }
      : iol,
    surgicalPlanConfirmed: !!surgical?.isCompleted,
    patientCounselled: !!counsel?.isCompleted,
    diagnosisSummary,
  };
}

export function formatWardDiagnosisSummary(diagnoses: WardDiagnosisEntry[]): string {
  const rows = diagnoses.filter(d => d.icd10.trim() || d.description.trim());
  if (rows.length === 0) return '';
  return rows
    .map(d => {
      const lat = d.laterality ? ` (${d.laterality})` : '';
      const code = d.icd10.trim() ? `${d.icd10.trim()} — ` : '';
      return `${code}${d.description.trim() || d.icd10.trim()}${lat}`;
    })
    .join('; ');
}

export function buildStructuredPayload(fields: ClinicalEvaluationFields): EvaluationStructuredPayload {
  return {
    v: 1,
    diagnoses: fields.diagnoses,
    diagnosisStatus: fields.diagnosisStatus,
    sourceDiagnosis: fields.sourceDiagnosis,
    diagnosisOverrideReason: fields.diagnosisOverrideReason,
    clinicalNote: fields.clinicalNote.trim(),
    iol: fields.iol,
  };
}

/** Single writer for pre-op diagnosis — stored on `surgical_plan_confirmed.resultValue`. */
export function getPreOpDiagnosisFromClearance(completions: PreOpCompletionDto[]): string | null {
  const fields = readClinicalEvaluationFields(completions);
  const summary = formatWardDiagnosisSummary(fields.diagnoses) || fields.diagnosisSummary.trim();
  return summary || null;
}

export function isEvaluationSignedOff(completions: PreOpCompletionDto[]): boolean {
  return !!completionByKey(completions, 'doctor_evaluation_signed')?.isCompleted;
}

export function hasWardDiagnosis(fields: ClinicalEvaluationFields): boolean {
  return fields.diagnoses.some(d => d.icd10.trim() || d.description.trim());
}

export function canSignOffEvaluation(fields: ClinicalEvaluationFields): boolean {
  const diagnosisOk =
    hasWardDiagnosis(fields)
    && (fields.diagnosisStatus === 'confirmed' || fields.diagnosisStatus === 'overridden');
  const overrideOk =
    fields.diagnosisStatus !== 'overridden' || !!fields.diagnosisOverrideReason.trim();
  const iolOk =
    !fields.iol.wardIolId
    || fields.iol.status !== 'changed'
    || !!fields.iol.changeReason.trim();

  return !!(
    diagnosisOk
    && overrideOk
    && iolOk
    && fields.surgicalPlanConfirmed
    && fields.patientCounselled
    && isComorbidityReviewComplete(fields.comorbidities)
  );
}

/** Standard amend: Admitted + ReadyForSurgery. Emergency: InOT with override. Requires prior sign-off. */
export function canAmendClinicalEvaluation(input: {
  clinicalState: string;
  signedOff: boolean;
  canSign: boolean;
  canAmendInOt?: boolean;
}): { allowed: boolean; kind: 'ward' | 'in_ot' | null } {
  if (!input.canSign || !input.signedOff) return { allowed: false, kind: null };
  if (input.clinicalState === 'Admitted' || input.clinicalState === 'ReadyForSurgery') {
    return { allowed: true, kind: 'ward' };
  }
  if (input.clinicalState === 'InOT' && input.canAmendInOt) {
    return { allowed: true, kind: 'in_ot' };
  }
  return { allowed: false, kind: null };
}

export function isClinicalEvaluationEditLocked(input: {
  readOnly: boolean;
  signedOff: boolean;
  isAmending: boolean;
}): boolean {
  if (input.readOnly) return true;
  if (input.signedOff && !input.isAmending) return true;
  return false;
}

export function hasIolPlanContent(iol: WardIolPlan): boolean {
  return !!(
    iol.wardIolId
    || iol.counsellingIolId
    || iol.power.trim()
    || iol.toricAxis.trim()
  );
}

/** Human-readable IOL line for signed-off summary (shows "Not recorded" when empty). */
export function formatIolPlanSummary(iol: WardIolPlan, iolName?: string | null): string {
  if (!hasIolPlanContent(iol)) return 'Not recorded';

  const parts: string[] = [];
  if (iolName?.trim()) parts.push(iolName.trim());
  else if (iol.wardIolId) parts.push('IOL selected');

  if (iol.power.trim()) parts.push(`power ${iol.power.trim()}`);
  if (iol.toricAxis.trim()) parts.push(`toric axis ${iol.toricAxis.trim()}°`);

  let line = parts.length > 0 ? parts.join(' · ') : 'Power recorded';
  if (iol.status === 'changed') line += ' (changed from counselling)';
  else if (iol.status === 'pending' && iol.wardIolId) line += ' (pending confirmation)';
  return line;
}

/** IOL / implant plan applies to cataract & IOL procedures only (not LASIK / refractive). */
export function isIolCataractProcedure(procedureName?: string | null): boolean {
  const name = (procedureName ?? '').toLowerCase();
  if (!name.trim()) return false;
  if (/\blasik\b|\brefractive\b|\bprk\b|\bsmile\b|\blasek\b/.test(name)) return false;
  return /\bcataract\b|\bphaco\b|\biol\b|\bsics\b|\bmics\b|\bphacoemulsification\b/.test(name);
}

export interface EvaluationReadinessCount {
  completed: number;
  total: number;
  blocking: number;
}

/** Per-step readiness for Evaluation — excludes retired risk row and duplicate sign-off tick. */
export function countEvaluationReadiness(completions: PreOpCompletionDto[]): EvaluationReadinessCount {
  const retired = new Set<string>([...CLINICAL_EVAL_RETIRED_KEYS, ...CLINICAL_EVAL_SIGNOFF_DEDUPE_KEYS]);
  const items = completions.filter(
    c =>
      c.category === 'Evaluation'
      && !retired.has(c.itemKey)
      && c.formCode !== 'WARD_CHECKLIST'
      && c.formCode !== 'WARD_INVESTIGATION_PREOP',
  );
  const blockingItems = items.filter(i => i.isBlocking);
  const pool = blockingItems.length > 0 ? blockingItems : items;
  const completed = pool.filter(i => i.isCompleted || i.isBypassed).length;
  return {
    completed,
    total: pool.length,
    blocking: blockingItems.filter(i => !(i.isCompleted || i.isBypassed)).length,
  };
}

export function diagnosesToLegacyJson(diagnoses: WardDiagnosisEntry[]): string | undefined {
  return serializeDiagnosisJson(
    diagnoses.map(d => ({
      icd10: d.icd10,
      description: d.description,
      isPrimary: d.isPrimary,
    })),
  );
}

export function mergeDiagnosisFromIcd(
  existing: WardDiagnosisEntry[],
  code: { code: string; description: string },
  laterality: DiagnosisLaterality,
  isPrimary: boolean,
): WardDiagnosisEntry[] {
  const next: WardDiagnosisEntry = {
    icd10: code.code,
    description: code.description,
    laterality,
    isPrimary: isPrimary || existing.length === 0,
  };
  const withoutDup = existing.filter(
    d => !(d.icd10 === next.icd10 && d.laterality === next.laterality),
  );
  const merged = [...withoutDup, next];
  if (isPrimary) {
    return merged.map(d => ({ ...d, isPrimary: d.icd10 === next.icd10 && d.laterality === next.laterality }));
  }
  if (!merged.some(d => d.isPrimary) && merged.length > 0) {
    merged[0] = { ...merged[0], isPrimary: true };
  }
  return merged;
}

export function outpatientDiagnosisFromJourney(diagnosis?: string | null): OutpatientDiagnosisSource | null {
  const text = diagnosis?.trim();
  if (!text) return null;
  return { description: text };
}
