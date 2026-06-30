'use client';

import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import type { PatientLookupTab } from '@/types/patient-lookup';
import { cn } from '@/lib/utils';

const TABS: { key: PatientLookupTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'current', label: 'Current' },
  { key: 'new', label: 'New' },
  { key: 'discharged', label: 'Discharged' },
  { key: 'high_priority', label: 'High priority' },
];

export interface PatientHubClassificationTabsProps {
  activeTab: PatientLookupTab;
  tabCounts: Partial<Record<PatientLookupTab, number | undefined>>;
  onTabChange: (tab: PatientLookupTab) => void;
}

export function PatientHubClassificationTabs({
  activeTab,
  tabCounts,
  onTabChange,
}: PatientHubClassificationTabsProps) {
  return (
    <div
      className="flex flex-wrap gap-x-1 border-b border-gray-200"
      role="tablist"
      aria-label="Patient classification"
      data-testid={patientLookupTestIds.classificationTabs}
    >
      {TABS.map((t) => {
        const count = tabCounts[t.key];
        const active = activeTab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(t.key)}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
              active
                ? 'border-emerald-600 font-semibold text-emerald-800'
                : 'border-transparent font-medium text-gray-600 hover:border-emerald-200 hover:text-emerald-800',
            )}
            data-testid={patientLookupTestIds.tab(t.key)}
          >
            {t.label}
            {count != null && (
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-xs tabular-nums',
                  active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500',
                )}
              >
                {count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
