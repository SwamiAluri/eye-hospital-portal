'use client';

/**
 * Always-visible Gen-1 Directory filters: Gender + DOB From/To.
 * Immediate apply via existing URL state — no Filters/Apply/Clear/Sheet.
 */

import { PatientDirectoryDobField } from '@/components/patients/lookup/PatientDirectoryDobField';
import type { PatientLookupUrlState } from '@/lib/patients/patient-lookup-filters';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';

const selectClass =
  'h-9 w-[8.5rem] shrink-0 rounded-lg border border-counselling-border bg-counselling-card px-2 text-sm text-counselling-foreground focus-visible:border-counselling-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/25';

export function PatientDirectoryToolbarFilters({
  state,
  onApply,
}: {
  state: PatientLookupUrlState;
  onApply: (next: PatientLookupUrlState) => void;
}) {
  const patch = (partial: Partial<PatientLookupUrlState>) => {
    onApply({ ...state, ...partial, page: 1 });
  };

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2"
      data-testid={patientLookupTestIds.filterInline}
      data-filter-surface="directory-gen1"
      role="group"
      aria-label="Directory filters"
    >
      <div className="shrink-0">
        <label htmlFor="patient-hub-filter-gender" className="sr-only">
          Gender
        </label>
        <select
          id="patient-hub-filter-gender"
          className={selectClass}
          value={state.gender ?? ''}
          aria-label="Gender"
          data-testid={patientLookupTestIds.filterGender}
          onChange={(event) => {
            const gender = event.target.value || undefined;
            patch({ gender });
          }}
        >
          <option value="">All genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>

      <PatientDirectoryDobField
        id="patient-hub-filter-dob-from"
        label="DOB From"
        prefix="DOB From:"
        value={state.dobFrom}
        data-testid={patientLookupTestIds.filterDobFrom}
        onCommit={(dobFrom) => patch({ dobFrom })}
      />
      <PatientDirectoryDobField
        id="patient-hub-filter-dob-to"
        label="DOB To"
        prefix="To:"
        value={state.dobTo}
        data-testid={patientLookupTestIds.filterDobTo}
        onCommit={(dobTo) => patch({ dobTo })}
      />
    </div>
  );
}
