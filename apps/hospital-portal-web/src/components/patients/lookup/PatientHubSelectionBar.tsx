'use client';

import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';

export function PatientHubSelectionBar({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) {
  if (count === 0) return null;

  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2"
      data-testid={patientLookupTestIds.selectionBar}
    >
      <p className="text-sm font-medium text-emerald-900">
        {count} patient{count === 1 ? '' : 's'} selected
      </p>
      <button
        type="button"
        onClick={onClear}
        className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
        data-testid={patientLookupTestIds.selectionClear}
      >
        Clear selection
      </button>
    </div>
  );
}
