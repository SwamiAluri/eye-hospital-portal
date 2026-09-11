'use client';

import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';
import { WAITING_LIST_STATUS_TABS } from '@/components/counsellors-desk/waiting-list/WaitingListFilterToolbar';

export type WaitingListSummaryWidgetProps = {
  activeTab: string;
  onTabChange: (key: string) => void;
  tabCounts: Record<string, number>;
  statusTabs?: ReadonlyArray<{ key: string; label: string }>;
  className?: string;
  'data-testid'?: string;
};

/** Workload metrics only — values come from existing tabCounts (no new calculations). */
const WORKLOAD_STATS = [
  { key: 'All', label: 'Patients', testId: 'waiting-list-stat-patients' },
  { key: 'Pending', label: 'Pending', testId: 'waiting-list-stat-pending' },
  { key: 'Processed', label: 'Processing', testId: 'waiting-list-stat-processing' },
  { key: 'Done', label: 'Done', testId: 'waiting-list-stat-done' },
  {
    key: 'RepeatCounselling',
    label: 'Repeat Counselling',
    testId: 'waiting-list-stat-repeat-counselling',
  },
] as const;

/**
 * Stats widget (informational) + Surgery Finalization–style pill status tabs.
 */
export function WaitingListSummaryWidget({
  activeTab,
  onTabChange,
  tabCounts,
  statusTabs = WAITING_LIST_STATUS_TABS,
  className,
  'data-testid': testId = 'waiting-list-summary',
}: WaitingListSummaryWidgetProps) {
  return (
    <div
      data-testid={testId}
      className={cn('flex w-full min-w-0 shrink-0 flex-col gap-0.5 min-[1600px]:gap-2.5', className)}
    >
      <div
        className={cn(
          counsellingSessionTokens.sessionStatusStrip,
          'shrink-0',
        )}
        data-testid="waiting-list-stats"
        aria-label="Queue statistics"
      >
        <dl
          className={cn(
            counsellingSessionTokens.sessionStatusDetails,
          'grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3 lg:grid-cols-5 min-[1600px]:gap-x-4 min-[1600px]:gap-y-2',
          )}
        >
          {WORKLOAD_STATS.map(({ key, label, testId: statTestId }) => (
            <div key={key} className="min-w-0" data-testid={statTestId}>
              <dd className="text-base font-semibold leading-5 tabular-nums text-counselling-foreground min-[1600px]:text-lg min-[1600px]:leading-6 sm:min-[1600px]:text-xl">
                {tabCounts[key] ?? 0}
              </dd>
              <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>{label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <div
        data-testid="waiting-list-summary-strip"
        data-status-style="pill-tab"
        role="tablist"
        aria-label="Queue status"
        className="w-full min-w-0 shrink-0"
      >
        <div
          className={cn(
            counsellingSessionTokens.pillTabTrack,
            'flex-nowrap gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] min-[1600px]:gap-1.5',
          )}
        >
          {statusTabs.map(({ key, label }) => {
            const count = tabCounts[key] ?? 0;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(key)}
                className={cn(
                  counsellingSessionTokens.pillTab,
                  'shrink-0 whitespace-nowrap',
                  isActive && counsellingSessionTokens.pillTabCurrent,
                )}
                data-testid={`waiting-list-status-tab-${key}`}
              >
                <span>{label}</span>
                <span
                  className={cn(
                    'tabular-nums',
                    isActive ? 'text-white/90' : 'text-counselling-muted-foreground',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
