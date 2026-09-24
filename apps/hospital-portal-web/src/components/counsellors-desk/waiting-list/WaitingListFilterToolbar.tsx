'use client';

import { Calendar, Plus, RotateCcw } from 'lucide-react';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { CounsellingInput } from '@/components/counsellors-desk/session/primitives/CounsellingInput';
import { CounsellingSearchInput } from '@/components/counsellors-desk/session/primitives/CounsellingSearchInput';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { WaitingListOwnerFilter } from '@/lib/counsellors-desk/waiting-list-client-filters';
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

export const WAITING_LIST_OWNER_FILTER_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'Mine', label: 'My Sessions' },
  { value: 'Unassigned', label: 'Unassigned' },
  { value: 'Other', label: 'Other Counsellors' },
] as const satisfies ReadonlyArray<{ value: WaitingListOwnerFilter; label: string }>;

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
  /** Client-only Owner convenience filter — never sent to waiting-list API. */
  ownerFilter?: WaitingListOwnerFilter;
  onOwnerFilterChange?: (value: WaitingListOwnerFilter) => void;
  hasActiveFilters: boolean;
  onAddPatient: () => void;
  /** Applied date range (after Apply) — for active-filter chips only. */
  appliedFromDate?: string;
  appliedToDate?: string;
  className?: string;
  'data-testid'?: string;
};

/**
 * Search / type / date / Add Patient — same toolbar IA at every viewport.
 * Workstation: CSS grid with capped search + compact inline date row.
 * Desktop ≥1600: frozen spacious composition.
 */
export function WaitingListFilterToolbar({
  quickSearch,
  onQuickSearchChange,
  filters,
  onFiltersChange,
  onApply,
  onReset,
  typeOptions = WAITING_LIST_TYPE_OPTIONS,
  ownerFilter = 'All',
  onOwnerFilterChange,
  hasActiveFilters,
  onAddPatient,
  appliedFromDate = '',
  appliedToDate = '',
  className,
  'data-testid': testId = 'waiting-list-filter-toolbar',
}: WaitingListFilterToolbarProps) {
  const patchFilters = (patch: Partial<WaitingListFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  /** Beat CounsellingButton touchTarget (min-h-11) for dense worklist chrome. */
  const denseBtn = 'min-h-8 !min-h-8';

  const ownerLabel =
    WAITING_LIST_OWNER_FILTER_OPTIONS.find((o) => o.value === ownerFilter)?.label ??
    ownerFilter;

  const activeChips: string[] = [];
  if (filters.type !== 'All') activeChips.push(`Type: ${filters.type}`);
  if (ownerFilter !== 'All') activeChips.push(`Owner: ${ownerLabel}`);
  if (appliedFromDate || appliedToDate) {
    activeChips.push(
      `Dates: ${appliedFromDate || '…'} → ${appliedToDate || '…'}`,
    );
  }
  if (quickSearch.trim()) activeChips.push('Search active');

  return (
    <div
      data-testid={testId}
      className={cn(
        'waiting-list-filter-toolbar flex shrink-0 flex-col gap-1.5 bg-transparent',
        'min-[1600px]:gap-2',
        className,
      )}
      aria-label="Search and filters"
    >
      <div
        className={cn(
          'waiting-list-filter-toolbar__primary grid min-w-0 items-center gap-x-2 gap-y-1',
          /* Search takes remaining width; type + owner + Add Patient stay auto */
          'grid-cols-[minmax(12rem,1fr)_auto_auto_auto]',
          'min-[1600px]:flex min-[1600px]:flex-nowrap min-[1600px]:gap-3',
        )}
      >
        <CounsellingSearchInput
          value={quickSearch}
          onChange={onQuickSearchChange}
          placeholder="Search patient, MRN, doctor, procedure, counsellor..."
          density="catalog"
          className={cn(
            'waiting-list-filter-toolbar__search min-w-0 w-full',
            'min-[1600px]:max-w-none min-[1600px]:flex-1',
          )}
          data-testid="waiting-list-quick-search"
        />

        <div
          className={cn(
            counsellingSessionTokens.pillTabTrack,
            'waiting-list-filter-toolbar__types shrink-0',
          )}
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

        {onOwnerFilterChange ? (
          <label className="waiting-list-filter-toolbar__owner flex shrink-0 items-center gap-1.5">
            <span className="text-xs font-semibold text-counselling-foreground whitespace-nowrap">
              Owner:
            </span>
            <select
              value={ownerFilter}
              onChange={(e) =>
                onOwnerFilterChange(e.target.value as WaitingListOwnerFilter)
              }
              className={cn(
                'h-8 max-w-[11rem] rounded-md border border-counselling-border bg-counselling-background',
                'px-2 text-xs font-medium text-counselling-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
              )}
              aria-label="Filter by owner"
              data-testid="waiting-list-owner-filter"
            >
              {WAITING_LIST_OWNER_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="waiting-list-filter-toolbar__actions flex shrink-0 items-center justify-end gap-1.5">
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

      <div
        className={cn(
          'waiting-list-filter-toolbar__dates flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1',
          'min-[1600px]:items-end min-[1600px]:gap-3',
        )}
        data-testid="waiting-list-date-filters"
      >
        <div className="flex min-w-0 items-center gap-1.5 min-[1600px]:w-[9.5rem] min-[1600px]:flex-col min-[1600px]:items-stretch min-[1600px]:gap-0">
          <label
            htmlFor="waiting-list-from-date"
            className="mb-0 flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-counselling-muted-foreground min-[1600px]:mb-1 min-[1600px]:text-xs min-[1600px]:normal-case min-[1600px]:tracking-normal"
          >
            <Calendar className="h-3 w-3" aria-hidden />
            <span className="min-[1600px]:hidden">From</span>
            <span className="hidden min-[1600px]:inline">From Date</span>
          </label>
          <CounsellingInput
            id="waiting-list-from-date"
            type="date"
            value={filters.fromDate}
            onChange={(e) => patchFilters({ fromDate: e.target.value })}
            className="h-8 w-[8.75rem] min-[1600px]:w-full"
            data-testid="waiting-list-from-date"
          />
        </div>
        <div className="flex min-w-0 items-center gap-1.5 min-[1600px]:w-[9.5rem] min-[1600px]:flex-col min-[1600px]:items-stretch min-[1600px]:gap-0">
          <label
            htmlFor="waiting-list-to-date"
            className="mb-0 flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-counselling-muted-foreground min-[1600px]:mb-1 min-[1600px]:text-xs min-[1600px]:normal-case min-[1600px]:tracking-normal"
          >
            <Calendar className="h-3 w-3" aria-hidden />
            <span className="min-[1600px]:hidden">To</span>
            <span className="hidden min-[1600px]:inline">To Date</span>
          </label>
          <CounsellingInput
            id="waiting-list-to-date"
            type="date"
            value={filters.toDate}
            onChange={(e) => patchFilters({ toDate: e.target.value })}
            className="h-8 w-[8.75rem] min-[1600px]:w-full"
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
          aria-label="Apply date filters"
        >
          Apply dates
        </CounsellingButton>
      </div>

      {activeChips.length > 0 ? (
        <div
          className="flex min-w-0 flex-wrap items-center gap-1.5"
          data-testid="waiting-list-active-filters"
          aria-label="Active filters"
        >
          {activeChips.map((chip) => (
            <span
              key={chip}
              className="inline-flex max-w-full truncate rounded-md border border-counselling-border/60 bg-counselling-muted/40 px-2 py-0.5 text-[11px] font-medium text-counselling-foreground"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
