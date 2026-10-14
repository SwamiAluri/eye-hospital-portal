'use client';

import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { PatientLookupTab } from '@/types/patient-lookup';
import { cn } from '@/lib/utils';

/**
 * Primary census navigation (PD-DIR-UX-18–21).
 * UI "Active" maps to the existing certified `current` predicate/URL value.
 * New / discharged / high_priority remain parseable and counted server-side
 * but are not primary Directory tabs.
 */
const PRIMARY_CENSUS_TABS: { key: PatientLookupTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'current', label: 'Active' },
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
      className={cn(counsellingSessionTokens.pillTabTrack, 'max-w-full')}
      role="tablist"
      aria-label="Patient classification"
      data-testid={patientLookupTestIds.classificationTabs}
    >
      {PRIMARY_CENSUS_TABS.map((t) => {
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
              counsellingSessionTokens.pillTab,
              'shrink-0 whitespace-nowrap',
              active && counsellingSessionTokens.pillTabCurrent,
            )}
            data-testid={patientLookupTestIds.tab(t.key)}
          >
            <span>{t.label}</span>
            {count != null && (
              <span
                className={cn(
                  'tabular-nums',
                  active ? 'text-white/90' : 'text-counselling-muted-foreground',
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
