import type { CoverageCase } from './ccms-coverage-cases.api';

export interface CounsellorDraftSnapshot {
  insurerName?: string;
  paymentType?: string;
  policyNumber?: string;
  membershipNumber?: string;
  insuredName?: string;
  relationshipToInsured?: string;
  sumInsured?: number | string;
  coPay?: number | string;
  policyExpiry?: string;
  financialYear?: string;
  coverageNotes?: string;
  surgeryDate?: string;
  estimatedSurgery?: number | string;
  estimatedLab?: number | string;
  estimatedRoom?: number | string;
  estimatedMedicines?: number | string;
  estimatedOther?: number | string;
  estimatedAmount?: number | string;
  clinicalNotes?: string;
  urgencyLevel?: string;
  tpaContactPerson?: string;
  tpaContactEmail?: string;
  tpaContactPhone?: string;
  diagnosisCode?: string;
  procedureCode?: string;
  roomClassEntitlement?: string;
}

export function parseCounsellorDraft(json?: string): CounsellorDraftSnapshot | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as CounsellorDraftSnapshot;
  } catch {
    return null;
  }
}

export function displayPatientName(case_: CoverageCase, draft?: CounsellorDraftSnapshot | null): string {
  return (
    case_.patientName?.trim()
    || draft?.insuredName?.trim()
    || '—'
  );
}

export function formatMoney(v?: string | number | null): string | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : `₹${n.toLocaleString('en-IN')}`;
}
