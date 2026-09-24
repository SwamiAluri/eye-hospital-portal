import type { WaitingListPatient } from '@/types/counsellors-desk';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import type { OtReturnedProjectedRow } from './ot-returned-membership';

function formatSurgeryVisitSecondary(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Map OT Returned journey projection → WaitingListPatient for WaitingListWorkRow.
 * Does not invent owner/payment — only copies authoritative fields when present.
 */
export function toOtReturnedWaitingListPatient(
  row: OtReturnedProjectedRow<PatientJourneyRowDto>,
  index: number,
): WaitingListPatient & {
  otReturnReason: string;
  journeyId: string;
  needsSessionCreate: boolean;
} {
  const surgeryDate = formatSurgeryVisitSecondary(row.surgeryScheduledAt);
  return {
    id: row.counselingSessionId?.trim() || row.id,
    slNo: index + 1,
    uhid: row.uhid?.trim() || '',
    patientName: row.patientName?.trim() || '—',
    eye: row.eyeOperated?.trim() || '',
    type: 'Surgery',
    surgeryName: row.procedureName?.trim() || '—',
    patientType: row.patientType?.trim() || '',
    age: row.patientAge ?? 0,
    gender: row.patientGender?.trim() || '',
    doctor: row.surgeonName?.trim() || '',
    time: surgeryDate,
    remarks: row.otReturnReason?.trim() || '',
    status: row.lifecycleStatus ?? 'Pending',
    counselorId: row.counselorId,
    counselorName: row.counselorName,
    version: row.sessionVersion ?? undefined,
    branchId: undefined,
    otReturnReason: row.otReturnReason?.trim() || '',
    journeyId: row.id,
    needsSessionCreate: row.needsSessionCreate,
  };
}
