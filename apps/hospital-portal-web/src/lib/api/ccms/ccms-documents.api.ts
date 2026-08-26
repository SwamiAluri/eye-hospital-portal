// CCMS – Case Documents API client (upload/list/delete files linked to a coverage case)
import { getCcmsApi } from './ccms-base';

export interface CaseDocument {
  id: string;
  caseId: string;
  documentType: string;
  fileName: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy?: string;
  uploadedAt: string;
  isActive: boolean;
}

export type CounsellorDocumentType =
  | 'id_proof'
  | 'insurance_card_front'
  | 'insurance_card_back'
  | 'policy_document'
  | 'doctor_referral'
  | 'preauth_form'
  | 'previous_claims'
  | 'other_1'
  | 'other_2';

export async function listCaseDocuments(caseId: string): Promise<CaseDocument[]> {
  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/documents`);
  return Array.isArray(data) ? data : [];
}

export async function uploadCaseDocument(
  caseId: string,
  file: File,
  documentType: CounsellorDocumentType | string
): Promise<CaseDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/documents`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data;
}

export async function deleteCaseDocument(_caseId: string, docId: string): Promise<void> {
  await getCcmsApi().delete(`/ccms/documents/${docId}`);
}

export interface AttachBiometryRecordBody {
  biometryRecordId: string;
  eye?: string | null;
  examinationDate?: string | null;
  calculatedIol?: number | null;
  device?: string | null;
}

export async function attachBiometryRecord(
  caseId: string,
  body: AttachBiometryRecordBody,
): Promise<CaseDocument> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/documents/biometry`,
    body,
  );
  return data;
}
