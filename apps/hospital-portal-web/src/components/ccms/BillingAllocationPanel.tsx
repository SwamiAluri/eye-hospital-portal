'use client';

import React, { useMemo } from 'react';
import { Building2, User, AlertTriangle, CheckCircle } from 'lucide-react';
import type { BillingWithAllocations, BillingSummary, CoverageAllocation } from '@/lib/api/ccms/ccms-billing.api';

export type { BillingWithAllocations, BillingSummary, CoverageAllocation };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, variant,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode;
  variant: 'green' | 'red' | 'amber' | 'blue' | 'gray';
}) {
  const palette = {
    green: 'bg-green-50 border-green-100 text-green-700',
    red:   'bg-red-50   border-red-100   text-red-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    blue:  'bg-indigo-50 border-indigo-100 text-indigo-700',
    gray:  'bg-gray-50  border-gray-100  text-gray-600',
  }[variant];

  return (
    <div className={`rounded-xl border p-3 ${palette}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <p className="text-base font-bold">{value}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  data: BillingWithAllocations;
  className?: string;
}

export function BillingAllocationPanel({ data, className = '' }: Props) {
  const { summary: s, allocations } = data;

  const coveragePct = pct(s.insuranceShareAmount, s.totalBillAmount);
  const patientPct  = pct(s.patientShareAmount, s.totalBillAmount);
  const disallowPct = pct(s.disallowedAmount, s.totalBillAmount);

  const disallowedItems = useMemo(
    () => allocations.filter(a => a.disallowedAmount > 0),
    [allocations],
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label="Total Bill"
          value={inr(s.totalBillAmount)}
          icon={<Building2 className="w-3.5 h-3.5" />}
          variant="blue"
        />
        <StatCard
          label="Insurance Pays"
          value={inr(s.insuranceShareAmount)}
          sub={`${coveragePct}% of bill`}
          icon={<CheckCircle className="w-3.5 h-3.5" />}
          variant="green"
        />
        <StatCard
          label="Patient Payable"
          value={inr(s.patientShareAmount)}
          sub={`${patientPct}% of bill`}
          icon={<User className="w-3.5 h-3.5" />}
          variant="red"
        />
        {s.disallowedAmount > 0 && (
          <StatCard
            label="Disallowed"
            value={inr(s.disallowedAmount)}
            sub={`${disallowPct}% of bill`}
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            variant="amber"
          />
        )}
      </div>

      {/* Coverage bar */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>Coverage breakdown</span>
          <span>{inr(s.insuranceShareAmount)} / {inr(s.totalBillAmount)}</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${coveragePct}%` }}
            title={`Insurance: ${coveragePct}%`}
          />
          {s.disallowedAmount > 0 && (
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${disallowPct}%` }}
              title={`Disallowed: ${disallowPct}%`}
            />
          )}
          <div
            className="h-full bg-red-400 transition-all flex-1"
            title={`Patient: ${patientPct}%`}
          />
        </div>
        <div className="flex gap-3 mt-1.5">
          {[
            { color: 'bg-green-500', label: `Insurance ${coveragePct}%` },
            ...(s.disallowedAmount > 0 ? [{ color: 'bg-amber-400', label: `Disallowed ${disallowPct}%` }] : []),
            { color: 'bg-red-400', label: `Patient ${patientPct}%` },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-[10px] text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Adjustments */}
      {(s.copayAmount > 0 || s.deductibleAmount > 0) && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
          <p className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Adjustments</p>
          {s.copayAmount > 0 && (
            <div className="flex justify-between px-3 py-2 text-xs">
              <span className="text-gray-500">Co-pay</span>
              <span className="font-medium text-amber-700">{inr(s.copayAmount)}</span>
            </div>
          )}
          {s.deductibleAmount > 0 && (
            <div className="flex justify-between px-3 py-2 text-xs">
              <span className="text-gray-500">Deductible</span>
              <span className="font-medium text-amber-700">{inr(s.deductibleAmount)}</span>
            </div>
          )}
        </div>
      )}

      {/* Line-item breakdown */}
      {allocations.length > 0 && (
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Line Item</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Billed</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium text-green-600">Covered</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium text-red-600">Patient</th>
                {disallowedItems.length > 0 && (
                  <th className="text-right px-3 py-2 text-gray-500 font-medium text-amber-600">Disallowed</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allocations.map(a => (
                <tr key={a.id} className={a.disallowedAmount > 0 ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{a.lineItemDescription}</div>
                    {a.lineItemCode && (
                      <div className="text-[10px] text-gray-400">{a.lineItemCode} · {a.lineItemType}</div>
                    )}
                    {a.disallowedReason && (
                      <div className="text-[10px] text-amber-600 mt-0.5">{a.disallowedReason}</div>
                    )}
                  </td>
                  <td className="text-right px-3 py-2 tabular-nums text-gray-700">{inr(a.billedAmount)}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-green-700 font-medium">{inr(a.coveredAmount)}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-red-700">{inr(a.patientPayable)}</td>
                  {disallowedItems.length > 0 && (
                    <td className="text-right px-3 py-2 tabular-nums text-amber-700">
                      {a.disallowedAmount > 0 ? inr(a.disallowedAmount) : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
              <tr>
                <td className="px-3 py-2 text-gray-700">Total</td>
                <td className="text-right px-3 py-2 tabular-nums text-gray-800">{inr(s.totalBillAmount)}</td>
                <td className="text-right px-3 py-2 tabular-nums text-green-700">{inr(s.insuranceShareAmount)}</td>
                <td className="text-right px-3 py-2 tabular-nums text-red-700">{inr(s.patientShareAmount)}</td>
                {disallowedItems.length > 0 && (
                  <td className="text-right px-3 py-2 tabular-nums text-amber-700">{inr(s.disallowedAmount)}</td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
