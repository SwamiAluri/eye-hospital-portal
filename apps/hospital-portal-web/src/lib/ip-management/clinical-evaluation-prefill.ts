import { getPatientDiagnoses } from '@/lib/api/diagnoses.api';
import biometryApi from '@/lib/api/biometry.api';
import { ipManagementApi } from '@/lib/api/ip-management.api';
import { getClinicalSummary } from '@/lib/api/widgets.api';
import { counsellingPackageTemplatesApi } from '@/lib/api/counselling-package-templates.api';
import type { DiagnosisLaterality, OutpatientDiagnosisSource, WardDiagnosisEntry } from './clinical-evaluation';
import type { ComorbidityReviewState } from './clinical-evaluation';
import { COMORBIDITY_CHECKLIST_ITEMS } from './clinical-evaluation';

function mapLaterality(raw?: string | null): DiagnosisLaterality {
  const v = (raw ?? '').toUpperCase();
  if (v === 'OD' || v === 'OS' || v === 'OU') return v;
  if (v.includes('RIGHT') || v === 'RE') return 'OD';
  if (v.includes('LEFT') || v === 'LE') return 'OS';
  return 'OU';
}

function eyeToBiometryEye(eye?: string | null): 'OD' | 'OS' | undefined {
  const e = (eye ?? '').toUpperCase();
  if (e.includes('OD') || e.includes('RE') || e.includes('RIGHT')) return 'OD';
  if (e.includes('OS') || e.includes('LE') || e.includes('LEFT')) return 'OS';
  return undefined;
}

/** Map chart comorbidity strings to structured checklist hints (non-destructive suggestions). */
export function mapChartComorbiditiesToChecklist(
  chartLines: string[],
): Partial<ComorbidityReviewState['items']> {
  const items: Partial<ComorbidityReviewState['items']> = {};
  const text = chartLines.join(' ').toLowerCase();
  if (!text.trim()) return items;

  if (/diabet|dm\s*2|dm2|niddm|iddm/.test(text)) {
    if (/uncontrolled|poor control|hba1c\s*([89]|1[0-9])/.test(text)) {
      items.diabetes_uncontrolled = true;
    } else {
      items.diabetes_controlled = true;
    }
  }
  if (/hypertens|htn|blood pressure/.test(text)) items.hypertension = true;
  if (/cardiac|cad|mi\b|heart failure|chf/.test(text)) items.cardiac = true;
  if (/renal|ckd|kidney/.test(text)) items.renal = true;
  if (/asthma|copd|respiratory/.test(text)) items.respiratory = true;
  if (/anticoag|warfarin|aspirin|clopidogrel|apixaban|rivaroxaban/.test(text)) {
    items.anticoagulation = true;
  }
  return items;
}

export function mergeSuggestedComorbidities(
  current: ComorbidityReviewState,
  suggested: Partial<ComorbidityReviewState['items']>,
): ComorbidityReviewState {
  if (current.nad || Object.values(current.items).some(Boolean) || current.other.trim()) {
    return current;
  }
  const hasSuggestion = Object.values(suggested).some(Boolean);
  if (!hasSuggestion) return current;
  return { nad: false, items: { ...suggested }, other: '' };
}

export async function loadPatientDiagnosesForPrefill(
  patientId: string,
): Promise<WardDiagnosisEntry[]> {
  try {
    const rows = await getPatientDiagnoses(patientId);
    const active = rows.filter(d => d.status === 'active' || !d.status);
    return active.map((d, i) => ({
      icd10: d.diagnosisCode?.code ?? '',
      description: d.diagnosisCode?.description ?? '',
      laterality: mapLaterality(d.laterality),
      isPrimary: d.isPrimary || i === 0,
    }));
  } catch {
    return [];
  }
}

export async function loadExamDiagnosisSource(
  patientId: string,
): Promise<OutpatientDiagnosisSource | null> {
  try {
    const summary = await getClinicalSummary(patientId);
    if (!summary.diagnosis || summary.diagnosis === 'Not recorded') return null;
    return {
      description: summary.diagnosis,
      icd10: summary.icd10Code || undefined,
    };
  } catch {
    return null;
  }
}

export async function loadChartComorbiditySuggestions(
  patientId: string,
): Promise<Partial<ComorbidityReviewState['items']>> {
  try {
    const summary = await getClinicalSummary(patientId);
    return mapChartComorbiditiesToChecklist(summary.comorbidities ?? []);
  } catch {
    return {};
  }
}

export async function loadSuggestedIolPower(
  patientId: string,
  eyeOperated?: string | null,
): Promise<string | null> {
  const eye = eyeToBiometryEye(eyeOperated);
  if (!eye) return null;
  try {
    const records = await biometryApi.getByPatient(patientId);
    const match = records
      .filter(r => r.eye === eye)
      .sort((a, b) => b.examinationDate.localeCompare(a.examinationDate))[0];
    if (!match) return null;
    const power = match.calculatedIOL ?? match.iolCalculations?.[0]?.iolPower;
    if (power == null || Number.isNaN(Number(power))) return null;
    const sign = Number(power) > 0 ? '+' : '';
    return `${sign}${Number(power).toFixed(1)} D`;
  } catch {
    return null;
  }
}

export async function loadJourneyIolPower(journeyId: string): Promise<string | null> {
  try {
    const detail = await ipManagementApi.getJourneyDetail(journeyId);
    const p = detail?.iolPower?.trim();
    return p || null;
  } catch {
    return null;
  }
}

export async function resolveCounsellingIolId(
  selectedIolId: string | null,
  packageTemplateId: string | null,
): Promise<string | null> {
  if (selectedIolId) return selectedIolId;
  if (!packageTemplateId) return null;
  try {
    const template = await counsellingPackageTemplatesApi.getById(packageTemplateId);
    return template.iolId ?? null;
  } catch {
    return null;
  }
}

/** Labels for any checked comorbidity keys (including legacy). */
export function comorbidityLabelForKey(key: string): string {
  const found = COMORBIDITY_CHECKLIST_ITEMS.find(i => i.key === key);
  if (found) return found.label;
  if (key === 'diabetes') return 'Diabetes mellitus';
  return key.replace(/_/g, ' ');
}
