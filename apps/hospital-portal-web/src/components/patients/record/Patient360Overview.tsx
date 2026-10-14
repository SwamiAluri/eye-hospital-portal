'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Patient360RecordTable } from './Patient360RecordTable';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import {
  buildPatient360Overview,
  classifyRecentActivityFailure,
  recentActivityMessage,
} from '@/lib/patients/patient-360-overview';
import type { PatientRecentVisit, PatientSummary } from '@/types/patient-lookup';
import { usePatientRecord } from './PatientRecordProvider';

const linkClass =
  'inline-flex text-sm font-medium text-emerald-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 rounded-sm';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-2 text-sm text-gray-700">{children}</div>
    </section>
  );
}

export function Patient360Overview({
  summary,
  recentVisits,
  visitsLoading = false,
  visitsFailed = false,
  visitsError = null,
}: {
  summary: PatientSummary;
  recentVisits: PatientRecentVisit[];
  visitsLoading?: boolean;
  visitsFailed?: boolean;
  visitsError?: unknown;
}) {
  const model = buildPatient360Overview(summary, recentVisits);

  return (
    <>
      <div className="space-y-5">
        {model.showNow ? (
          <Group title="Now">
            <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-2 gap-y-1">
              {model.now.scheduledAt ? (
                <div className="contents">
                  <dt className="text-gray-500">Scheduled</dt>
                  <dd className="text-gray-900">{model.now.scheduledAt}</dd>
                </div>
              ) : null}
              {model.now.programs.length > 0 ? (
                <div className="contents">
                  <dt className="text-gray-500">Care programs</dt>
                  <dd className="text-gray-900">{model.now.programs.join(', ')}</dd>
                </div>
              ) : null}
            </dl>
          </Group>
        ) : null}

        <Group title="Clinical flags">
          {model.clinical.opdVitals.length > 0 && model.clinical.opdStale ? (
            <p className="text-xs text-gray-500">OPD vital signs, stale</p>
          ) : null}
          <Patient360RecordTable
            caption="Clinical flags"
            columns={[{ header: 'Measure' }, { header: 'Latest' }, { header: 'Recorded' }]}
            emptyState="No clinical flags recorded."
            rows={[
              ...[...model.clinical.opdVitals, ...model.clinical.draftExam].map((row) => ({
                id: row.label,
                cells: [row.label, row.value, '—'],
              })),
              ...(model.clinical.registrationAllergyText
                ? [{ id: 'reg-allergy', cells: ['Registration allergy text', model.clinical.registrationAllergyText, '—'] }]
                : []),
            ]}
          />
        </Group>

        <Group title="Recent activity">
          <Patient360RecordTable
            caption="Recent visits"
            columns={[
              { header: 'Date' },
              { header: 'Visit' },
              { header: 'Station / reason' },
              { header: 'Status' },
              { header: 'Action', srOnly: true },
            ]}
            emptyState={
              visitsLoading
                ? 'Loading visits.'
                : visitsFailed
                  ? recentActivityMessage(classifyRecentActivityFailure(visitsError))
                  : recentActivityMessage('empty')
            }
            rows={model.recentActivity.map((row) => ({
              id: row.id,
              cells: [
                row.date ?? '—',
                row.visit,
                row.stationReason ?? '—',
                row.status,
                row.encounterHref ? (
                  <Link href={row.encounterHref} className={linkClass}>
                    Open encounter
                  </Link>
                ) : (
                  '—'
                ),
              ],
            }))}
          />
          {!visitsLoading && !visitsFailed && !model.recentActivityEmpty ? (
            <p className="mt-2">
              <Link href="?section=care" className={linkClass}>
                Full journey in Care
              </Link>
            </p>
          ) : null}
        </Group>
      </div>
    </>
  );
}

export function Patient360OverviewPanel() {
  const { summary, recentVisits, recentVisitsQuery } = usePatientRecord();
  if (!summary) return null;

  return (
    <section
      id="patient-360-panel-overview"
      role="tabpanel"
      aria-labelledby="patient-360-tab-overview"
      className="p-4"
      data-testid={patientLookupTestIds.recordSectionPanel('overview')}
    >
      <Patient360Overview
        summary={summary}
        recentVisits={recentVisits ?? []}
        visitsLoading={recentVisitsQuery.isLoading && !recentVisits}
        visitsFailed={recentVisitsQuery.isError}
        visitsError={recentVisitsQuery.error}
      />
    </section>
  );
}
