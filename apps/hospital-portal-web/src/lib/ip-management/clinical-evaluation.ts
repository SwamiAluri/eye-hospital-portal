import type { PreOpCompletionDto } from '@/lib/api/ip-management.api';

/** Evaluation checklist rows owned by the structured Clinical Evaluation form (Phase 5). */
export const CLINICAL_EVAL_STRUCTURED_KEYS = [
  'risk_classification',
  'comorbidities_reviewed',
  'surgical_plan_confirmed',
  'patient_counselled',
  'doctor_evaluation_completed',
  'doctor_evaluation_signed',
] as const;

export const RISK_CLASS_OPTIONS = ['Low', 'Medium', 'High'] as const;
export type RiskClass = (typeof RISK_CLASS_OPTIONS)[number];

export interface ClinicalEvaluationFields {
  diagnosis: string;
  comorbidities: string;
  risk: RiskClass | '';
  iolPlan: string;
  counsellingNotes: string;
  surgicalPlanConfirmed: boolean;
  patientCounselled: boolean;
}

export function completionByKey(
  completions: PreOpCompletionDto[],
  key: string,
): PreOpCompletionDto | undefined {
  return completions.find(c => c.itemKey === key);
}

export function readClinicalEvaluationFields(
  completions: PreOpCompletionDto[],
): ClinicalEvaluationFields {
  const surgical = completionByKey(completions, 'surgical_plan_confirmed');
  const comorb = completionByKey(completions, 'comorbidities_reviewed');
  const risk = completionByKey(completions, 'risk_classification');
  const counsel = completionByKey(completions, 'patient_counselled');
  const riskValue = risk?.resultValue?.trim() ?? '';

  return {
    diagnosis: surgical?.resultValue?.trim() ?? '',
    iolPlan: surgical?.notes?.trim() ?? '',
    surgicalPlanConfirmed: !!surgical?.isCompleted,
    comorbidities: comorb?.notes?.trim() ?? '',
    risk: RISK_CLASS_OPTIONS.includes(riskValue as RiskClass) ? (riskValue as RiskClass) : '',
    counsellingNotes: counsel?.notes?.trim() ?? '',
    patientCounselled: !!counsel?.isCompleted,
  };
}

/** Single writer for pre-op diagnosis — stored on `surgical_plan_confirmed.resultValue`. */
export function getPreOpDiagnosisFromClearance(completions: PreOpCompletionDto[]): string | null {
  const dx = completionByKey(completions, 'surgical_plan_confirmed')?.resultValue?.trim();
  return dx || null;
}

export function isEvaluationSignedOff(completions: PreOpCompletionDto[]): boolean {
  return !!completionByKey(completions, 'doctor_evaluation_signed')?.isCompleted;
}

export function canSignOffEvaluation(fields: ClinicalEvaluationFields): boolean {
  return !!(
    fields.diagnosis.trim()
    && fields.risk
    && fields.surgicalPlanConfirmed
    && fields.patientCounselled
    && fields.comorbidities.trim()
  );
}
