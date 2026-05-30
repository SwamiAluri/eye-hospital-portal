'use client';

import React, { useMemo } from 'react';
import { AlertCircle, Info } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TaxLineItem {
  label: string;
  amount: number;
  taxable?: boolean; // whether service tax applies on this line
}

export interface EstimateTaxBreakdown {
  estimatedMedicalCost: number;  // gross medical/procedure cost
  serviceTaxApplicable: boolean;
  serviceTaxPercent: number;     // e.g. 18 for 18%
  approvedAmount: number;        // insurance pre-auth approved amount
  copayAmount?: number;          // fixed copay if any
  copayPercent?: number;         // percentage copay if any
  deductibleAmount?: number;
  roomRentLimit?: number;
  lineItems?: TaxLineItem[];
}

export interface EstimateTaxResult {
  grossMedical: number;
  serviceTaxAmount: number;
  totalWithTax: number;
  insurancePays: number;
  copayAmount: number;
  deductibleAmount: number;
  patientPayable: number;
  coveragePercent: number;       // 0–100
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure calculation helper (exported for form hooks / tests)
// ─────────────────────────────────────────────────────────────────────────────

export function computeEstimate(input: EstimateTaxBreakdown): EstimateTaxResult {
  const gross = input.estimatedMedicalCost;

  // Service tax is levied on the insurer's share (as per standard practice).
  const insurancePaysBefore = Math.min(input.approvedAmount, gross);
  const taxAmount = input.serviceTaxApplicable
    ? Math.round(((insurancePaysBefore * input.serviceTaxPercent) / 100) * 100) / 100
    : 0;

  const totalWithTax = gross + taxAmount;

  // Copay
  const copay =
    input.copayAmount ??
    (input.copayPercent ? Math.round(((gross * input.copayPercent) / 100) * 100) / 100 : 0);

  const deductible = input.deductibleAmount ?? 0;

  // Insurance pays: approved amount + tax – copay – deductible (floor at 0)
  const insurancePays = Math.max(0, insurancePaysBefore + taxAmount - copay - deductible);
  const patientPayable = Math.max(0, totalWithTax - insurancePays);
  const coveragePercent = totalWithTax > 0 ? Math.round((insurancePays / totalWithTax) * 100) : 0;

  return {
    grossMedical: gross,
    serviceTaxAmount: taxAmount,
    totalWithTax,
    insurancePays,
    copayAmount: copay,
    deductibleAmount: deductible,
    patientPayable,
    coveragePercent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface RowProps { label: string; value: string; sub?: string; highlight?: 'green' | 'red' | 'amber' | 'blue' }

function SummaryRow({ label, value, sub, highlight }: RowProps) {
  const valueClasses = {
    green: 'text-green-700 font-bold',
    red:   'text-red-700 font-bold',
    amber: 'text-amber-700 font-bold',
    blue:  'text-indigo-700 font-bold',
    none:  'text-gray-800',
  }[highlight ?? 'none'];

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <div>
        <span className="text-xs text-gray-600">{label}</span>
        {sub && <span className="ml-1.5 text-[10px] text-gray-400">{sub}</span>}
      </div>
      <span className={`text-sm tabular-nums ${valueClasses}`}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  breakdown: EstimateTaxBreakdown;
  /** Set to true when the payer has service tax enabled */
  showTaxNote?: boolean;
  className?: string;
  compact?: boolean;
}

export function EstimateTaxSummary({ breakdown, showTaxNote, className = '', compact }: Props) {
  const result = useMemo(() => computeEstimate(breakdown), [breakdown]);

  const coveragePct = result.coveragePercent;
  const barColor =
    coveragePct >= 80 ? 'bg-green-500' :
    coveragePct >= 50 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden ${className}`}>
      {/* Coverage bar header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>Insurance covers {coveragePct}%</span>
          <span>{inr(result.insurancePays)} / {inr(result.totalWithTax)}</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${coveragePct}%` }}
          />
        </div>
      </div>

      {/* Line-by-line breakdown */}
      <div className="px-4 pb-3">
        <SummaryRow label="Estimated Medical Cost" value={inr(result.grossMedical)} />

        {breakdown.serviceTaxApplicable && (
          <SummaryRow
            label="Service Tax"
            sub={`@ ${breakdown.serviceTaxPercent}%`}
            value={`+ ${inr(result.serviceTaxAmount)}`}
            highlight="amber"
          />
        )}

        <SummaryRow
          label="Total (incl. tax)"
          value={inr(result.totalWithTax)}
          highlight="blue"
        />

        <div className="my-1 border-t border-dashed border-gray-200" />

        <SummaryRow
          label="Insurance Approved"
          sub={`pre-auth`}
          value={inr(breakdown.approvedAmount)}
        />

        {result.copayAmount > 0 && (
          <SummaryRow
            label="Co-pay"
            sub={breakdown.copayPercent ? `${breakdown.copayPercent}%` : 'fixed'}
            value={`– ${inr(result.copayAmount)}`}
            highlight="amber"
          />
        )}

        {result.deductibleAmount > 0 && (
          <SummaryRow
            label="Deductible"
            value={`– ${inr(result.deductibleAmount)}`}
            highlight="amber"
          />
        )}

        <SummaryRow
          label="Insurance Pays"
          value={inr(result.insurancePays)}
          highlight="green"
        />

        <div className="my-1 border-t border-gray-200" />

        <SummaryRow
          label="Patient Payable"
          value={inr(result.patientPayable)}
          highlight={result.patientPayable > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Service tax note */}
      {breakdown.serviceTaxApplicable && showTaxNote && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 p-2.5">
            <Info className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-700">
              Service tax of {breakdown.serviceTaxPercent}% is charged on the insurer's approved share
              as required for this payer type. Confirm with the Insurance Cell before final billing.
            </p>
          </div>
        </div>
      )}

      {!compact && breakdown.lineItems && breakdown.lineItems.length > 0 && (
        <details className="px-4 pb-3">
          <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">
            Show cost breakdown ({breakdown.lineItems.length} items)
          </summary>
          <div className="mt-2 space-y-1">
            {breakdown.lineItems.map((item, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span className="text-gray-600">{item.label}</span>
                <span className="tabular-nums text-gray-800">{inr(item.amount)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
