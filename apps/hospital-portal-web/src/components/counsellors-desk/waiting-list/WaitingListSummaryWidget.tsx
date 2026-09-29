'use client';

import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';
import { WAITING_LIST_STATUS_TABS } from '@/components/counsellors-desk/waiting-list/WaitingListFilterToolbar';

export type WaitingListSummaryWidgetProps = {
  activeTab: string;
  onTabChange: (key: string) => void;
  tabCounts: Record<string, number>;
  /** Primary waiting-list request has no resolved counts yet. */
  countsPending?: boolean;
  /** Keys whose count is still pending (for example OT Returned after that tab is opened). */
  pendingCountKeys?: readonly string[];
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
 * Five separate statistic cards (label above the number) + status pill tabs.
 * Values come from existing tabCounts — no new KPI calculations.
 */
export function WaitingListSummaryWidget({
  activeTab,
  onTabChange,
  tabCounts,
  countsPending = false,
  pendingCountKeys,
  statusTabs = WAITING_LIST_STATUS_TABS,
  className,
  'data-testid': testId = 'waiting-list-summary',
}: WaitingListSummaryWidgetProps) {
  const countText = (key: string) =>
    countsPending || pendingCountKeys?.includes(key) ? '—' : String(tabCounts[key] ?? 0);

  return (
    <div
      data-testid={testId}
      className={cn('flex w-full min-w-0 shrink-0 flex-col gap-2.5', className)}
    >
      <div
        className="grid w-full min-w-0 shrink-0 grid-cols-5 gap-2"
        data-testid="waiting-list-stats"
        aria-label="Queue statistics"
      >
        {WORKLOAD_STATS.map(({ key, label, testId: statTestId }) => (
          <div
            key={key}
            className="min-w-0 rounded-lg border border-counselling-border/70 border-l-[3px] border-l-counselling-primary bg-counselling-card px-3 py-2.5 shadow-sm"
            data-testid={statTestId}
          >
            <p className="truncate text-sm font-medium leading-5 text-counselling-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums leading-7 text-counselling-foreground">
              {countText(key)}
            </p>
          </div>
        ))}
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
            'flex-nowrap gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]',
          )}
        >
          {statusTabs.map(({ key, label }) => {
            const count = countText(key);
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
                  'shrink-0 whitespace-nowrap px-4',
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
