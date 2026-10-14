import {
  ensureCcmsDocumentCanonical,
  fetchCaseDocumentBlob,
  getDocumentsByPatient,
  type CcmsDocumentPatientMetadata,
} from '@/lib/api/ccms/ccms-documents.api';
import {
  INTAKE_DOC_SLOTS,
  CLAIMS_DOC_SLOTS,
} from '@/lib/ccms/ccms-document-slots';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';
import {
  classifyDocumentError,
  type DocumentListResult,
  type DocumentRow,
  mapDocument,
} from '@/lib/patients/patient-360-documents';

const INSURANCE_INTAKE_TYPES = new Set(
  [...INTAKE_DOC_SLOTS, ...CLAIMS_DOC_SLOTS]
    .map((slot) => slot.key.toLowerCase())
    .filter((key) => key !== 'biometry_record'),
);

export function insuranceDocumentEmptyMessage(): string {
  return 'No insurance documents recorded.';
}

export function insuranceDocumentUnauthorizedMessage(): string {
  return 'Insurance documents are not available to this sign-in.';
}

export function insuranceDocumentUnavailableMessage(): string {
  return 'Insurance document information is unavailable.';
}

/** File-backed CCMS Insurance/intake (+ claims) types — excludes pointers. */
export function isPatient360InsuranceDocument(
  row: Pick<DocumentRow, 'documentType' | 'status' | 'isPointer'>,
): boolean {
  const type = row.documentType?.trim().toLowerCase() ?? '';
  if (!type || !INSURANCE_INTAKE_TYPES.has(type)) return false;
  if (row.isPointer) return false;
  if (row.status && row.status.trim().toLowerCase() !== 'active') return false;
  return true;
}

export function mapInsuranceDocument(raw: Record<string, unknown>): DocumentRow | null {
  return mapDocument(raw);
}

/**
 * Loads eligible Insurance/intake CCMS documents for Patient 360.
 * Lazy-ensures canonical association only for page rows missing it (bounded by page size).
 */
export async function loadPatient360InsuranceDocuments(
  patientId: string,
  pageNumber = 1,
): Promise<DocumentListResult> {
  try {
    const response = await getDocumentsByPatient(patientId, pageNumber, PATIENT_360_LIST_PAGE_SIZE, {
      insuranceOnly: true,
    });
    const list = Array.isArray(response.documents) ? response.documents : [];
    const rows: DocumentRow[] = [];

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const mapped = mapDocument(item as unknown as Record<string, unknown>);
      if (!mapped || !isPatient360InsuranceDocument(mapped)) continue;

      let canonicalDocumentId = mapped.canonicalDocumentId;
      if (!canonicalDocumentId) {
        try {
          const ensured = await ensureCcmsDocumentCanonical(mapped.id);
          canonicalDocumentId = ensured.canonicalDocumentId;
        } catch {
          // Metadata remains usable; All-tab dedupe improves once ensure succeeds.
        }
      }

      rows.push({ ...mapped, canonicalDocumentId });
    }

    return {
      state: 'ready',
      rows,
      ...patient360PageFields(response, pageNumber),
    };
  } catch (error) {
    return { state: classifyDocumentError(error), rows: [] };
  }
}

export async function downloadPatient360CcmsDocument(
  coverageCaseId: string,
  documentId: string,
  hint?: { mimeType?: string | null; fileName?: string | null },
): Promise<Blob> {
  return fetchCaseDocumentBlob(coverageCaseId, documentId, hint);
}

export type { CcmsDocumentPatientMetadata };
