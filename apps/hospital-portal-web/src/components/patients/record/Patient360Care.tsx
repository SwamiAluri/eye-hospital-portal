'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  administrationEmptyMessage,
  administrationUnauthorizedMessage,
  administrationUnavailableMessage,
  loadPatient360Administration,
  type AdministrationListResult,
  type AdministrationSource,
  type Patient360AdministrationBundle,
} from '@/lib/patients/patient-360-administration';
import { buildCounsellorHandoffHref } from '@/lib/patients/patient-handoff';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { Patient360CommunicationPanel } from './Patient360Communication';
import { Patient360CounsellingSessionsView } from './Patient360CounsellingSessions';
import { Patient360Group } from './Patient360Group';
import {
  Patient360RecordTable,
  patient360Honesty,
  patient360LinkClass,
} from './Patient360RecordTable';
import {
  loadPatient360CounsellingSessions,
  type CounsellingSessionListResult,
} from '@/lib/patients/patient-360-counselling-sessions';
import { usePatientRecord } from './PatientRecordProvider';

function careHonesty(source: AdministrationSource, result: AdministrationListResult<unknown> | null | undefined) {
  return patient360Honesty(result, {
    empty: administrationEmptyMessage(source),
    unauthorized: administrationUnauthorizedMessage(source),
    unavailable: administrationUnavailableMessage(source),
    loading: 'Loading care history.',
  });
}

function splitWhen(value: string | null): { date: string; time: string } {
  if (!value) return { date: '—', time: '—' };
  const [date, time] = value.split(' ');
  return { date, time: time ?? '—' };
}

export function Patient360CareJourneys({
  bundle,
  counselling,
  patientId,
}: {
  bundle: Patient360AdministrationBundle | null;
  counselling: CounsellingSessionListResult | null;
  patientId: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Link href={buildCounsellorHandoffHref(patientId)} className={patient360LinkClass}>
          Open Counselling
        </Link>
        <Link href={`/dashboard/appointments/schedule?patientId=${patientId}`} className={patient360LinkClass}>
          Open Scheduling
        </Link>
      </div>
          <Patient360Group title="Visits & encounters">
            <Patient360RecordTable
              caption="Visits and encounters"
              columns={[
                { header: 'Date' },
                { header: 'Encounter' },
                { header: 'Type' },
                { header: 'Station' },
                { header: 'Provider' },
                { header: 'Status' },
                { header: 'Action' },
              ]}
              emptyState={careHonesty('visits', bundle?.visits)}
              rows={bundle?.visits.rows.map((row) => ({
                id: row.id ?? row.title,
                cells: [
                  row.when ?? row.checkInTime ?? '—',
                  row.title,
                  '—',
                  row.station ?? '—',
                  row.provider ?? '—',
                  row.status ?? '—',
                  row.encounterHref ? (
                    <Link href={row.encounterHref} className={patient360LinkClass}>
                      Open encounter
                    </Link>
                  ) : (
                    '—'
                  ),
                ],
              })) ?? []}
            />
          </Patient360Group>
          <Patient360Group title="Appointments">
            <Patient360RecordTable
              caption="Appointments"
              columns={[
                { header: 'Date' },
                { header: 'Time' },
                { header: 'Appointment' },
                { header: 'Provider' },
                { header: 'Location' },
                { header: 'Status' },
                { header: 'Action' },
              ]}
              emptyState={careHonesty('appointments', bundle?.appointments)}
              rows={bundle?.appointments.rows.map((row) => {
                const when = splitWhen(row.when);
                const longDetail = Boolean(row.detail && (row.detail.length > 60 || /override|emergency/i.test(row.detail)));
                return {
                  id: row.id,
                  cells: [
                    when.date,
                    when.time,
                    row.title,
                    row.provider ?? '—',
                    '—',
                    row.status ?? '—',
                    longDetail ? (
                      <Sheet>
                        <SheetTrigger className={patient360LinkClass}>Emergency override · View details</SheetTrigger>
                        <SheetContent>
                          <SheetHeader>
                            <SheetTitle>{row.title}</SheetTitle>
                          </SheetHeader>
                          <div className="mt-4 space-y-2 text-sm text-gray-700">
                            <p>Emergency override</p>
                            <p>{row.detail}</p>
                            {row.provider ? <p>{row.provider}</p> : null}
                            {row.status ? <p>{row.status}</p> : null}
                            {row.when ? <p>{row.when}</p> : null}
                          </div>
                        </SheetContent>
                      </Sheet>
                    ) : (
                      '—'
                    ),
                  ],
                };
              }) ?? []}
            />
          </Patient360Group>
      <Patient360CounsellingSessionsView result={counselling} />
    </div>
  );
}

export function Patient360CarePanel() {
  const { patientId } = usePatientRecord();
  const [bundle, setBundle] = useState<Patient360AdministrationBundle | null>(null);
  const [counselling, setCounselling] = useState<CounsellingSessionListResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBundle(null);
    setCounselling(null);
    void loadPatient360Administration(patientId).then((next) => {
      if (!cancelled) setBundle(next);
    });
    void loadPatient360CounsellingSessions(patientId).then((next) => {
      if (!cancelled) setCounselling(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <section
      id="patient-360-panel-care"
      role="tabpanel"
      aria-labelledby="patient-360-tab-care"
      className="p-4"
      data-testid={patientLookupTestIds.recordSectionPanel('care')}
    >
      <div className="mt-1">
        <Patient360CareJourneys bundle={bundle} counselling={counselling} patientId={patientId} />
      </div>
      <Patient360CommunicationPanel embedded />
    </section>
  );
}
