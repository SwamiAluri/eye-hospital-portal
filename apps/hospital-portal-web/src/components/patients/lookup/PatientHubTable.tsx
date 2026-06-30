'use client';

import Link from 'next/link';
import { ChevronsUpDown, Star } from 'lucide-react';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import { AcuityDot } from '@/components/patients/lookup/AcuityDot';
import { HighlightsPills } from '@/components/patients/lookup/HighlightsPills';
import { IpAdmittedBadge } from '@/components/patients/lookup/IpAdmittedBadge';
import { PatientHubRowActions } from '@/components/patients/lookup/PatientHubRowActions';
import { QueueStationCell } from '@/components/patients/lookup/QueueStationCell';
import { ReasonVisitCell } from '@/components/patients/lookup/ReasonVisitCell';
import {
  formatHubSchedule,
  formatPatientHubIdentityLine,
} from '@/lib/patients/patient-hub-row-display';
import type { PatientLookupSortBy } from '@/lib/patients/patient-lookup-filters';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { patientProfileUrl } from '@/lib/patients/patient-routes';
import type { PatientLookupRow } from '@/types/patient-lookup';
import { cn } from '@/lib/utils';

export const PATIENT_HUB_TABLE_COLS = 10;
const VIRTUALIZE_ROW_THRESHOLD = 40;

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
      onClick={() => onSort(sortKey)}
      className={cn(
        'inline-flex items-center gap-1 font-medium transition-colors hover:text-emerald-700',
        active ? 'text-emerald-800' : 'text-gray-600',
      )}
      data-testid={patientLookupTestIds.sortHeader(sortKey)}
    >
      {label}
      <ChevronsUpDown
        className={cn('h-3.5 w-3.5', active && currentDir === 'desc' && 'rotate-180')}
      />
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: PATIENT_HUB_TABLE_COLS }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div
            className="h-3 animate-pulse rounded-full bg-gray-100"
            style={{ width: `${40 + ((i * 11) % 45)}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

export interface PatientHubTableProps {
  rows: PatientLookupRow[];
  previewId: string | null;
  isLoading: boolean;
  isError: boolean;
  isReady: boolean;
  compact?: boolean;
  currentSort: PatientLookupSortBy;
  currentSortDir: 'asc' | 'desc';
  selectedIds: Set<string>;
  allPageSelected: boolean;
  somePageSelected: boolean;
  onSort: (key: PatientLookupSortBy) => void;
  onToggleRow: (patientId: string) => void;
  onToggleAllPage: () => void;
  onRowClick: (row: PatientLookupRow) => void;
  onFavorite: (patientId: string) => void;
  onOpenProfile: (patientId: string) => void;
  onPreview: (row: PatientLookupRow) => void;
}

export function PatientHubTable({
  rows,
  previewId,
  isLoading,
  isError,
  isReady,
  compact = false,
  currentSort,
  currentSortDir,
  selectedIds,
  allPageSelected,
  somePageSelected,
  onSort,
  onToggleRow,
  onToggleAllPage,
  onRowClick,
  onFavorite,
  onOpenProfile,
  onPreview,
}: PatientHubTableProps) {
  const assignedColClass = cn(
    'hidden text-left px-3 py-3 font-medium text-gray-600',
    compact ? '2xl:table-cell' : 'xl:table-cell',
  );

  return (
    <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
      <div className="overflow-x-auto">
        <table
          className="w-full table-fixed border-separate border-spacing-y-1.5 px-2 text-sm"
          data-testid={patientLookupTestIds.table}
          aria-label="Patients"
        >
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgb(229,231,235)]">
            <tr className="text-left">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all on page"
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  checked={allPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = somePageSelected && !allPageSelected;
                  }}
                  onChange={onToggleAllPage}
                  data-testid={patientLookupTestIds.selectAllCheckbox}
                />
              </th>
              <th className="w-10 px-3 py-2 font-medium text-gray-600" aria-label="Favorite" />
              <th className="w-[22%] min-w-[180px] px-3 py-2">
                <SortableHeader
                  label="Patient"
                  sortKey="name"
                  currentSort={currentSort}
                  currentDir={currentSortDir}
                  onSort={onSort}
                />
              </th>
              <th className="w-[16%] min-w-[130px] px-3 py-2 font-medium text-gray-600">
                Reason / visit
              </th>
              <th className="w-[12%] min-w-[100px] px-3 py-2">
                <SortableHeader
                  label="Schedule"
                  sortKey="scheduledAt"
                  currentSort={currentSort}
                  currentDir={currentSortDir}
                  onSort={onSort}
                />
              </th>
              <th className="w-[14%] min-w-[110px] px-3 py-2">
                <SortableHeader
                  label="Queue / station"
                  sortKey="waitingMinutes"
                  currentSort={currentSort}
                  currentDir={currentSortDir}
                  onSort={onSort}
                />
              </th>
              <th className="w-[8%] min-w-[56px] px-3 py-2">
                <SortableHeader
                  label="Acuity"
                  sortKey="acuity"
                  currentSort={currentSort}
                  currentDir={currentSortDir}
                  onSort={onSort}
                />
              </th>
              <th className="w-[16%] min-w-[120px] px-3 py-2 font-medium text-gray-600">
                Highlights
              </th>
              <th className={assignedColClass}>Assigned</th>
              <th className="w-[120px] px-3 py-2 text-right font-medium text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

            {!isLoading && isError && (
              <tr>
                <td
                  colSpan={PATIENT_HUB_TABLE_COLS}
                  className="px-4 py-12 text-center text-red-600"
                >
                  Could not load patients. Use Refresh to try again.
                </td>
              </tr>
            )}

            {isReady && !isLoading && !isError && rows.length === 0 && (
              <tr>
                <td
                  colSpan={PATIENT_HUB_TABLE_COLS}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  No patients match your filters.
                </td>
              </tr>
            )}

            {!isLoading &&
              rows.map((row) => {
                const isPreview = previewId === row.id;
                const identityLine = formatPatientHubIdentityLine(row);
                const virtualize = rows.length >= VIRTUALIZE_ROW_THRESHOLD;

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'cursor-pointer bg-white shadow-sm ring-1 ring-gray-100 transition-colors hover:bg-emerald-50/40',
                      isPreview &&
                        'bg-emerald-50/70 ring-emerald-300 border-l-4 border-l-emerald-600',
                    )}
                    style={virtualize ? { contentVisibility: 'auto' } : undefined}
                    data-testid={patientLookupTestIds.tableRow(row.id)}
                    onClick={() => onRowClick(row)}
                  >
                    <td className="rounded-l-lg px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.firstName} ${row.lastName}`}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        checked={selectedIds.has(row.id)}
                        onChange={() => onToggleRow(row.id)}
                        data-testid={patientLookupTestIds.rowCheckbox(row.id)}
                      />
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={row.isFavorite ? 'Remove favorite' : 'Add favorite'}
                        className="text-gray-400 transition-colors hover:text-amber-500"
                        data-testid={patientLookupTestIds.favoriteButton(row.id)}
                        onClick={() => onFavorite(row.id)}
                      >
                        <Star
                          className={cn(
                            'h-4 w-4',
                            row.isFavorite && 'fill-amber-400 text-amber-400',
                          )}
                        />
                      </button>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <PatientAvatar
                          size="sm"
                          firstName={row.firstName}
                          lastName={row.lastName}
                          photoUrl={row.photoThumbnailUrl}
                        />
                        <div className="min-w-0">
                          <Link
                            href={patientProfileUrl(row.id)}
                            className="truncate font-medium text-emerald-800 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenProfile(row.id);
                            }}
                            data-testid={patientLookupTestIds.patientNameLink(row.id)}
                          >
                            {row.firstName} {row.lastName}
                          </Link>
                          {identityLine && (
                            <p className="truncate font-mono text-[11px] text-gray-600">
                              {identityLine}
                            </p>
                          )}
                          {row.phone && (
                            <p className="truncate text-[11px] text-gray-500">{row.phone}</p>
                          )}
                          <IpAdmittedBadge admission={row.ipAdmission} className="mt-1" />
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <ReasonVisitCell row={row} />
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-600">
                      {formatHubSchedule(row.scheduledAt)}
                    </td>

                    <td className="px-3 py-3">
                      <QueueStationCell row={row} />
                    </td>

                    <td className="px-3 py-3">
                      <AcuityDot acuity={row.clinicalAcuity} />
                    </td>

                    <td className="px-3 py-3">
                      <HighlightsPills row={row} />
                    </td>

                    <td
                      className={cn(
                        'px-3 py-3 text-xs text-gray-700',
                        compact ? 'hidden 2xl:table-cell' : 'hidden xl:table-cell',
                      )}
                    >
                      {row.assignedProviderName ? (
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {row.assignedProviderName}
                          </p>
                          {row.assignedProviderRole && (
                            <p className="truncate text-gray-500">{row.assignedProviderRole}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="rounded-r-lg px-3 py-3">
                      <PatientHubRowActions row={row} onPreview={() => onPreview(row)} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
