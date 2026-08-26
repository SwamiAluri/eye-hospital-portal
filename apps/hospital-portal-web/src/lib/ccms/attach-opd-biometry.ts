/**
 * Latest OPD biometry per eye for CCMS attach.
 * Auth biometry_records remain the measurement SoT; CCMS stores a pointer only.
 */

export const BIOMETRY_DOCUMENT_TYPE = 'biometry_record';

export function biometryPointerUrl(recordId: string): string {
  return `biometry://record/${recordId}`;
}

export interface BiometryAttachSource {
  id: string;
  eye?: string | null;
  examinationDate?: string | null;
  createdAt?: string | null;
  calculatedIOL?: number | null;
  calculatedIol?: number | null;
  device?: string | null;
}

function stamp(row: BiometryAttachSource): number {
  const raw = row.examinationDate || row.createdAt || '';
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

/** One row per OD/OS (latest exam). Empty eye keys as OTHER. */
export function latestBiometryPerEye(rows: BiometryAttachSource[]): BiometryAttachSource[] {
  const byEye = new Map<string, BiometryAttachSource>();
  for (const row of rows) {
    if (!row?.id) continue;
    const eye = (row.eye ?? 'OTHER').trim().toUpperCase() || 'OTHER';
    const prev = byEye.get(eye);
    if (!prev || stamp(row) >= stamp(prev)) byEye.set(eye, row);
  }
  return [...byEye.values()];
}
