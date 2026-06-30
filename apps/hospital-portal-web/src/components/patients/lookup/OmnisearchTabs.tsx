'use client';

import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import {
  PATIENT_OMNI_SEARCH_SCOPES,
  type PatientOmniSearchScope,
} from '@/types/patient-omni-search';
import { cn } from '@/lib/utils';

export interface OmnisearchTabsProps {
  activeScope: PatientOmniSearchScope;
  onScopeChange: (scope: PatientOmniSearchScope) => void;
  className?: string;
}

export function OmnisearchTabs({
  activeScope,
  onScopeChange,
  className,
}: OmnisearchTabsProps) {
  return (
    <div
      className={cn(
        'flex gap-x-1 overflow-x-auto border-b border-gray-200 px-2',
        className,
      )}
      role="tablist"
      aria-label="Omnisearch categories"
      data-testid={patientLookupTestIds.omnisearchTabs}
    >
      {PATIENT_OMNI_SEARCH_SCOPES.map((tab) => {
        const active = tab.key === activeScope;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onScopeChange(tab.key)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-2.5 py-2 text-xs transition-colors sm:text-sm',
              active
                ? 'border-emerald-600 font-semibold text-emerald-800'
                : 'border-transparent font-medium text-gray-600 hover:border-emerald-200 hover:text-emerald-800',
            )}
            data-testid={patientLookupTestIds.omnisearchTab(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
