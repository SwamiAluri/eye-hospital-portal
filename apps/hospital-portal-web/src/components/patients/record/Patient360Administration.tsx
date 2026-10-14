'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  SURGERY_UNAVAILABLE,
  administrationEmptyMessage,
  administrationUnauthorizedMessage,
  administrationUnavailableMessage,
  loadPatient360Administration,
  type AdministrationListResult,
  type AdministrationSource,
  type Patient360AdministrationBundle,
} from '@/lib/patients/patient-360-administration';
import { Patient360ListPagination } from './Patient360ListPagination';
import {
  inpatientHistoryEmptyMessage,
  inpatientHistoryUnauthorizedMessage,
  inpatientHistoryUnavailableMessage,
  loadPatient360InpatientHistory,
  type InpatientHistoryListResult,
} from '@/lib/patients/patient-360-inpatient-history';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { usePatientRecord } from './PatientRecordProvider';
import type { PatientSummary } from '@/types/patient-lookup';

import {
  Patient360RecordTable,
  Patient360Section,
  formatPatient360Date,
  patient360Honesty,
  patient360LinkClass,
} from './Patient360RecordTable';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Patient360Section title={title}>{children}</Patient360Section>
  );
}

function adminHonesty(source: AdministrationSource, result: AdministrationListResult<unknown> | null | undefined) {
  return patient360Honesty(result, {
    empty: administrationEmptyMessage(source),
    unauthorized: administrationUnauthorizedMessage(source),
    unavailable: administrationUnavailableMessage(source),
    loading: 'Loading administration records.',
  });
}

function historyHonesty(result: InpatientHistoryListResult | null) {
  return patient360Honesty(result, {
    empty: inpatientHistoryEmptyMessage(),
    unauthorized: inpatientHistoryUnauthorizedMessage(),
    unavailable: inpatientHistoryUnavailableMessage(),
    loading: 'Loading inpatient history.',
  });
}

export function Patient360AdministrationView({
  bundle,
  history,
  onHistoryPageChange,
  summary = null,
}: {
  bundle: Patient360AdministrationBundle;
  history: InpatientHistoryListResult | null;
  onHistoryPageChange?: (page: number) => void;
  summary?: PatientSummary | null;
}) {
  const emergency = summary
    ? [summary.emergencyContactName, summary.emergencyContactRelationship, summary.emergencyContactPhone]
        .filter((part) => part?.trim())
        .join(' · ')
    : '';

  return (
    <>
      <div className="space-y-4">
        {summary ? (
          <Block title="Registration">
            <Patient360RecordTable
              caption="Registration"
              columns={[{ header: 'Field' }, { header: 'Value' }]}
              rows={[
                { id: 'dob', cells: ['Date of birth', formatPatient360Date(summary.dateOfBirth)] },
                ...(summary.gender ? [{ id: 'gender', cells: ['Gender', summary.gender] }] : []),
                ...(summary.bloodGroup ? [{ id: 'blood', cells: ['Blood group', summary.bloodGroup] }] : []),
                ...(summary.phone ? [{ id: 'phone', cells: ['Phone', summary.phone] }] : []),
                ...(summary.email ? [{ id: 'email', cells: ['Email', summary.email] }] : []),
                ...(emergency ? [{ id: 'emergency', cells: ['Emergency contact', emergency] }] : []),
              ]}
            />
          </Block>
        ) : null}
        <Block title="Check-in history">
          <Patient360RecordTable
            caption="Check-in history"
            columns={[
              { header: 'Date' },
              { header: 'Visit' },
              { header: 'Station' },
              { header: 'Status' },
              { header: 'Time' },
              { header: 'Action' },
            ]}
            emptyState={adminHonesty('visits', bundle.visits)}
            rows={bundle.visits.rows.map((row) => ({
              id: row.id ?? row.title,
              cells: [
                row.when ?? '—',
                row.title,
                row.station ?? '—',
                row.status ?? '—',
                row.checkInTime ?? '—',
                row.encounterHref ? (
                  <Link href={row.encounterHref} className={patient360LinkClass}>
                    Open encounter
                  </Link>
                ) : (
                  '—'
                ),
              ],
            }))}
          />
        </Block>

        <Block title="Consents">
          <Patient360RecordTable
            caption="Consents"
            columns={[
              { header: 'Consent' },
              { header: 'Version' },
              { header: 'Date' },
              { header: 'Status' },
              { header: 'Source' },
            ]}
            emptyState={adminHonesty('consents', bundle.consents)}
            rows={bundle.consents.rows.map((row) => ({
              id: row.id,
              cells: [row.title, '—', row.grantedAt ?? row.revokedAt ?? '—', row.status, 'Administration'],
            }))}
          />
        </Block>

        <Block title="Inpatient History">
          <Patient360RecordTable
            caption="Inpatient history"
            columns={[
              { header: 'Admission' },
              { header: 'Location' },
              { header: 'Discharge' },
              { header: 'Status' },
            ]}
            emptyState={historyHonesty(history)}
            rows={history?.rows.map((row) => ({
              id: row.id,
              cells: [row.admittedAt ?? '—', '—', row.dischargedAt ?? '—', row.clinicalState],
            })) ?? []}
          />
          {history && onHistoryPageChange ? (
            <Patient360ListPagination
              label="Inpatient history"
              currentPage={history.pageNumber}
              pageSize={history.pageSize}
              totalCount={history.totalCount}
              onPageChange={onHistoryPageChange}
            />
          ) : null}
        </Block>
        <Block title="Surgery / OT">
          <Patient360RecordTable
            caption="Surgery and OT"
            columns={[{ header: 'Date' }, { header: 'Result' }, { header: 'Source' }]}
            rows={[]}
            emptyState={SURGERY_UNAVAILABLE}
          />
        </Block>
      </div>
    </>
  );
}

export function Patient360AdministrationPanel() {
  const { patientId, summary } = usePatientRecord();
  const [bundle, setBundle] = useState<Patient360AdministrationBundle | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState<InpatientHistoryListResult | null>(null);

  useEffect(() => {
    setHistoryPage(1);
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    setBundle(null);
    void loadPatient360Administration(patientId).then((next) => {
      if (!cancelled) setBundle(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    void loadPatient360InpatientHistory(patientId, historyPage).then((next) => {
      if (!cancelled) setHistory(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, historyPage]);

  return (
    <section
      id="patient-360-panel-administration"
      role="tabpanel"
      aria-labelledby="patient-360-tab-administration"
      className="p-4"
      data-testid={patientLookupTestIds.recordSectionPanel('administration')}
    >
      {bundle ? (
        <Patient360AdministrationView
          bundle={bundle}
          history={history}
          onHistoryPageChange={setHistoryPage}
          summary={summary}
        />
      ) : (
        <p role="status" className="text-sm text-gray-600">
          Loading administration records.
        </p>
      )}
    </section>
  );
}
