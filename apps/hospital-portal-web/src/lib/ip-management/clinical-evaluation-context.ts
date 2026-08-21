import { getApi } from '@/lib/api';
import type { CounsellingPackageAddonsBlob } from '@/types/counselling-estimate';
import type { OutpatientDiagnosisSource } from '@/lib/ip-management/clinical-evaluation';
import { resolveCounsellingIolId } from '@/lib/ip-management/clinical-evaluation-prefill';

export interface CounsellingClinicalContext {
  patientId: string | null;
  patientAge: number | null;
  patientGender: string | null;
  counsellorNotes: string | null;
  variantId: string | null;
  packageTemplateId: string | null;
  selectedIolId: string | null;
  packageName: string | null;
  outpatientDiagnosis: OutpatientDiagnosisSource | null;
}

export async function fetchCounsellingClinicalContext(
  sessionId: string,
  journeyDiagnosis?: string | null,
): Promise<CounsellingClinicalContext | null> {
  try {
    const response = await getApi().get(`/Counseling/sessions/${sessionId}`);
    const raw = response.data as Record<string, unknown>;
    let cd: CounsellingPackageAddonsBlob & { selectedIolId?: string; diagnosisCode?: string } = {};
    if (raw.packageAddonsJson) {
      try {
        cd = JSON.parse(String(raw.packageAddonsJson)) as typeof cd;
      } catch {
        cd = {};
      }
    }

    const recommended = raw.recommendedSurgery ? String(raw.recommendedSurgery) : null;
    const diagnosisCode = cd.diagnosisCode?.trim() || null;
    const resolvedIolId = await resolveCounsellingIolId(
      cd.selectedIolId ?? null,
      cd.packageTemplateId ?? null,
    );

    return {
      patientId: raw.patientId ? String(raw.patientId) : null,
      patientAge: typeof raw.patientAge === 'number' ? raw.patientAge : null,
      patientGender: raw.patientGender ? String(raw.patientGender) : null,
      counsellorNotes: raw.additionalNotes ? String(raw.additionalNotes).trim() || null : null,
      variantId: cd.variantId ?? null,
      packageTemplateId: cd.packageTemplateId ?? null,
      selectedIolId: resolvedIolId,
      packageName: cd.packageName ?? (raw.packageName ? String(raw.packageName) : null),
      outpatientDiagnosis: journeyDiagnosis?.trim()
        ? { description: journeyDiagnosis.trim(), icd10: diagnosisCode ?? undefined }
        : recommended
          ? { description: recommended, icd10: diagnosisCode ?? undefined }
          : diagnosisCode
            ? { description: diagnosisCode, icd10: diagnosisCode }
            : null,
    };
  } catch {
    return null;
  }
}
