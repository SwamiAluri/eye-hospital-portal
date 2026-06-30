import { getCcmsApi } from './ccms-base';

export type ExtractionConfidence = 'High' | 'Review' | 'Low';

export interface ExtractedField<T> {
  value: T | null;
  sourceText?: string | null;
  confidence: ExtractionConfidence;
  mismatchReason?: string | null;
}

export interface ExtractionCandidate {
  id: string;
  name: string;
  score: number;
}

export interface ExtractedPolicyFields {
  insurerName: ExtractedField<string>;
  policyNumber: ExtractedField<string>;
  cardNumber: ExtractedField<string>;
  membershipNumber: ExtractedField<string>;
  insuredName: ExtractedField<string>;
  relationshipToInsured: ExtractedField<string>;
  companyName: ExtractedField<string>;
  contactNumber: ExtractedField<string>;
  sumInsured: ExtractedField<number | null>;
  coPayPercent: ExtractedField<number | null>;
  validFrom: ExtractedField<string | null>;
  validTo: ExtractedField<string | null>;
  tpaName: ExtractedField<string>;
}

export interface PolicyExtractionPreview {
  sessionId: string;
  frontDocumentUrl?: string | null;
  backDocumentUrl?: string | null;
  originalFilename: string;
  providerModel: string;
  processingMs: number;
  hasDuplicateWarning: boolean;
  duplicateWarningDetail?: string | null;
  fields: ExtractedPolicyFields;
  insurerCandidates: ExtractionCandidate[];
  resolvedInsuranceProviderId?: string | null;
}

export interface PolicyExtractionStatus {
  enabled: boolean;
}

export interface ConfirmPolicyExtractionRequest {
  sessionId: string;
  idempotencyKey?: string;
  policyNumber: string;
  cardNumber?: string;
  membershipNumber?: string;
  insurerName?: string;
  insuranceProviderId?: string;
  insuredName?: string;
  relationshipToInsured?: string;
  companyName?: string;
  contactNumber?: string;
  sumInsured?: number;
  coPayPercent?: number;
  isPrimary?: boolean;
  applyToCoverageDraft?: boolean;
  frontDocumentUrl?: string;
  backDocumentUrl?: string;
  originalFilename?: string;
  providerModel?: string;
  processingMs?: number;
  highFieldCount?: number;
  reviewFieldCount?: number;
  lowFieldCount?: number;
  fieldOverrideCount?: number;
  overriddenFieldsJson?: string;
}

export interface ConfirmPolicyExtractionResponse {
  policyId: string;
  policyNumber: string;
  insuranceProviderId?: string;
  insurerName?: string;
}

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_BYTES = 10 * 1024 * 1024;

function validateFile(file: File): void {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Only JPEG, PNG, WebP, and PDF files are supported.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('File exceeds 10 MB limit.');
  }
}

/** Probe whether policy card OCR is enabled on CCMS. */
export async function getPolicyExtractionStatus(): Promise<PolicyExtractionStatus> {
  const { data } = await getCcmsApi().get<PolicyExtractionStatus>(
    '/ccms/policy-extraction/status',
  );
  return data;
}

/** Build idempotency key for confirm: policy-extract-{sessionId}-{slot}-{hash}. */
export async function buildPolicyExtractionIdempotencyKey(
  sessionId: string,
  slot: 'front' | 'back' | 'both',
  files: File[],
): Promise<string> {
  const parts: string[] = [sessionId, slot];
  for (const f of files) {
    const buf = await f.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
    parts.push(hex);
  }
  return `policy-extract-${parts.join('-')}`;
}

/** Upload front and/or back card images for OCR (may take up to 4 minutes). */
export async function uploadPolicyCardsForExtraction(
  caseId: string,
  opts: { front?: File; back?: File; sessionId?: string; paymentType?: string },
): Promise<PolicyExtractionPreview> {
  const { front, back, sessionId, paymentType } = opts;
  if (!front && !back) throw new Error('At least one card image is required.');
  if (front) validateFile(front);
  if (back) validateFile(back);

  const formData = new FormData();
  if (front) {
    formData.append('front', front);
    formData.append('insurance_card_front', front);
  }
  if (back) {
    formData.append('back', back);
    formData.append('insurance_card_back', back);
  }
  if (sessionId) formData.append('sessionId', sessionId);
  if (paymentType) formData.append('paymentType', paymentType);

  const { data } = await getCcmsApi().post<PolicyExtractionPreview>(
    `/ccms/coverage-cases/${caseId}/policy-extraction/upload`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 0,
    },
  );
  return data;
}

export async function confirmPolicyExtraction(
  caseId: string,
  req: ConfirmPolicyExtractionRequest,
): Promise<ConfirmPolicyExtractionResponse> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/policy-extraction/confirm`,
    req,
  );
  return data;
}
