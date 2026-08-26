import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';

const LEFT_HOSPITAL = new Set(['Discharged', 'CancelledSurgery', 'AdmissionCancelled']);

export const CENSUS_PAGE_SIZE = 25;

export function isCensusInHouse(clinicalState: string): boolean {
  return !LEFT_HOSPITAL.has(clinicalState);
}

/** Local calendar day as yyyy-mm-dd (not UTC, so IST “today” is correct). */
export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function admittedDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return localDateKey(d);
}

/**
 * From/To default to today. Anyone still in-house stays visible even if they
 * were admitted earlier. Left-hospital rows must have been admitted in range.
 */
export function matchesAdmittedCensusFilter(
  j: Pick<PatientJourneyRowDto, 'clinicalState' | 'admittedAt'>,
  fromDate: string,
  toDate: string,
): boolean {
  if (!fromDate && !toDate) return true;
  if (isCensusInHouse(j.clinicalState)) return true;
  const day = admittedDayKey(j.admittedAt);
  if (!day) return false;
  if (fromDate && day < fromDate) return false;
  if (toDate && day > toDate) return false;
  return true;
}

export function matchesCensusSearch(
  j: Pick<PatientJourneyRowDto, 'uhid' | 'patientName' | 'procedureName' | 'wardName' | 'bedNumber'>,
  uhid: string,
  search: string,
): boolean {
  const needleUhid = uhid.trim().toLowerCase();
  if (needleUhid && !(j.uhid ?? '').toLowerCase().includes(needleUhid)) return false;
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const hay = [j.patientName, j.uhid, j.procedureName, j.wardName, j.bedNumber]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}
