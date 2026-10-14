'use client';

import { useEffect, useState } from 'react';
import {
  communicationEmptyMessage,
  communicationUnauthorizedMessage,
  communicationUnavailableMessage,
  loadPatient360Communications,
  type CommunicationListResult,
} from '@/lib/patients/patient-360-communication';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { usePatientRecord } from './PatientRecordProvider';
import { Patient360DetailSheet, Patient360RecordTable, Patient360Section, patient360Honesty } from './Patient360RecordTable';

export function Patient360CommunicationView({
  result,
}: {
  result: CommunicationListResult;
}) {
  return (
    <Patient360Section title="Communication">
      <Patient360RecordTable
        caption="Communication"
        columns={[
          { header: 'Date' },
          { header: 'Channel' },
          { header: 'Direction' },
          { header: 'Subject / Summary' },
          { header: 'Status' },
          { header: 'Action' },
        ]}
        emptyState={patient360Honesty(result, {
          empty: communicationEmptyMessage(),
          unauthorized: communicationUnauthorizedMessage(),
          unavailable: communicationUnavailableMessage(),
          loading: 'Loading communications.',
        })}
        rows={result.rows.map((row) => {
          const previewTruncated = !!row.message && !!row.preview && row.message.length > row.preview.length;
          return {
            id: row.id,
            cells: [
              row.when ?? '—',
              row.channel,
              row.direction ?? '—',
              [row.subject, row.preview].filter(Boolean).join(' · ') || '—',
              row.status ?? '—',
              previewTruncated && row.message ? (
                <Patient360DetailSheet trigger="View communication" title={row.subject ?? row.channel}>
                  <p>Direction: {row.direction}</p>
                  <p>{row.message}</p>
                </Patient360DetailSheet>
              ) : (
                '—'
              ),
            ],
          };
        })}
      />
    </Patient360Section>
  );
}

export function Patient360CommunicationPanel({ embedded = false }: { embedded?: boolean }) {
  const { patientId } = usePatientRecord();
  const [result, setResult] = useState<CommunicationListResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void loadPatient360Communications(patientId).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const body = result ? (
    <Patient360CommunicationView result={result} />
  ) : (
    <p role="status" className="text-sm text-gray-600">
      Loading communications.
    </p>
  );

  if (embedded) return <div>{body}</div>;

  return (
    <section
      id="patient-360-panel-care"
      role="tabpanel"
      aria-labelledby="patient-360-tab-care"
      className="p-4"
      data-testid={patientLookupTestIds.recordSectionPanel('care')}
    >
      {body}
    </section>
  );
}
