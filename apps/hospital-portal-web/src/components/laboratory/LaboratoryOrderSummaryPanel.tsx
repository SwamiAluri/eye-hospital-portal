'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import {
  laboratoryCatalogApi,
  type LaboratoryCommercialState,
  type LaboratoryOrderSummaryDto,
} from '@/lib/api/laboratory-catalog.api';
import type { CatalogSelection } from '@/components/laboratory/LaboratoryCatalogPicker';
import { cn } from '@/lib/utils';

export interface LaboratoryOrderSummaryPanelProps {
  selectedItems: CatalogSelection[];
  patientLabel?: string | null;
  patientMrn?: string | null;
  canViewFinancialAmounts: boolean;
  className?: string;
}

const COMMERCIAL_BADGE: Record<LaboratoryCommercialState, string> = {
  MAPPED: 'bg-emerald-100 text-emerald-800',
  UNMAPPED: 'bg-amber-100 text-amber-900',
  NON_BILLABLE: 'bg-slate-200 text-slate-800',
  UNPRICED: 'bg-orange-100 text-orange-900',
};

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function selectionPayload(items: CatalogSelection[]) {
  return items.map((item) =>
    item.kind === 'test'
      ? { testDefinitionId: item.test.id }
      : { panelId: item.panel.id },
  );
}

function selectionSignature(items: CatalogSelection[]): string {
  return items
    .map((item) => (item.kind === 'test' ? `test:${item.test.id}` : `panel:${item.panel.id}`))
    .join('|');
}

/** L3-UX-01 integrated Order Summary rail (Counselling estimate structural pattern). */
export function LaboratoryOrderSummaryPanel({
  selectedItems,
  patientLabel,
  patientMrn,
  canViewFinancialAmounts,
  className,
}: LaboratoryOrderSummaryPanelProps) {
  const [summary, setSummary] = useState<LaboratoryOrderSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signature = useMemo(() => selectionSignature(selectedItems), [selectedItems]);

  useEffect(() => {
    if (selectedItems.length === 0) {
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    laboratoryCatalogApi
      .getOrderSummary({ items: selectionPayload(selectedItems) })
      .then((res) => {
        if (!cancelled) setSummary(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSummary(null);
          setError(getApiErrorMessage(err) || 'Could not load order summary.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // signature tracks selection identity without depending on array referential churn
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedItems read via signature
  }, [signature]);

  const amountsVisible = Boolean(summary?.financialAmountsVisible && canViewFinancialAmounts);
  const stateCounts = useMemo(() => {
    const counts: Partial<Record<LaboratoryCommercialState, number>> = {};
    for (const line of summary?.lines ?? []) {
      const state = (line.commercialState ?? 'UNMAPPED') as LaboratoryCommercialState;
      counts[state] = (counts[state] ?? 0) + 1;
    }
    return counts;
  }, [summary]);

  return (
    <aside
      className={cn(
        'flex min-h-0 min-w-0 flex-col overflow-hidden border-border bg-slate-50/80',
        'border-t lg:border-l lg:border-t-0',
        className,
      )}
      data-testid="laboratory-order-summary-panel"
      aria-label="Order summary"
    >
      <div className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-4">
        <header className="mb-3 shrink-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-emerald-700" aria-hidden />
            Order Summary
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground" data-testid="laboratory-order-summary-count">
            {selectedItems.length} selected
            {summary ? ` · ${summary.lineCount} line${summary.lineCount === 1 ? '' : 's'}` : ''}
          </p>
          {(patientLabel || patientMrn) && (
            <p
              className="mt-1 truncate text-xs text-muted-foreground"
              data-testid="laboratory-order-summary-patient"
            >
              {patientLabel}
              {patientMrn ? ` · MRN ${patientMrn}` : ''}
            </p>
          )}
        </header>

        <div
          className="counsellor-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain"
          data-testid="laboratory-order-summary-body"
        >
          {selectedItems.length === 0 && (
            <div
              className="rounded-lg border border-dashed border-border bg-white px-3 py-6 text-center text-xs text-muted-foreground"
              data-testid="laboratory-order-summary-empty"
            >
              Select tests to preview commercial readiness and estimate.
            </div>
          )}

          {selectedItems.length > 0 && loading && (
            <p className="text-xs text-muted-foreground" data-testid="laboratory-order-summary-loading">
              Updating summary…
            </p>
          )}

          {error && (
            <p className="text-xs text-destructive" role="alert" data-testid="laboratory-order-summary-error">
              {error}
            </p>
          )}

          {summary && !error && (
            <>
              <section
                className="rounded-lg border border-border bg-white p-3 shadow-sm"
                data-testid="laboratory-order-summary-overview-card"
              >
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Readiness
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(
                    ['MAPPED', 'UNMAPPED', 'NON_BILLABLE', 'UNPRICED'] as LaboratoryCommercialState[]
                  ).map((state) =>
                    stateCounts[state] ? (
                      <span
                        key={state}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          COMMERCIAL_BADGE[state],
                        )}
                      >
                        {state} · {stateCounts[state]}
                      </span>
                    ) : null,
                  )}
                </div>
              </section>

              <section aria-labelledby="lab-summary-items-heading">
                <h3
                  id="lab-summary-items-heading"
                  className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Selected tests
                </h3>
                <ul className="space-y-2" data-testid="laboratory-order-summary-lines">
                  {summary.lines.map((line) => {
                    const state = (line.commercialState ?? 'UNMAPPED') as LaboratoryCommercialState;
                    return (
                      <li
                        key={`${line.panelId ?? 'test'}:${line.testDefinitionId}`}
                        className="rounded-lg border border-border bg-white p-3 shadow-sm"
                        data-testid={`laboratory-order-summary-line-${line.testDefinitionId}`}
                        data-commercial-state={state}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              <span data-testid="laboratory-order-summary-line-code">{line.localCode}</span>
                              {line.category ? ` · ${line.category}` : ''}
                              {line.panelName ? (
                                <span data-testid="laboratory-order-summary-panel-context">
                                  {' '}
                                  · Panel {line.panelName}
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                              COMMERCIAL_BADGE[state] ?? COMMERCIAL_BADGE.UNMAPPED,
                            )}
                            data-testid="laboratory-order-summary-commercial-state"
                          >
                            {state}
                          </span>
                        </div>

                        {line.serviceVariantCode || line.serviceVariantName ? (
                          <p
                            className="mt-1 truncate text-[11px] text-muted-foreground"
                            data-testid="laboratory-order-summary-variant"
                          >
                            {[line.serviceVariantCode, line.serviceVariantName]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        ) : null}

                        {amountsVisible && line.unitPrice != null && (
                          <div
                            className="mt-1.5 flex items-baseline justify-between gap-2 text-xs"
                            data-testid="laboratory-order-summary-line-price"
                          >
                            <span className="text-muted-foreground">
                              {formatInr(line.unitPrice)} × {line.quantity}
                            </span>
                            {line.lineEstimate != null && (
                              <span className="font-medium tabular-nums text-foreground">
                                {formatInr(line.lineEstimate)}
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section
                className="rounded-lg border border-border bg-white p-3 shadow-sm"
                data-testid="laboratory-order-summary-estimate"
                aria-labelledby="lab-summary-estimate-heading"
              >
                <h3
                  id="lab-summary-estimate-heading"
                  className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Estimate
                </h3>
                {!amountsVisible ? (
                  <p
                    className="mt-2 text-xs text-muted-foreground"
                    data-testid="laboratory-order-summary-amounts-hidden"
                  >
                    Amounts are not shown for this role.
                  </p>
                ) : (
                  <>
                    <p
                      className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground"
                      data-testid="laboratory-order-summary-estimate-total"
                    >
                      {summary.estimateTotal != null ? formatInr(summary.estimateTotal) : '—'}
                    </p>
                    {summary.estimateTotal == null && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Total unavailable until mapped lines have resolved prices.
                      </p>
                    )}
                    {summary.estimateTotal != null &&
                      summary.lines.some((l) => l.lineEstimate == null) && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Partial estimate — only priced lines are included.
                        </p>
                      )}
                  </>
                )}
              </section>

              <p className="text-[11px] text-muted-foreground" data-testid="laboratory-order-summary-disclaimer">
                Read-only estimate. Does not create bills, charges, or payments.
              </p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
