'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { uatSeederApi, type UatDashboardDto, type UatRowStatus } from '@/lib/api/uat-seeder.api';

const SPEEDS = { Fast: 4000, Normal: 10000, Slow: 20000 } as const;

export default function UatDataDashboardPage() {
  const router = useRouter();
  const branchId = useAuthStore(s => s.selectedBranchId ?? s.user?.branchId);
  const [status, setStatus] = useState<UatDashboardDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string>('');
  const [selected, setSelected] = useState<UatRowStatus | null>(null);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>('Normal');
  const demoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!branchId) return;
    try {
      setStatus(await uatSeederApi.status(branchId));
    } catch (e) {
      setLog(uatSeederApi.formatError(e));
    }
  }, [branchId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(label: string, fn: () => Promise<unknown>) {
    if (!branchId) return;
    setBusy(label);
    try {
      const result = await fn();
      setLog(JSON.stringify(result, null, 2));
      await refresh();
    } catch (e) {
      setLog(uatSeederApi.formatError(e));
    } finally {
      setBusy(null);
    }
  }

  function stopDemo() {
    if (demoRef.current) clearInterval(demoRef.current);
    demoRef.current = null;
  }

  function startDemo() {
    if (!selected?.journeyId || !branchId) return;
    stopDemo();
    demoRef.current = setInterval(() => {
      void uatSeederApi.simulate(branchId, 'next', { journeyId: selected.journeyId! })
        .then(() => refresh())
        .catch(e => setLog(uatSeederApi.formatError(e)));
    }, SPEEDS[speed]);
  }

  useEffect(() => () => stopDemo(), []);

  if (process.env.NODE_ENV === 'production') {
    return <div className="p-6">UAT tools are not available in production.</div>;
  }

  const clinical = status?.clinical ?? {};
  const counts: [string, string, string][] = [
    ['Total', String(status?.total ?? 0), '/dashboard/ip-management'],
    ['Expected', String(clinical.Expected ?? 0), '/dashboard/ip-management'],
    ['Admitted', String(clinical.Admitted ?? 0), '/dashboard/ip-management/ward'],
    ['Ready for OT', String(clinical.ReadyForSurgery ?? 0), '/dashboard/ip-management/ward'],
    ['Sent to OT', String(clinical.SentToOT ?? 0), '/dashboard/ip-management/operation-theatre'],
    ['In OT', String(clinical.InOT ?? 0), '/dashboard/ip-management/operation-theatre'],
    ['Post-Op', String(clinical.PostOp ?? 0), '/dashboard/ip-management/ward'],
    ['Ready D/C', String(clinical.ReadyForDischarge ?? 0), '/dashboard/ip-management'],
    ['Discharged', String(clinical.Discharged ?? 0), '/dashboard/ip-management'],
    ['Cancelled', String((clinical.CancelledSurgery ?? 0) + (clinical.AdmissionCancelled ?? 0)), '/dashboard/ip-management'],
    ['Beds occupied', String(status?.occupiedBeds ?? 0), '/dashboard/ip-management/ward'],
    ['Beds available', String(status?.availableBeds ?? 0), '/dashboard/ip-management/ward'],
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">UAT Data Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Development-only. Seeds real journeys through PatientJourney, Billing, beds, and CCMS paths.
          Seeder is disabled unless EnableUatDataSeeder=true on the IP service.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="rounded bg-slate-900 text-white px-3 py-2 text-sm disabled:opacity-50" disabled={!!busy} onClick={() => run('seed', () => uatSeederApi.seed(branchId!))}>Seed All</button>
        <button className="rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={!!busy} onClick={() => run('reset', () => uatSeederApi.reset(branchId!))}>Reset UAT Data</button>
        <button className="rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={!!busy} onClick={() => run('reseed', () => uatSeederApi.reseed(branchId!))}>Reset + Seed</button>
        <button className="rounded border px-3 py-2 text-sm" onClick={() => void refresh()}>Refresh counts</button>
        {busy && <span className="text-sm self-center">{busy}…</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {counts.map(([label, value, href]) => (
          <button key={label} type="button" className="rounded border p-3 text-left hover:bg-slate-50" onClick={() => router.push(href)}>
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-xl font-semibold">{value}</div>
          </button>
        ))}
      </div>

      <div className="rounded border p-4 space-y-3">
        <h2 className="font-medium">Realtime simulator</h2>
        <p className="text-sm text-slate-600">Select a UAT-IP row, then advance or start Live Demo. Events use the same APIs as the UI.</p>
        <div className="flex flex-wrap gap-2">
          {['admit', 'transfer-bed', 'send-to-ot', 'accept-ot', 'start-surgery', 'complete-surgery', 'post-op', 'ready-discharge', 'payment', 'refund', 'emergency-fc', 'discharge', 'lama', 'cancel'].map(action => (
            <button
              key={action}
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
              disabled={!selected?.journeyId || !!busy}
              onClick={() => run(action, () => uatSeederApi.simulate(branchId!, action, { journeyId: selected!.journeyId!, amount: 5000, paymentMode: 'Cash' }))}
            >
              {action}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <select className="border rounded px-2 py-1 text-sm" value={speed} onChange={e => setSpeed(e.target.value as keyof typeof SPEEDS)}>
            {Object.keys(SPEEDS).map(k => <option key={k}>{k}</option>)}
          </select>
          <button className="rounded bg-emerald-700 text-white px-3 py-1 text-sm" disabled={!selected?.journeyId} onClick={startDemo}>Start Live Demo</button>
          <button className="rounded border px-3 py-1 text-sm" onClick={stopDemo}>Stop</button>
          {selected && <span className="text-sm">{selected.code} — {selected.scenario}</span>}
        </div>
      </div>

      <div className="overflow-auto max-h-[420px] rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left p-2">Code</th>
              <th className="text-left p-2">Scenario</th>
              <th className="text-left p-2">State</th>
            </tr>
          </thead>
          <tbody>
            {(status?.rows ?? []).map(row => (
              <tr
                key={row.code}
                className={`cursor-pointer ${selected?.code === row.code ? 'bg-amber-50' : ''}`}
                onClick={() => setSelected(row)}
                onDoubleClick={() => row.journeyId && router.push(`/dashboard/ip-management/journey/${row.journeyId}`)}
              >
                <td className="p-2 font-mono">{row.code}</td>
                <td className="p-2">{row.scenario}</td>
                <td className="p-2">{row.clinicalState}{row.error ? ` — ${row.error}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {log && <pre className="text-xs bg-slate-950 text-slate-100 p-3 rounded overflow-auto max-h-64">{log}</pre>}
    </div>
  );
}
