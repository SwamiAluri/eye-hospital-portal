import type { PacAssessmentDto, PacMedicationLineDto } from '@/lib/api/ip-management.api';

export type MedHoldCategory = 'anticoag' | 'diabetes';

export interface MedHoldLine extends PacMedicationLineDto {
  category: MedHoldCategory;
}

export interface MedHoldSignals {
  /** All lines on the PAC current-medications list. */
  allMeds: PacMedicationLineDto[];
  /** PAC current-medication lines classified for hold relevance. */
  classified: MedHoldLine[];
  anticoagMeds: MedHoldLine[];
  diabetesMeds: MedHoldLine[];
  /** True when systemic review documents diabetes. */
  diabetesDocumented: boolean;
  showDiabetes: boolean;
  showAnticoag: boolean;
  hasPacMedications: boolean;
}

const DIABETES_RE =
  /diabet|insulin|metformin|gliclazide|glimepiride|glipizide|gliptin|\boha\b|sulfonylurea|sugar/i;
const ANTICOAG_RE =
  /warfarin|aspirin|ecosprin|clopidogrel|plavix|apixaban|rivaroxaban|dabigatran|heparin|enoxaparin|acitrom|acenocoumarol|anticoag|antiplatelet|\bdoac\b/i;

function medSearchText(med: PacMedicationLineDto): string {
  return `${med.name} ${med.dose ?? ''} ${med.frequency ?? ''}`.trim();
}

function classifyMedication(med: PacMedicationLineDto): MedHoldCategory | null {
  const text = medSearchText(med);
  if (ANTICOAG_RE.test(text)) return 'anticoag';
  if (DIABETES_RE.test(text)) return 'diabetes';
  return null;
}

/**
 * Auto-pull meds-to-hold signals from the PAC medication list (Phase 7).
 * Conditional fasting rows surface when PAC documents diabetes or anticoagulant therapy.
 */
export function computeMedHoldSignals(pac: PacAssessmentDto | null | undefined): MedHoldSignals {
  const lines = pac?.currentMedications ?? [];
  const classified: MedHoldLine[] = [];

  for (const med of lines) {
    const category = classifyMedication(med);
    if (category) classified.push({ ...med, category });
  }

  const anticoagMeds = classified.filter(m => m.category === 'anticoag');
  const diabetesMeds = classified.filter(m => m.category === 'diabetes');
  const diabetesDocumented = !!pac?.systemicReview?.diabetes?.trim();

  return {
    allMeds: lines,
    classified,
    anticoagMeds,
    diabetesMeds,
    diabetesDocumented,
    showDiabetes: diabetesDocumented || diabetesMeds.length > 0,
    showAnticoag: anticoagMeds.length > 0,
    hasPacMedications: lines.length > 0,
  };
}

export type MedHoldRowKey = 'anticoagulants_held' | 'insulin_dose_managed' | 'medication_adherence';

export interface MedHoldRowMeta {
  key: MedHoldRowKey;
  label: string;
  relevance: 'always' | 'diabetes' | 'anticoag';
}

export const MED_HOLD_ROWS: MedHoldRowMeta[] = [
  { key: 'anticoagulants_held', label: 'Anticoagulants held', relevance: 'anticoag' },
  { key: 'insulin_dose_managed', label: 'Insulin / OHA managed', relevance: 'diabetes' },
  { key: 'medication_adherence', label: 'Regular meds reviewed', relevance: 'always' },
];

/** Whether a fasting medication row should render (conditional on PAC + existing data). */
export function isMedHoldRowVisible(
  meta: MedHoldRowMeta,
  input: {
    isCompleted: boolean;
    isBlocking: boolean;
    pacLoading: boolean;
    pacLoaded: boolean;
    signals: MedHoldSignals;
  },
): boolean {
  if (meta.relevance === 'always') return true;
  if (input.isCompleted || input.isBlocking) return true;
  if (input.pacLoading || !input.pacLoaded) return true;
  return meta.relevance === 'diabetes' ? input.signals.showDiabetes : input.signals.showAnticoag;
}

export function medHoldHintForRow(
  key: MedHoldRowKey,
  signals: MedHoldSignals,
): string | null {
  if (key === 'anticoagulants_held' && signals.anticoagMeds.length > 0) {
    return signals.anticoagMeds.map(m => m.name).join(', ');
  }
  if (key === 'insulin_dose_managed' && (signals.diabetesMeds.length > 0 || signals.diabetesDocumented)) {
    if (signals.diabetesMeds.length > 0) {
      return signals.diabetesMeds.map(m => m.name).join(', ');
    }
    return 'Diabetes documented in PAC systemic review';
  }
  if (key === 'medication_adherence' && signals.hasPacMedications) {
    return signals.allMeds.map(m => m.name).filter(Boolean).join(', ');
  }
  return null;
}
