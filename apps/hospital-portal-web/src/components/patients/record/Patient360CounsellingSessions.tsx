'use client';

import { useEffect, useState } from 'react';
import {
  counsellingSessionEmptyMessage,
  counsellingSessionUnauthorizedMessage,
  counsellingSessionUnavailableMessage,
  loadPatient360CounsellingSessions,
  type CounsellingSessionListResult,
} from '@/lib/patients/patient-360-counselling-sessions';
import { usePatientRecord } from './PatientRecordProvider';
import { Patient360RecordTable, patient360Honesty } from './Patient360RecordTable';

export function Patient360CounsellingSessionsView({
  result,
}: {
  result: CounsellingSessionListResult | null;
}) {
  return (
    <section className="min-w-0">
      <h3 className="text-sm font-semibold text-gray-900">Counselling sessions</h3>
      <p className="sr-only">Source: Counselling Sessions</p>
      <p className="sr-only">Counselling sessions linked to this patient. This is not the complete care history.</p>
      <div className="mt-1.5 space-y-1.5 text-sm text-gray-700">
        <Patient360RecordTable
          caption="Counselling sessions"
          columns={[
            { header: 'Date' },
            { header: 'Session' },
            { header: 'Status' },
            { header: 'Context' },
            { header: 'Action', srOnly: true },
          ]}
          emptyState={patient360Honesty(result, {
            empty: counsellingSessionEmptyMessage(),
            unauthorized: counsellingSessionUnauthorizedMessage(),
            unavailable: counsellingSessionUnavailableMessage(),
            loading: 'Loading counselling sessions.',
          })}
          rows={
            result?.state === 'ready'
              ? result.rows.map((row) => ({
                  id: row.id,
                  cells: [
                    [row.sessionDate, row.sessionTime].filter(Boolean).join(' · ') || '—',
                    [row.sessionNumber, row.sessionType].filter(Boolean).join(' · ') || 'Session',
                    row.status ?? '—',
                    row.counsellorName ? `Counsellor: ${row.counsellorName}` : '—',
                    '—',
                  ],
                }))
              : []
          }
        />
      </div>
    </section>
  );
}

export function Patient360CounsellingSessionsPanel() {
  const { patientId } = usePatientRecord();
  const [result, setResult] = useState<CounsellingSessionListResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void loadPatient360CounsellingSessions(patientId).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <div className="px-4 pb-4">
      <Patient360CounsellingSessionsView result={result} />
    </div>
  );
}
