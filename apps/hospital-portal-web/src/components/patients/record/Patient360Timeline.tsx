'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import {
  loadPatient360Timeline,
  timelineEmptyMessage,
  timelineUnavailableMessage,
  type Patient360TimelineEvent,
  type Patient360TimelineResult,
} from '@/lib/patients/patient-360-timeline';
import { usePatientRecord } from './PatientRecordProvider';
import {
  Patient360DetailSheet,
  Patient360RecordTable,
  formatPatient360Date,
  patient360LinkClass,
  truncatePatient360Text,
} from './Patient360RecordTable';

function contextNeedsSheet(row: Patient360TimelineEvent): boolean {
  const text = [row.description, row.actor].filter(Boolean).join(' · ');
  return text.length > 60 || /override|emergency/i.test(text);
}

export function Patient360TimelineView({ result }: { result: Patient360TimelineResult | null }) {
  return (
    <Patient360RecordTable
      caption="Timeline"
      columns={[
        { header: 'Date' },
        { header: 'Event' },
        { header: 'Source' },
        { header: 'Context' },
        { header: 'Action' },
      ]}
      emptyState={
        !result
          ? 'Loading timeline.'
          : result.state === 'unavailable'
            ? timelineUnavailableMessage()
            : timelineEmptyMessage()
      }
      rows={result?.events.map((row) => {
        const context = [row.description, row.actor].filter(Boolean).join(' · ');
        const long = contextNeedsSheet(row);
        return {
          id: row.id,
          cells: [
            formatPatient360Date(row.at),
            row.type,
            row.source,
            long ? truncatePatient360Text(context, 48) : context || '—',
            long ? (
              <Patient360DetailSheet trigger="View details" title={row.type}>
                <p>{row.description}</p>
                {row.actor ? <p>{row.actor}</p> : null}
                <p>{row.source}</p>
                {row.at ? <p>{formatPatient360Date(row.at)}</p> : null}
                {row.href ? (
                  <Link href={row.href} className={patient360LinkClass}>
                    Open related record
                  </Link>
                ) : null}
              </Patient360DetailSheet>
            ) : row.href ? (
              <Link href={row.href} className={patient360LinkClass}>
                Open related record
              </Link>
            ) : (
              '—'
            ),
          ],
        };
      }) ?? []}
    />
  );
}

export function Patient360TimelinePanel() {
  const { patientId } = usePatientRecord();
  const [result, setResult] = useState<Patient360TimelineResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void loadPatient360Timeline(patientId).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <section
      id="patient-360-panel-timeline"
      role="tabpanel"
      aria-labelledby="patient-360-tab-timeline"
      className="p-4"
      data-testid={patientLookupTestIds.recordSectionPanel('timeline')}
    >
      <Patient360TimelineView result={result} />
    </section>
  );
}
