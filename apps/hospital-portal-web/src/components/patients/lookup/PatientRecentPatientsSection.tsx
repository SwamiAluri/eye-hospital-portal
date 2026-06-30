'use client';

import { PatientAvatar } from '@/components/patients/PatientAvatar';
import { usePatientRecentViewsQuery } from '@/hooks/use-patient-lookup-queries';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import type { PatientRecentViewEntry } from '@/types/patient-lookup';
import { cn } from '@/lib/utils';

export function PatientRecentPatientsSection({
  onSelect,
  variant = 'list',
}: {
  onSelect: (entry: PatientRecentViewEntry) => void;
  variant?: 'list' | 'prominent';
}) {
  const recentQuery = usePatientRecentViewsQuery();
  const entries = recentQuery.data ?? [];

  if (recentQuery.isLoading) {
    return (
      <section
        className={cn(
          variant === 'prominent'
            ? 'rounded-xl border border-gray-100 bg-gray-50/60 p-4'
            : 'border-t border-gray-100 pt-4',
        )}
      >
        <p className="mb-3 text-sm font-medium text-gray-700">Recent patients</p>
        <div
          className={cn(
            'animate-pulse rounded-lg bg-gray-100',
            variant === 'prominent' ? 'h-20' : 'h-16',
          )}
        />
      </section>
    );
  }

  if (entries.length === 0) return null;

  if (variant === 'prominent') {
    return (
      <section
        className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"
        data-testid={patientLookupTestIds.recentPatients}
      >
        <p className="mb-3 text-sm font-medium text-gray-700">Recent patients</p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {entries.map((entry) => (
            <button
              key={entry.patientId}
              type="button"
              onClick={() => onSelect(entry)}
              className="flex min-w-[4.5rem] max-w-[5.5rem] flex-col items-center gap-1.5 rounded-lg p-1.5 text-center transition-colors hover:bg-white"
            >
              <PatientAvatar
                size="md"
                firstName={entry.firstName}
                lastName={entry.lastName}
                photoUrl={entry.photoThumbnailUrl}
              />
              <span className="w-full truncate text-xs font-medium text-gray-900">
                {entry.firstName}
              </span>
              <span className="w-full truncate font-mono text-[10px] text-gray-500">
                {entry.mrn}
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className="border-t border-gray-100 pt-4"
      data-testid={patientLookupTestIds.recentPatients}
    >
      <p className="mb-2.5 text-sm font-medium text-gray-700">Recent patients</p>
      <ul className="space-y-1">
        {entries.map((entry) => (
          <li key={entry.patientId}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
            >
              <PatientAvatar
                size="sm"
                firstName={entry.firstName}
                lastName={entry.lastName}
                photoUrl={entry.photoThumbnailUrl}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900">
                  {entry.firstName} {entry.lastName}
                </span>
                <span className="block truncate font-mono text-xs text-gray-500">
                  {entry.mrn}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
