import type { PreOpCompletionDto } from '@/lib/api/ip-management.api';
import {
  buildStructuredPayload,
  formatComorbiditySummary,
  formatWardDiagnosisSummary,
  type ClinicalEvaluationFields,
  serializeComorbidityNotes,
  serializeStructuredPayload,
} from '@/lib/ip-management/clinical-evaluation';

export function buildSurgicalPlanCompletionPatch(
  fields: ClinicalEvaluationFields,
  _completion: PreOpCompletionDto,
): {
  isCompleted: boolean;
  notes: string | null;
  resultValue: string | null;
  resultUnit: string | null;
} {
  const diagnosisSummary = formatWardDiagnosisSummary(fields.diagnoses) || fields.diagnosisSummary.trim();
  const payload = buildStructuredPayload(fields);

  return {
    resultValue: diagnosisSummary || null,
    // Structured eval JSON lives in notes (TEXT). result_unit is VARCHAR(50) for lab units only.
    resultUnit: null,
    notes: serializeStructuredPayload(payload),
    isCompleted: fields.surgicalPlanConfirmed && !!diagnosisSummary,
  };
}

export function buildComorbidityCompletionPatch(fields: ClinicalEvaluationFields): {
  notes: string | null;
  isCompleted: boolean;
} {
  const serialized = serializeComorbidityNotes(fields.comorbidities);
  return {
    notes: serialized || formatComorbiditySummary(fields.comorbidities) || null,
    isCompleted: serialized.length > 0,
  };
}
