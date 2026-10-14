'use client';

import Link from 'next/link';
import { ChevronsUpDown, Loader2 } from 'lucide-react';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import {
  PatientHubPhoneCell,
  PatientHubProviderCell,
} from '@/components/patients/lookup/PatientHubContextCluster';
import { PatientHubRowActions } from '@/components/patients/lookup/PatientHubRowActions';
import { formatPatientDisplayName } from '@/lib/patients/patient-display-utils';
import { formatDirectorySexLabel } from '@/lib/patients/patient-hub-row-display';
import { shouldActivateRowPreview } from '@/lib/patients/patient-hub-row-activation';
import type { PatientLookupSortBy } from '@/lib/patients/patient-lookup-filters';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { patientProfileUrl } from '@/lib/patients/patient-routes';
import type { PatientLookupRow } from '@/types/patient-lookup';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** Desktop / tablet: Patient | MRN | Gender | Phone | Provider | Actions */
export const PATIENT_HUB_TABLE_COLS = 6;
/** Compact (docked preview / < xl): same six columns, tighter track shares */
export const PATIENT_HUB_COMPACT_TABLE_COLS = 6;

/**
 * Authoritative desktop column geometry.
 *
 * ONLY colgroup uses these widths. Do not re-apply independent w/min/max on
 * th/td — that dual authority caused browser drift under table-fixed.
 * Percentages sum to 100% so Patient cannot absorb leftover space.
 */
export const PATIENT_HUB_COLGROUP_DESKTOP = [
  { key: 'patient', width: '22%' },
  { key: 'mrn', width: '17%' },
  { key: 'gender', width: '9%' },
  { key: 'phone', width: '13%' },
  { key: 'provider', width: '17%' },
  { key: 'actions', width: '22%' },
] as const;

/** Compact (tablet / docked preview): Provider remains an independent column. */
export const PATIENT_HUB_COLGROUP_COMPACT = [
  { key: 'patient', width: '20%' },
  { key: 'mrn', width: '16%' },
  { key: 'gender', width: '9%' },
  { key: 'phone', width: '13%' },
  { key: 'provider', width: '18%' },
  { key: 'actions', width: '24%' },
] as const;

/** @deprecated Use PATIENT_HUB_COLGROUP_* — kept for transitional imports/tests. */
export const PATIENT_HUB_COLUMN_TRACK = {
  phone: 'patient-hub-col-phone',
  mrn: 'patient-hub-col-mrn',
  gender: 'patient-hub-col-gender',
  provider: 'patient-hub-col-provider',
  actions: 'patient-hub-col-actions',
} as const;

const directoryHeaderClass =
  'overflow-hidden px-2.5 py-1.5 text-left text-sm font-semibold leading-5 tracking-normal text-counselling-foreground sm:px-3';
/** Cell shell: overflow clipped to the colgroup track; min-w-0 allows truncate children. */
const directoryCellClass =
  'min-w-0 overflow-hidden px-2.5 py-2 align-middle sm:px-3';
const COMPACT_TABLE_MIN_WIDTH = 'min-w-[52rem]';
const VIRTUALIZE_ROW_THRESHOLD = 40;

function columnGroup(compactColumns: boolean) {
  const cols = compactColumns ? PATIENT_HUB_COLGROUP_COMPACT : PATIENT_HUB_COLGROUP_DESKTOP;
  return (
    <colgroup data-testid={patientLookupTestIds.tableColgroup}>
      {cols.map((col) => (
        <col key={col.key} data-col={col.key} style={{ width: col.width }} />
      ))}
    </colgroup>
  );
}

function columnAriaSort(
  sortKey: PatientLookupSortBy,
  currentSort: PatientLookupSortBy,
  currentDir: 'asc' | 'desc',
): 'ascending' | 'descending' | 'none' {
  if (currentSort !== sortKey) return 'none';
  return currentDir === 'desc' ? 'descending' : 'ascending';
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: PatientLookupSortBy;
  currentSort: PatientLookupSortBy;
  currentDir: 'asc' | 'desc';
  onSort: (key: PatientLookupSortBy) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSort(sortKey);
      }}
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate font-semibold transition-colors hover:text-counselling-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
        active ? 'text-counselling-primary' : 'text-counselling-foreground',
      )}
      data-testid={patientLookupTestIds.sortHeader(sortKey)}
    >
      {label}
      <ChevronsUpDown
        className={cn('h-3.5 w-3.5 shrink-0', active && currentDir === 'desc' && 'rotate-180')}
      />
    </button>
  );
}

function WorklistMessage({
  children,
  role,
  colSpan,
}: {
  children: ReactNode;
  role?: 'status' | 'alert';
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center" role={role}>
        {children}
      </td>
    </tr>
  );
}

interface HeaderProps {
  currentSort: PatientLookupSortBy;
  currentSortDir: 'asc' | 'desc';
  onSort: (key: PatientLookupSortBy) => void;
  /** Compact track shares (tablet / docked preview). Provider stays independent. */
  compactColumns?: boolean;
  /** @deprecated Alias of compactColumns. */
  foldLocation?: boolean;
}

function resolveCompact(props: { compactColumns?: boolean; foldLocation?: boolean }): boolean {
  return props.compactColumns ?? props.foldLocation ?? false;
}

export function PatientHubTableHeader({
  currentSort,
  currentSortDir,
  onSort,
  compactColumns,
  foldLocation,
}: HeaderProps) {
  void resolveCompact({ compactColumns, foldLocation });
  return (
    <thead
      className="sticky top-0 z-10 bg-counselling-card"
      data-testid={patientLookupTestIds.tableHeader}
    >
      <tr className="border-b border-counselling-border/60">
        <th
          scope="col"
          className={directoryHeaderClass}
          data-col="patient"
          aria-sort={columnAriaSort('name', currentSort, currentSortDir)}
        >
          <SortableHeader
            label="Patient"
            sortKey="name"
            currentSort={currentSort}
            currentDir={currentSortDir}
            onSort={onSort}
          />
        </th>
        <th scope="col" className={directoryHeaderClass} data-col="mrn">
          MRN
        </th>
        <th scope="col" className={directoryHeaderClass} data-col="gender">
          Gender
        </th>
        <th scope="col" className={directoryHeaderClass} data-col="phone">
          Phone
        </th>
        <th scope="col" className={directoryHeaderClass} data-col="provider">
          Provider
        </th>
        <th scope="col" className={directoryHeaderClass} data-col="actions">
          Actions
        </th>
      </tr>
    </thead>
  );
}

export interface PatientHubTableProps extends HeaderProps {
  rows: PatientLookupRow[];
  previewId: string | null;
  isLoading: boolean;
  isError: boolean;
  isReady: boolean;
  onRowClick: (row: PatientLookupRow) => void;
  onOpenProfile: (patientId: string) => void;
  emptyTitle?: string;
  emptyHint?: string;
}

export function PatientHubTable({
  rows,
  previewId,
  isLoading,
  isError,
  isReady,
  currentSort,
  currentSortDir,
  onSort,
  compactColumns,
  foldLocation,
  onRowClick,
  onOpenProfile,
  emptyTitle = 'No patients match your filters.',
  emptyHint,
}: PatientHubTableProps) {
  const compact = resolveCompact({ compactColumns, foldLocation });
  const colSpan = compact ? PATIENT_HUB_COMPACT_TABLE_COLS : PATIENT_HUB_TABLE_COLS;

  return (
    <table
      className={cn(
        'hidden w-full table-fixed border-collapse text-xs md:table',
        compact && COMPACT_TABLE_MIN_WIDTH,
      )}
      data-testid={patientLookupTestIds.table}
      data-compact={compact ? 'true' : 'false'}
      aria-label="Patients"
    >
      {columnGroup(compact)}
      <PatientHubTableHeader
        currentSort={currentSort}
        currentSortDir={currentSortDir}
        onSort={onSort}
        compactColumns={compact}
      />
      <tbody className="divide-y divide-counselling-border/40">
        {isLoading && (
          <WorklistMessage role="status" colSpan={colSpan}>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-counselling-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading patients…
            </p>
          </WorklistMessage>
        )}

        {!isLoading && isError && (
          <WorklistMessage role="alert" colSpan={colSpan}>
            <p className="text-sm font-medium text-red-800">Could not load patients</p>
            <p className="mt-1 text-xs leading-relaxed text-counselling-muted-foreground">
              Use Refresh to try again.
            </p>
          </WorklistMessage>
        )}

        {isReady && !isLoading && !isError && rows.length === 0 && (
          <WorklistMessage role="status" colSpan={colSpan}>
            <p className="text-sm font-medium text-counselling-foreground">{emptyTitle}</p>
            {emptyHint && (
              <p className="mt-1 text-xs leading-relaxed text-counselling-muted-foreground">
                {emptyHint}
              </p>
            )}
          </WorklistMessage>
        )}

        {!isLoading &&
          rows.map((row) => {
            const isPreview = previewId === row.id;
            const virtualize = rows.length >= VIRTUALIZE_ROW_THRESHOLD;
            const mrn = row.mrn?.trim() ?? '';
            const genderLabel = formatDirectorySexLabel(row.gender);

            return (
              <tr
                key={row.id}
                tabIndex={0}
                className={cn(
                  'staff-worklist-row cursor-pointer transition-colors hover:bg-counselling-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-counselling-primary/40',
                  isPreview && 'counselling-selected-row',
                )}
                style={virtualize ? { contentVisibility: 'auto' } : undefined}
                data-testid={patientLookupTestIds.tableRow(row.id)}
                onClick={() => onRowClick(row)}
                onKeyDown={(event) => {
                  if (!shouldActivateRowPreview(event)) return;
                  event.preventDefault();
                  onRowClick(row);
                }}
              >
                <td className={directoryCellClass} data-col="patient">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PatientAvatar
                      size="sm"
                      firstName={row.firstName}
                      lastName={row.lastName}
                      photoUrl={row.photoThumbnailUrl}
                    />
                    <div className="min-w-0 overflow-hidden">
                      <Link
                        href={patientProfileUrl(row.id)}
                        className="block truncate text-sm font-semibold text-counselling-foreground hover:text-counselling-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProfile(row.id);
                        }}
                        data-testid={patientLookupTestIds.patientNameLink(row.id)}
                      >
                        {formatPatientDisplayName(row)}
                      </Link>
                    </div>
                  </div>
                </td>

                <td className={directoryCellClass} data-col="mrn">
                  {mrn ? (
                    <p
                      className="truncate text-sm font-medium tabular-nums text-counselling-foreground"
                      title={mrn}
                    >
                      {mrn}
                    </p>
                  ) : (
                    <span className="text-sm text-counselling-muted-foreground">—</span>
                  )}
                </td>

                <td className={directoryCellClass} data-col="gender">
                  {genderLabel ? (
                    <p className="truncate text-sm text-counselling-foreground">{genderLabel}</p>
                  ) : (
                    <span className="text-sm text-counselling-muted-foreground">—</span>
                  )}
                </td>

                <td className={directoryCellClass} data-col="phone">
                  <PatientHubPhoneCell row={row} />
                </td>
                <td className={directoryCellClass} data-col="provider">
                  <PatientHubProviderCell row={row} />
                </td>
                <td className={directoryCellClass} data-col="actions">
                  <PatientHubRowActions row={row} />
                </td>
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}
