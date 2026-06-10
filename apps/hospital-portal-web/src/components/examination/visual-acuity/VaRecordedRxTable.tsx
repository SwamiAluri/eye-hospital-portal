'use client';

import { cn } from '@/lib/utils';

export interface VaRecordedEyeRx {
  sphere?: string;
  cylinder?: string;
  axis?: string;
  va?: string;
}

interface VaRecordedRxTableProps {
  od?: VaRecordedEyeRx;
  os?: VaRecordedEyeRx;
  showVa?: boolean;
  /** Column headers after eye label. Default S, C, A [, VA]. */
  headers?: string[];
  compact?: boolean;
  className?: string;
}

function cell(v?: string | number | null) {
  if (v == null) return '—';
  const s = String(v).trim();
  return s || '—';
}

export function VaRecordedRxTable({
  od,
  os,
  showVa = true,
  headers,
  compact = false,
  className,
}: VaRecordedRxTableProps) {
  const baseHeaders = headers ?? (showVa ? ['S', 'C', 'A', 'VA'] : ['S', 'C', 'A']);
  const cols = showVa && !headers ? baseHeaders : baseHeaders.filter((h) => h !== 'VA' || showVa);
  const showVaCol = showVa && (headers ? headers.includes('VA') : true);
  const pad = compact ? 'px-1.5 py-1' : 'px-2 py-1.5';
  const text = compact ? 'text-[10px]' : 'text-xs';

  const row = (label: string, eye: VaRecordedEyeRx | undefined, accent: 'od' | 'os') => (
    <tr className={accent === 'od' ? 'bg-blue-50/40' : 'bg-emerald-50/40'}>
      <th
        scope="row"
        className={cn(
          pad,
          text,
          'font-semibold text-left border-b border-slate-100',
          accent === 'od' ? 'text-blue-900' : 'text-emerald-900',
        )}
      >
        {label}
      </th>
      <td className={cn(pad, text, 'font-mono text-slate-800 border-b border-slate-100 text-center')}>
        {cell(eye?.sphere)}
      </td>
      <td className={cn(pad, text, 'font-mono text-slate-800 border-b border-slate-100 text-center')}>
        {cell(eye?.cylinder)}
      </td>
      <td className={cn(pad, text, 'font-mono text-slate-800 border-b border-slate-100 text-center')}>
        {cell(eye?.axis)}
      </td>
      {showVaCol && (
        <td className={cn(pad, text, 'font-mono text-slate-800 border-b border-slate-100 text-center')}>
          {cell(eye?.va)}
        </td>
      )}
    </tr>
  );

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-slate-200', className)}>
      <table className={cn('w-full border-collapse', text)}>
        <thead>
          <tr className="bg-slate-50">
            <th className={cn(pad, 'font-medium text-slate-500 text-left border-b border-slate-200')} />
            {cols.map((c) => (
              <th
                key={c}
                className={cn(pad, 'font-semibold text-slate-600 border-b border-slate-200 text-center')}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {row('OD', od, 'od')}
          {row('OS', os, 'os')}
        </tbody>
      </table>
    </div>
  );
}

interface VaRecordedVaTableProps {
  od?: { unaided?: string; aided?: string };
  os?: { unaided?: string; aided?: string };
  col1Label?: string;
  col2Label?: string;
  compact?: boolean;
  className?: string;
}

export function VaRecordedVaTable({
  od,
  os,
  col1Label = 'Unaided',
  col2Label = 'Aided',
  compact = false,
  className,
}: VaRecordedVaTableProps) {
  const pad = compact ? 'px-1.5 py-1' : 'px-2 py-1.5';
  const text = compact ? 'text-[10px]' : 'text-xs';

  const row = (label: string, eye: { unaided?: string; aided?: string } | undefined, accent: 'od' | 'os') => (
    <tr className={accent === 'od' ? 'bg-blue-50/40' : 'bg-emerald-50/40'}>
      <th
        scope="row"
        className={cn(
          pad,
          text,
          'font-semibold text-left border-b border-slate-100',
          accent === 'od' ? 'text-blue-900' : 'text-emerald-900',
        )}
      >
        {label}
      </th>
      <td className={cn(pad, text, 'font-mono text-slate-800 border-b border-slate-100 text-center')}>
        {cell(eye?.unaided)}
      </td>
      <td className={cn(pad, text, 'font-mono text-slate-800 border-b border-slate-100 text-center')}>
        {cell(eye?.aided)}
      </td>
    </tr>
  );

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-slate-200', className)}>
      <table className={cn('w-full border-collapse', text)}>
        <thead>
          <tr className="bg-slate-50">
            <th className={cn(pad, 'font-medium text-slate-500 text-left border-b border-slate-200')} />
            <th className={cn(pad, 'font-semibold text-slate-600 border-b border-slate-200 text-center')}>
              {col1Label}
            </th>
            <th className={cn(pad, 'font-semibold text-slate-600 border-b border-slate-200 text-center')}>
              {col2Label}
            </th>
          </tr>
        </thead>
        <tbody>
          {row('OD', od, 'od')}
          {row('OS', os, 'os')}
        </tbody>
      </table>
    </div>
  );
}

export function rxFromHistoryRecord(
  rec: Record<string, unknown>,
  eye: 'OD' | 'OS',
): VaRecordedEyeRx | undefined {
  const finalRx = rec.finalRx as Record<string, Record<string, unknown>> | undefined;
  const startingRx = rec.startingRx as Record<string, Record<string, unknown>> | undefined;
  const eyeData = finalRx?.[eye] ?? startingRx?.[eye];
  if (!eyeData) return undefined;
  return {
    sphere: eyeData.sphere != null ? String(eyeData.sphere) : '',
    cylinder: eyeData.cylinder != null ? String(eyeData.cylinder) : '',
    axis: eyeData.axis != null ? String(eyeData.axis) : '',
    va: eyeData.visualAcuity != null || eyeData.va != null ? String(eyeData.visualAcuity ?? eyeData.va) : '',
  };
}
