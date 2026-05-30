import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';
import type { CounsellorDraftSnapshot } from '@/lib/api/ccms/parse-counsellor-draft';
import type { FinalizeSurgeryRecord } from '@/types/counsellors-desk';
import type { ClinicalSummaryData } from '@/lib/api/widgets.api';
import type { InsurancePayer, TpaOrganization } from '@/lib/api/ccms/ccms-master-data.api';

export interface PreAuthPrefillData {
  treatingDoctorName?: string;
  treatingDoctorReg?: string;
  admissionDate?: string;
  expectedDischargeDate?: string;
  lengthOfStayDays?: number;
  roomTypeRequested?: string;
  diagnosisJson?: string;
  proceduresJson?: string;
  clinicalSummary?: string;
  requestedAmount?: number;
  estimatedTotalCost?: number;
  copayAmount?: number;
  deductibleAmount?: number;
  tpaEmail?: string;
  recipientType?: 'tpa' | 'insurance';
}

function toIsoDate(v?: string | null): string | undefined {
  if (!v) return undefined;
  const d = v.includes('T') ? v.split('T')[0] : v.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function mapRoomClass(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const n = raw.toLowerCase().replace(/[\s_]+/g, '-');
  if (n.includes('icu') || n.includes('hdu')) return 'icu';
  if (n.includes('semi')) return 'semi-private';
  if (n === 'private' || n.includes('private')) return 'private';
  if (n.includes('general')) return 'general';
  return undefined;
}

function buildDiagnosisJson(
  draft?: CounsellorDraftSnapshot | null,
  clinical?: ClinicalSummaryData | null,
): string | undefined {
  const icd = draft?.diagnosisCode || clinical?.icd10Code;
  const desc = clinical?.diagnosis;
  if (!icd && !desc) return undefined;
  return JSON.stringify([{
    icd10: icd ?? '',
    description: desc ?? icd ?? '',
    isPrimary: true,
  }]);
}

function buildProceduresJson(
  draft?: CounsellorDraftSnapshot | null,
  ot?: FinalizeSurgeryRecord | null,
): string | undefined {
  const code = draft?.procedureCode;
  const name = ot?.surgeryName || ot?.packageName;
  if (!code && !name) return undefined;
  return JSON.stringify([{
    code: code ?? '',
    name: name ?? code ?? '',
  }]);
}

export function resolveEstimate(
  case_: CoverageCase,
  draft?: CounsellorDraftSnapshot | null,
): number | undefined {
  if (case_.estimatedAmount != null && case_.estimatedAmount > 0) {
    return case_.estimatedAmount;
  }
  const draftAmt = draft?.estimatedAmount != null ? Number(draft.estimatedAmount) : NaN;
  if (!Number.isNaN(draftAmt) && draftAmt > 0) return draftAmt;

  const parts = [
    draft?.estimatedSurgery,
    draft?.estimatedLab,
    draft?.estimatedRoom,
    draft?.estimatedMedicines,
    draft?.estimatedOther,
  ].map(v => (v != null ? Number(v) : 0));
  const sum = parts.reduce((a, b) => a + (Number.isNaN(b) ? 0 : b), 0);
  return sum > 0 ? sum : undefined;
}

function resolveCopay(draft?: CounsellorDraftSnapshot | null): number | undefined {
  if (draft?.coPay == null || draft.coPay === '') return undefined;
  const n = Number(draft.coPay);
  return Number.isNaN(n) ? undefined : n;
}

function buildClinicalSummary(
  draft?: CounsellorDraftSnapshot | null,
  clinical?: ClinicalSummaryData | null,
  ot?: FinalizeSurgeryRecord | null,
): string | undefined {
  if (draft?.clinicalNotes?.trim()) return draft.clinicalNotes.trim();

  const parts: string[] = [];
  if (clinical?.chiefComplaint) parts.push(`Chief complaint: ${clinical.chiefComplaint}`);
  if (clinical?.diagnosis) {
    parts.push(`Diagnosis: ${clinical.diagnosis}${clinical.icd10Code ? ` (${clinical.icd10Code})` : ''}`);
  }
  if (clinical?.lastExamFindings) parts.push(`Findings: ${clinical.lastExamFindings}`);
  if (ot?.surgeryName) parts.push(`Planned procedure: ${ot.surgeryName}`);
  if (ot?.remarks) parts.push(`Remarks: ${ot.remarks}`);

  return parts.length > 0 ? parts.join('\n') : undefined;
}

export function resolveTpaEmail(
  draft?: CounsellorDraftSnapshot | null,
  case_?: CoverageCase | null,
  payers?: InsurancePayer[],
  tpas?: TpaOrganization[],
  primaryPolicy?: VisitPolicy | null,
): { email: string; recipientType: 'tpa' | 'insurance' } {
  if (draft?.tpaContactEmail?.trim()) {
    return { email: draft.tpaContactEmail.trim(), recipientType: 'tpa' };
  }

  const tpaId = case_?.tpaProviderId ?? primaryPolicy?.tpaProviderId;
  if (tpaId && tpas?.length) {
    const tpa = tpas.find(t => t.id === tpaId);
    const email = tpa?.claimsEmail || tpa?.contactEmail;
    if (email?.trim()) return { email: email.trim(), recipientType: 'tpa' };
  }

  const insurerId = case_?.insuranceProviderId ?? primaryPolicy?.insuranceProviderId;
  if (insurerId && payers?.length) {
    const payer = payers.find(p => p.id === insurerId);
    if (payer?.contactEmail?.trim()) {
      return { email: payer.contactEmail.trim(), recipientType: 'insurance' };
    }
  }

  if (case_?.insurerName && payers?.length) {
    const match = payers.find(p =>
      p.name.toLowerCase().includes(case_!.insurerName!.toLowerCase())
      || case_!.insurerName!.toLowerCase().includes(p.name.toLowerCase()),
    );
    if (match?.contactEmail?.trim()) {
      return { email: match.contactEmail.trim(), recipientType: 'insurance' };
    }
  }

  return { email: '', recipientType: 'tpa' };
}

/** Fallback amounts when auth entity has zeros (e.g. workflow-only generate). */
export function resolveDisplayAmounts(
  auth: { requestedAmount?: number; estimatedTotalCost?: number },
  case_: CoverageCase,
  draft?: CounsellorDraftSnapshot | null,
): { requested: number; estimated: number } {
  const fromCase = resolveEstimate(case_, draft) ?? 0;
  const requested = auth.requestedAmount && auth.requestedAmount > 0
    ? auth.requestedAmount
    : fromCase;
  const estimated = auth.estimatedTotalCost && auth.estimatedTotalCost > 0
    ? auth.estimatedTotalCost
    : (requested || fromCase);
  return { requested, estimated };
}

export interface BuildPreAuthPrefillInput {
  case_: CoverageCase;
  draft?: CounsellorDraftSnapshot | null;
  primaryPolicy?: VisitPolicy | null;
  otRecord?: FinalizeSurgeryRecord | null;
  clinical?: ClinicalSummaryData | null;
  surgeonFromRegistry?: { name: string; licenseNumber?: string } | null;
  payers?: InsurancePayer[];
  tpas?: TpaOrganization[];
}

/** Synchronous merge of all pre-fill sources (counsellor draft → OT → doctor registry). */
export function buildPreAuthPrefill(input: BuildPreAuthPrefillInput): PreAuthPrefillData {
  const { case_, draft, primaryPolicy, otRecord, clinical, surgeonFromRegistry, payers, tpas } = input;

  const admissionDate = toIsoDate(draft?.surgeryDate)
    ?? toIsoDate(otRecord?.startTime)
    ?? toIsoDate(otRecord?.scheduleDate);

  const los = 1;
  const expectedDischargeDate = admissionDate ? addDays(admissionDate, los) : undefined;

  const treatingDoctorName =
    otRecord?.surgeon?.trim()
    || primaryPolicy?.doctorName?.trim()
    || surgeonFromRegistry?.name?.trim()
    || clinical?.referringDoctor?.trim()
    || undefined;

  const treatingDoctorReg =
    primaryPolicy?.doctorRegNumber?.trim()
    || surgeonFromRegistry?.licenseNumber?.trim()
    || undefined;

  const roomTypeRequested =
    mapRoomClass(draft?.roomClassEntitlement as string | undefined)
    ?? mapRoomClass(primaryPolicy?.accommodationClass)
    ?? undefined;

  const estimate = resolveEstimate(case_, draft);
  const copay = resolveCopay(draft);
  const { email, recipientType } = resolveTpaEmail(draft, case_, payers, tpas, primaryPolicy);

  return {
    treatingDoctorName,
    treatingDoctorReg,
    admissionDate,
    expectedDischargeDate,
    lengthOfStayDays: admissionDate ? los : undefined,
    roomTypeRequested,
    diagnosisJson: buildDiagnosisJson(draft, clinical),
    proceduresJson: buildProceduresJson(draft, otRecord),
    clinicalSummary: buildClinicalSummary(draft, clinical, otRecord),
    requestedAmount: estimate,
    estimatedTotalCost: estimate,
    copayAmount: copay,
    deductibleAmount: 0,
    tpaEmail: email,
    recipientType,
  };
}
