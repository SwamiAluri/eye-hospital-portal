'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, ChevronDown, Loader2, Microscope } from 'lucide-react';
import {
  ipManagementApi,
  WardInvestigationSummaryDto,
} from '@/lib/api/ip-management.api';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface PacInvestigationSummaryProps {
  journeyId: string;
  /** Deep-link to §1 Investigations (the single editable source). */
  onEditInInvestigations?: () => void;
  /** Phase 4: collapsed chip in the PAC Reference accordion (expand for full table). */
  defaultCollapsed?: boolean;
  /** Inline chip only — hides duplicate navigation and footer notes. */
  compact?: boolean;
}

function statusLabel(entryStatus: string): string {
  switch (entryStatus) {
    case 'verified':
      return 'Verified';
    case 'entered':
      return 'Entered';
    case 'draft':
      return 'Draft';
    default:
      return entryStatus || 'Pending';
  }
}

function statusClass(entryStatus: string, hasValue: boolean): string {
  if (entryStatus === 'verified') return 'bg-green-100 text-green-800';
  if (hasValue) return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-600';
}

export function PacInvestigationSummary({
  journeyId,
  onEditInInvestigations,
  defaultCollapsed = false,
  compact = false,
}: PacInvestigationSummaryProps) {
  const [summary, setSummary] = useState<WardInvestigationSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!defaultCollapsed);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getWardInvestigationSummary(journeyId);
    setSummary(data);
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading investigation summary…
      </div>
    );
  }

  if (!summary) {
    return (
      <p className="py-2 text-xs text-gray-500">
        Investigation summary unavailable. Complete §1 Investigations in the ward checklist.
      </p>
    );
  }

  const applicable = summary.items.filter(i => i.appliesToJourney);
  const unverified = summary.unverifiedCriticalKeys ?? [];
  const verifiedCount = applicable.filter(i => i.entryStatus === 'verified').length;

  const chipLabel = [
    `${applicable.length} lab${applicable.length === 1 ? '' : 's'}`,
    `${verifiedCount} verified`,
    unverified.length > 0 ? `${unverified.length} critical unverified` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (compact) {
    return (
      <div data-testid={WARD_PREOP_TEST_IDS.pacInvestigationSummary} className="text-sm text-gray-800">
        {applicable.length === 0 ? (
          <span className="text-gray-500">—</span>
        ) : (
          <button
            type="button"
            data-testid={WARD_PREOP_TEST_IDS.pacInvestigationChip}
            onClick={() => setExpanded(true)}
            className="text-left font-medium hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            {chipLabel}
          </button>
        )}
        {expanded && (
          <div className="mt-2 overflow-hidden rounded border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">Test</th>
                  <th className="px-3 py-2 text-left font-medium">Result</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applicable.map(item => {
                  const hasValue = !!item.resultValue?.trim();
                  return (
                    <tr key={item.itemKey}>
                      <td className="px-3 py-2 text-gray-800">{item.itemLabel}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {hasValue ? (
                          <>
                            {item.resultValue}
                            {item.resultUnit ? ` ${item.resultUnit}` : ''}
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${statusClass(item.entryStatus, hasValue)}`}
                        >
                          {statusLabel(item.entryStatus)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-gray-100 px-3 py-2 text-right">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Collapse
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-2" data-testid={WARD_PREOP_TEST_IDS.pacInvestigationSummary}>
      {defaultCollapsed && !expanded ? (
        <div
          data-testid={WARD_PREOP_TEST_IDS.pacInvestigationChip}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
        >
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex min-w-0 flex-1 items-center gap-2 text-left text-xs text-gray-700 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-md"
          >
            <Microscope className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden="true" />
            <span className="font-medium">{chipLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
          </button>
          {onEditInInvestigations && (
            <button
              type="button"
              data-testid={WARD_PREOP_TEST_IDS.pacInvestigationEditLink}
              onClick={onEditInInvestigations}
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              Edit in Investigations
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Microscope className="h-3.5 w-3.5 text-violet-600" />
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Investigation Summary (§1 — read-only)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {defaultCollapsed && (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="text-[11px] font-medium text-gray-500 hover:text-gray-700"
                >
                  Collapse
                </button>
              )}
              {onEditInInvestigations && (
                <button
                  type="button"
                  data-testid={WARD_PREOP_TEST_IDS.pacInvestigationEditLink}
                  onClick={onEditInInvestigations}
                  className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  Edit in Investigations
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {unverified.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Unverified critical investigations</p>
                <p className="mt-0.5 text-amber-800">
                  {unverified.join(', ')} — ward verification recommended before PAC sign-off.
                </p>
              </div>
            </div>
          )}

          {applicable.length === 0 ? (
            <p className="text-xs text-gray-500">No applicable investigations for this journey.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
                    <th className="px-3 py-2 text-left font-medium">Test</th>
                    <th className="px-3 py-2 text-left font-medium">Result</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {applicable.map(item => {
                    const hasValue = !!item.resultValue?.trim();
                    return (
                      <tr
                        key={item.itemKey}
                        className={
                          item.isCritical && item.entryStatus !== 'verified' ? 'bg-amber-50/40' : ''
                        }
                      >
                        <td className="px-3 py-2 text-gray-800">
                          {item.itemLabel}
                          {item.isCritical && (
                            <span className="ml-1 text-[10px] font-semibold text-red-600">Critical</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {hasValue ? (
                            <>
                              {item.resultValue}
                              {item.resultUnit ? ` ${item.resultUnit}` : ''}
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(item.entryStatus, hasValue)}`}
                          >
                            {statusLabel(item.entryStatus)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-gray-500">
            Values are entered and verified in §1 Investigations. PAC no longer duplicates lab entry.
          </p>
        </>
      )}
    </section>
  );
}
