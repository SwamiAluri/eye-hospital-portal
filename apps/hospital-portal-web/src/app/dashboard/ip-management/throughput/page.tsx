'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useSlotThroughputQuery } from '@/hooks/use-slot-throughput-query';
import { formatDurationMinutes } from '@/lib/ip-management/ip-slot-display';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SlotThroughputPage() {
  const router = useRouter();
  const branchId = useAuthStore(s => s.user?.branchId);
  const [from, setFrom] = useState(() => daysAgoIso(6));
  const [to, setTo] = useState(todayIso);

  const query = useSlotThroughputQuery({ branchId, from, to, enabled: Boolean(branchId) });
  const data = query.data;
  const error = query.error instanceof Error ? query.error.message : query.error ? 'Failed to load throughput' : '';

  const sessionRows = data?.bySession ?? [];
  const theatreRows = data?.byTheatre ?? [];
  const dayRows = data?.byDay ?? [];

  const csv = useMemo(() => {
    if (!data) return '';
    const lines = [
      'Dimension,Key,Assigned,Completed,Discharged,AvgArrivalToDischargeMinutes',
      `Safety,VitalsOutOfRangeAcknowledged,${data.vitalsOverrideCount ?? 0},,,`,
      `Safety,IolMismatchOverridden,${data.iolMismatchOverrideCount ?? 0},,,`,
      ...sessionRows.map(r => `Session,${r.label},${r.assignedCount},${r.completedCount},${r.dischargedCount},${r.avgArrivalToDischargeMinutes ?? ''}`),
      ...theatreRows.map(r => `Theatre,${r.label},${r.assignedCount},${r.completedCount},${r.dischargedCount},${r.avgArrivalToDischargeMinutes ?? ''}`),
      ...dayRows.map(r => `Day,${r.key},${r.assignedCount},${r.completedCount},${r.dischargedCount},${r.avgArrivalToDischargeMinutes ?? ''}`),
    ];
    return lines.join('\n');
  }, [data, sessionRows, theatreRows, dayRows]);

  function exportCsv() {
    if (!csv) return;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slot-throughput-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/ip-management/slots')}
            className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center">
                <Clock className="text-white" style={{ height: 18, width: 18 }} />
              </span>
              Slot throughput
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Arrival-to-discharge and theatre turnover from journey slots — not a second billing ledger.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
          <button onClick={() => void query.refetch()} disabled={query.isFetching} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={exportCsv} disabled={!data} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Export
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Cases assigned" value={String(data?.assignedCount ?? 0)} sub="One per journey-day" />
        <Kpi label="Completed" value={String(data?.completedCount ?? 0)} sub="Surgery ended" />
        <Kpi label="Avg arrival → discharge" value={formatDurationMinutes(data?.avgArrivalToDischargeMinutes)} sub={`Median ${formatDurationMinutes(data?.medianArrivalToDischargeMinutes)}`} />
        <Kpi label="Avg turnover" value={formatDurationMinutes(data?.avgTurnoverMinutes)} sub="Same theatre + session" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Active slots" value={String(data?.activeCount ?? 0)} />
        <Kpi label="Released / cancelled" value={String(data?.cancelledCount ?? 0)} />
        <Kpi label="Ready for OT" value={String(data?.readyCount ?? 0)} />
        <Kpi label="Discharged" value={String(data?.dischargedCount ?? 0)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Kpi
          label="Vitals warnings acknowledged"
          value={String(data?.vitalsOverrideCount ?? 0)}
          sub="Out-of-range vitals; still marked ready. Missing vitals are not counted."
          testId="throughput-kpi-vitals-override"
        />
        <Kpi
          label="IOL mismatch overrides"
          value={String(data?.iolMismatchOverrideCount ?? 0)}
          sub="Record implant proceeded despite planned/catalog mismatch."
          testId="throughput-kpi-iol-mismatch"
        />
      </div>

      <Breakdown title="By session" rows={sessionRows} />
      <Breakdown title="By theatre" rows={theatreRows} />
      <Breakdown title="By day" rows={dayRows} />

      <p className="text-xs text-gray-500">
        One-day board metrics stay on the{' '}
        <Link href="/dashboard/ip-management/slots" className="text-blue-700 font-medium hover:underline">slot board</Link>.
        Unbilled implants are on the{' '}
        <Link href="/dashboard/ip-management/billing" className="text-blue-700 font-medium hover:underline">billing dashboard</Link>.
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, testId }: { label: string; value: string; sub?: string; testId?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5" data-testid={testId}>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; assignedCount: number; completedCount: number; dischargedCount: number; avgArrivalToDischargeMinutes: number | null }[];
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Group</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Assigned</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Completed</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Discharged</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Avg arrival→discharge</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="py-8 text-center text-gray-400">No slots in this range</td></tr>
          ) : rows.map(r => (
            <tr key={r.key}>
              <td className="px-4 py-3">{r.label}</td>
              <td className="px-4 py-3 text-right">{r.assignedCount}</td>
              <td className="px-4 py-3 text-right">{r.completedCount}</td>
              <td className="px-4 py-3 text-right">{r.dischargedCount}</td>
              <td className="px-4 py-3 text-right">{formatDurationMinutes(r.avgArrivalToDischargeMinutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
