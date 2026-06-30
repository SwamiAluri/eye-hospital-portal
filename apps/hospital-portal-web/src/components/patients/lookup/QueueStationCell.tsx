'use client';

import type { PatientLookupRow } from '@/types/patient-lookup';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';

export function QueueStationCell({ row }: { row: PatientLookupRow }) {
  const isIp = row.ipAdmission?.isAdmitted;
  const ward = row.ipAdmission?.wardName ?? row.currentStation;

  if (isIp && ward) {
    return (
      <div
        className="text-xs text-gray-800"
        data-testid={patientLookupTestIds.queueCell(row.id)}
      >
        <span className="font-medium capitalize">{ward}</span>
        <span className="text-gray-500"> · IP</span>
      </div>
    );
  }

  const wait =
    row.waitingMinutes != null && row.waitingMinutes > 0
      ? `${row.waitingMinutes} min`
      : null;
  const station = row.currentStation;
  const room = row.roomNumber;

  if (!wait && !station && !room) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  const parts: string[] = [];
  if (wait) parts.push(wait);
  if (station) parts.push(station);
  if (room) parts.push(`Rm ${room}`);

  return (
    <div
      className="text-xs text-gray-800"
      data-testid={patientLookupTestIds.queueCell(row.id)}
    >
      <span className="capitalize">{parts.join(' · ')}</span>
    </div>
  );
}
