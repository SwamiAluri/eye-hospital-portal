'use client';

import { Plus, RotateCcw, UserPlus } from 'lucide-react';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { CounsellingInput } from '@/components/counsellors-desk/session/primitives/CounsellingInput';
import { CounsellingSearchInput } from '@/components/counsellors-desk/session/primitives/CounsellingSearchInput';
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
  onReset: () => void;
  typeOptions?: ReadonlyArray<WaitingListTypeOption>;
  /** Client-only Owner convenience filter — never sent to waiting-list API. */
  ownerFilter?: WaitingListOwnerFilter;
  onOwnerFilterChange?: (value: WaitingListOwnerFilter) => void;
  onNewPatient: () => void;
  onScheduleCounselling: () => void;
  className?: string;
  'data-testid'?: string;
};

/**
 * One-row waiting-list filters: search, dates, type, owner, clear, and entry actions.
 */
export function WaitingListFilterToolbar({
  quickSearch,
  onQuickSearchChange,
  filters,
  onFiltersChange,
  onReset,
  typeOptions = WAITING_LIST_TYPE_OPTIONS,
  ownerFilter = 'All',
  onOwnerFilterChange,
  onNewPatient,
  onScheduleCounselling,
  className,
  'data-testid': testId = 'waiting-list-filter-toolbar',
}: WaitingListFilterToolbarProps) {
  const patchFilters = (patch: Partial<WaitingListFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  /** Beat CounsellingButton touchTarget (min-h-11) for dense worklist chrome. */
  const denseBtn = 'min-h-8 !min-h-8';
  const fieldClass = cn(
    'h-8 rounded-md border border-counselling-border bg-counselling-background',
    'px-2 text-xs font-medium text-counselling-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
  );

  const canClear = Boolean(
    quickSearch.trim() ||
      filters.fromDate ||
      filters.toDate ||
      filters.type !== 'All' ||
      ownerFilter !== 'All',
  );

  return (
    <div
      data-testid={testId}
      className={cn('waiting-list-filter-toolbar w-full shrink-0 overflow-x-auto bg-transparent', className)}
      aria-label="Search and filters"
    >
      <div
        className={cn(
          'waiting-list-filter-toolbar__primary grid w-full min-w-0 items-center gap-x-3 gap-y-2',
          'grid-cols-[minmax(16rem,1fr)_auto_auto_auto_auto]',
        )}
      >
        <CounsellingSearchInput
          value={quickSearch}
          onChange={onQuickSearchChange}
          placeholder="Search patient, MRN, doctor, procedure, counsellor..."
          density="catalog"
          className="waiting-list-filter-toolbar__search min-w-0 w-full"
          data-testid="waiting-list-quick-search"
        />

        <div
          className="waiting-list-filter-toolbar__dates flex items-center gap-3"
          data-testid="waiting-list-date-filters"
        >
          <label htmlFor="waiting-list-from-date" className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-xs font-semibold text-counselling-foreground">
              From
            </span>
            <CounsellingInput
              id="waiting-list-from-date"
              type="date"
              value={filters.fromDate}
              onChange={(e) => patchFilters({ fromDate: e.target.value })}
              aria-label="From date"
              className="h-8 w-[9.75rem]"
              data-testid="waiting-list-from-date"
            />
          </label>
          <label htmlFor="waiting-list-to-date" className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-xs font-semibold text-counselling-foreground">
              To
            </span>
            <CounsellingInput
              id="waiting-list-to-date"
              type="date"
              value={filters.toDate}
              onChange={(e) => patchFilters({ toDate: e.target.value })}
              aria-label="To date"
              className="h-8 w-[9.75rem]"
              data-testid="waiting-list-to-date"
            />
          </label>
        </div>

        <label className="flex items-center gap-1.5">
          <span className="whitespace-nowrap text-xs font-semibold text-counselling-foreground">
            Type:
          </span>
          <select
            value={filters.type}
            onChange={(e) =>
              patchFilters({ type: e.target.value as WaitingListFilters['type'] })
            }
            className={cn(fieldClass, 'w-[7.5rem]')}
            aria-label="Filter by type"
            data-testid="waiting-list-type-filter"
          >
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        {onOwnerFilterChange ? (
          <label className="waiting-list-filter-toolbar__owner flex items-center gap-1.5">
            <span className="whitespace-nowrap text-xs font-semibold text-counselling-foreground">
              Owner:
            </span>
            <select
              value={ownerFilter}
              onChange={(e) =>
                onOwnerFilterChange(e.target.value as WaitingListOwnerFilter)
              }
              className={cn(fieldClass, 'w-[10.5rem]')}
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
        ) : (
          <span />
        )}

        <div className="waiting-list-filter-toolbar__actions flex items-center justify-end gap-2">
          <CounsellingButton
            type="button"
            size="sm"
            variant="outline"
            className={denseBtn}
            onClick={onReset}
            disabled={!canClear}
            data-testid="waiting-list-filters-reset"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Clear
          </CounsellingButton>
          <CounsellingButton
            type="button"
            size="sm"
            variant="outline"
            className={denseBtn}
            onClick={onNewPatient}
            data-testid="waiting-list-new-patient"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            New patient
          </CounsellingButton>
          <CounsellingButton
            type="button"
            size="sm"
            className={cn(
              denseBtn,
              'bg-counselling-primary text-white hover:bg-counselling-primary/90',
            )}
            onClick={onScheduleCounselling}
            data-testid="waiting-list-add-patient"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Schedule counselling
          </CounsellingButton>
        </div>
      </div>
    </div>
  );
}
