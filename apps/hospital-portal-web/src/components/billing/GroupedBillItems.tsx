'use client';

import { useMemo, useState } from 'react';
import {
  type ChargeLineItem,
  formatInr,
  groupBillItems,
} from '@/lib/billing/group-bill-items';
import {
  formatWorkstationDate,
  packageInclusionLabel,
} from '@/lib/billing/workstation-model';

export function GroupedBillItems({
  items,
  emptyLabel = 'No charge lines on this bill yet.',
  layout = 'compact',
}: {
  items: ChargeLineItem[];
  emptyLabel?: string;
  layout?: 'compact' | 'detail';
}) {
  const groups = useMemo(() => groupBillItems(items), [items]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground px-1 py-2">{emptyLabel}</p>;
  }

  return (
    <div className="divide-y rounded-md border bg-white overflow-x-auto">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.sourceType] === true;
        return (
          <section key={group.sourceType} data-source-group={group.sourceType}>
            <div className="flex w-full items-center justify-between gap-3 px-3 py-2">
              <button
                type="button"
                className="bill-print-hide text-sm font-semibold hover:underline"
                onClick={() =>
                  setCollapsed((prev) => ({
                    ...prev,
                    [group.sourceType]: !prev[group.sourceType],
                  }))
                }
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? '▸' : '▾'} {group.label}
                <span className="ml-2 font-normal text-muted-foreground">
                  ({group.items.length})
                </span>
              </button>
              <span className="bill-print-only text-sm font-semibold">
                {group.label}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatInr(group.subtotal)}
              </span>
            </div>
            {!isCollapsed && (
              <table className="w-full text-sm min-w-[640px]">
                {layout === 'detail' ? (
                  <thead>
                    <tr className="text-xs text-muted-foreground border-t">
                      <th className="px-3 py-1.5 pl-7 text-left font-medium">Date</th>
                      <th className="px-3 py-1.5 text-left font-medium">Description</th>
                      <th className="px-3 py-1.5 text-left font-medium">Source</th>
                      <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                      <th className="px-3 py-1.5 text-right font-medium">Unit</th>
                      <th className="px-3 py-1.5 text-right font-medium">Total</th>
                      <th className="px-3 py-1.5 text-left font-medium">Package</th>
                      <th className="px-3 py-1.5 pr-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {group.items.map((line) =>
                    layout === 'detail' ? (
                      <tr key={line.id} className="border-t">
                        <td className="px-3 py-1.5 pl-7 whitespace-nowrap text-muted-foreground">
                          {formatWorkstationDate(line.performedAt)}
                        </td>
                        <td className="px-3 py-1.5">
                          {line.serviceName}
                          {line.notes ? (
                            <span className="block text-xs text-muted-foreground">{line.notes}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                          {group.label}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{line.quantity}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          {formatInr(line.unitPrice)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                          {formatInr(line.totalAmount)}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {packageInclusionLabel(line.sourceType)}
                        </td>
                        <td className="px-3 py-1.5 pr-3 whitespace-nowrap">
                          {line.status || '—'}
                        </td>
                      </tr>
                    ) : (
                      <tr key={line.id} className="border-t">
                        <td className="px-3 py-1.5 pl-7">
                          {line.serviceName}
                          {line.notes ? (
                            <span className="block text-xs text-muted-foreground">{line.notes}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          {line.quantity} × {formatInr(line.unitPrice)}
                        </td>
                        <td className="px-3 py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">
                          {formatInr(line.totalAmount)}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
