'use client';

import { Calendar, Plus, RotateCcw } from 'lucide-react';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { CounsellingInput } from '@/components/counsellors-desk/session/primitives/CounsellingInput';
import { CounsellingSearchInput } from '@/components/counsellors-desk/session/primitives/CounsellingSearchInput';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { WaitingListFilters } from '@/types/counsellors-desk';
import { cn } from '@/lib/utils';

/** Status tab keys unchanged; Processed displays as Processing. Used by Queue summary. */
export const WAITING_LIST_STATUS_TABS = [
  { key: 'All', label: 'All' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Processed', label: 'Processing' },
  { key: 'Done', label: 'Done' },
  { key: 'AddOnSurgery', label: 'Add-on Surgery' },
  { key: 'RepeatCounselling', label: 'Repeat Counselling' },
  { key: 'SurgeryDone', label: 'Surgery Done' },
  { key: 'OtReturned', label: 'OT Returned' },
  { key: 'PreAuthQueue', label: 'Pre-Auth Queue' },
] as const;

export const WAITING_LIST_TYPE_OPTIONS = ['All', 'Procedure', 'Surgery'] as const;

export type WaitingListStatusTab = (typeof WAITING_LIST_STATUS_TABS)[number];
export type WaitingListTypeOption = (typeof WAITING_LIST_TYPE_OPTIONS)[number];

export type WaitingListFilterToolbarProps = {
  quickSearch: string;
  onQuickSearchChange: (value: string) => void;
  filters: WaitingListFilters;
  onFiltersChange: (next: WaitingListFilters) => void;
  onApply: () => void;
  onReset: () => void;
  typeOptions?: ReadonlyArray<WaitingListTypeOption>;
  hasActiveFilters: boolean;
  onAddPatient: () => void;
  className?: string;
  'data-testid'?: string;
};

/**
 * Search / type / date / Add Patient — flat toolbar chrome.
 * Primary search covers patient / UHID / surgery / doctor.
 * Status navigation lives in WaitingListSummaryWidget.
 */
export function WaitingListFilterToolbar({
  quickSearch,
  onQuickSearchChange,
  filters,
  onFiltersChange,
  onApply,
  onReset,
  typeOptions = WAITING_LIST_TYPE_OPTIONS,
  hasActiveFilters,
  onAddPatient,
  className,
  'data-testid': testId = 'waiting-list-filter-toolbar',
}: WaitingListFilterToolbarProps) {
  const patchFilters = (patch: Partial<WaitingListFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  /** Beat CounsellingButton touchTarget (min-h-11) for dense worklist chrome. */
  const denseBtn = 'min-h-8 !min-h-8';

  return (
    <div
      data-testid={testId}
      className={cn('flex shrink-0 flex-col gap-2 bg-transparent', className)}
      aria-label="Search and filters"
    >
      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        <CounsellingSearchInput
          value={quickSearch}
          onChange={onQuickSearchChange}
          placeholder="Search by patient, UHID, surgery, doctor…"
          density="catalog"
          className="min-w-0 flex-1"
          data-testid="waiting-list-quick-search"
        />

        <div
          className={cn(counsellingSessionTokens.pillTabTrack, 'shrink-0')}
          role="group"
          aria-label="Filter by type"
        >
          {typeOptions.map((type) => {
            const selected = filters.type === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={selected}
                onClick={() => patchFilters({ type })}
                className={cn(
                  counsellingSessionTokens.pillTab,
                  selected
                    ? counsellingSessionTokens.pillTabCurrent
                    : counsellingSessionTokens.pillTabMuted,
                )}
              >
                {type}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {(hasActiveFilters || quickSearch) && (
            <CounsellingButton
              type="button"
              size="sm"
              variant="outline"
              className={denseBtn}
              onClick={onReset}
              data-testid="waiting-list-filters-reset"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset
            </CounsellingButton>
          )}

          <CounsellingButton
            type="button"
            size="sm"
            className={cn(
              denseBtn,
              'bg-counselling-primary text-white hover:bg-counselling-primary/90',
            )}
            onClick={onAddPatient}
            data-testid="waiting-list-add-patient"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add Patient
          </CounsellingButton>
        </div>
      </div>

      {/* Compact date range — existing API Apply semantics; no Filters panel */}
      <div
        className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
        data-testid="waiting-list-date-filters"
      >
        <div className="min-w-0 sm:w-[9.5rem]">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-counselling-muted-foreground">
            <Calendar className="h-3 w-3" aria-hidden />
            From Date
          </label>
          <CounsellingInput
            type="date"
            value={filters.fromDate}
            onChange={(e) => patchFilters({ fromDate: e.target.value })}
            className="h-8"
            data-testid="waiting-list-from-date"
          />
        </div>
        <div className="min-w-0 sm:w-[9.5rem]">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-counselling-muted-foreground">
            <Calendar className="h-3 w-3" aria-hidden />
            To Date
          </label>
          <CounsellingInput
            type="date"
            value={filters.toDate}
            onChange={(e) => patchFilters({ toDate: e.target.value })}
            className="h-8"
            data-testid="waiting-list-to-date"
          />
        </div>
        <CounsellingButton
          type="button"
          size="sm"
          variant="outline"
          className={denseBtn}
          onClick={onApply}
          data-testid="waiting-list-filters-apply"
        >
          Apply
        </CounsellingButton>
      </div>
    </div>
  );
}
