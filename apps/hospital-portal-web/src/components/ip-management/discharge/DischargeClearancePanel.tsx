'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ipManagementApi,
  type ChecklistGateResultDto,
  type PreauthStatusDto,
} from '@/lib/api/ip-management.api';
import { WARD_DISCHARGE_TEST_IDS } from '@/lib/ip-management/ward-discharge-test-ids';
import { AnaesthesiaMonitoringPanel } from '@/components/ip-management/AnaesthesiaMonitoringPanel';

function fmtINR(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

type FinSummary = NonNullable<Awaited<ReturnType<typeof ipManagementApi.getFinancialSummary>>>;

export interface DischargeClearancePanelProps {
  journeyId: string;
  readOnly?: boolean;
  canEditMonitoring?: boolean;
  onCollectNow?: () => void;
}

export function DischargeClearancePanel({
  journeyId,
  readOnly,
  canEditMonitoring = true,
  onCollectNow,
}: DischargeClearancePanelProps) {
  const [loading, setLoading] = useState(true);
  const [gates, setGates] = useState<ChecklistGateResultDto | null>(null);
  const [fin, setFin] = useState<FinSummary | null>(null);
  const [preauth, setPreauth] = useState<PreauthStatusDto | null>(null);
  const [summaryFinal, setSummaryFinal] = useState(false);
  const [nurseIssued, setNurseIssued] = useState(false);
  const [anaesOk, setAnaesOk] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, f, p, summary, postOp] = await Promise.all([
      ipManagementApi.getTransitionGates(journeyId, 'Discharged'),
      ipManagementApi.getFinancialSummary(journeyId),
      ipManagementApi.getPreauthStatus(journeyId),
      ipManagementApi.getDischargeSummary(journeyId),
      ipManagementApi.getWardPostOpChecklist(journeyId),
    ]);
    setGates(g);
    setFin(f);
    setPreauth(p);
    setSummaryFinal(summary?.summaryStatus === 'Final');
    const issued = postOp?.items.find(i => i.itemKey === 'discharge_summary_issued');
    setNurseIssued(!!issued?.isCompleted || !!issued?.isBypassed);
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patientDue = fin?.patientBalance ?? 0;
  const patientBlocks = patientDue > 0.5;
  const hardStops = (gates?.warnings ?? []).filter(w => w.severity === 'block');
  const clinicalBlocks = hardStops.filter(w => w.category === 'Clinical');
  const gateBlocks = hardStops.filter(w => w.category !== 'Clinical');

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading clearance…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Clearance</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Patient obligation gates discharge. TPA settlement does not.
          </p>
        </div>
        {(patientBlocks || hardStops.length > 0) && (
          <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium">
            {(patientBlocks ? 1 : 0) + hardStops.length} hard stop
            {(patientBlocks ? 1 : 0) + hardStops.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900">
        <b>Clinical discharge ≠ financial settlement.</b> Payer claims continue in Coverage &amp; Claims after the bed is released.
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {/* Clinical */}
        <div className="rounded-xl border border-gray-200 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Clinical</p>
          <ul className="space-y-1.5 text-sm">
            <ClearRow ok={nurseIssued} label="Post-op / nurse checklist issued" />
            <ClearRow ok={summaryFinal} label="Discharge summary finalized" />
            <ClearRow ok={anaesOk !== false} label="Anaesthesia / discharge clearance" />
            {clinicalBlocks.map(w => (
              <ClearRow key={w.code} ok={false} label={w.message} />
            ))}
            {gateBlocks.map(w => (
              <ClearRow key={w.code} ok={false} label={w.message} />
            ))}
            {clinicalBlocks.length === 0 && gateBlocks.length === 0 && nurseIssued && summaryFinal && (
              <li className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1.5 mt-1">Cleared.</li>
            )}
          </ul>
        </div>

        {/* Patient obligation */}
        <div className="rounded-xl border border-gray-200 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Patient obligation <span className="text-red-600 normal-case font-medium">— blocks</span>
          </p>
          {patientBlocks ? (
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2 text-red-800">
                <span aria-hidden>⛔</span>
                <span className="flex-1">
                  Patient due <b>{fmtINR(patientDue)}</b>
                  {onCollectNow && (
                    <button
                      type="button"
                      data-testid={WARD_DISCHARGE_TEST_IDS.collectLink}
                      onClick={onCollectNow}
                      className="ml-2 text-indigo-700 underline text-xs font-medium"
                    >
                      Collect now →
                    </button>
                  )}
                </span>
              </li>
            </ul>
          ) : (
            <ClearRow ok label={`Patient due ${fmtINR(0)}`} />
          )}
          <div className="text-xs text-gray-600 space-y-0.5 pt-1 border-t border-gray-100">
            <div className="flex justify-between"><span>Billed</span><span className="font-mono">{fmtINR(fin?.billedAmount)}</span></div>
            <div className="flex justify-between"><span>Collected</span><span className="font-mono">{fmtINR(fin?.totalCollected)}</span></div>
            <div className="flex justify-between"><span>Payer share</span><span className="font-mono">{fmtINR(fin?.insuranceResponsibility)}</span></div>
            <div className="flex justify-between font-semibold text-gray-900">
              <span>Patient due</span>
              <span className="font-mono">{fmtINR(patientDue)}</span>
            </div>
          </div>
        </div>

        {/* Coverage — informational */}
        <div className="rounded-xl border border-gray-200 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Coverage <span className="text-gray-400 normal-case font-normal">— informational</span>
          </p>
          <ul className="space-y-1.5 text-sm">
            <ClearRow
              ok={preauth?.allowed !== false && preauth?.warningLevel !== 'block'}
              label={
                preauth?.preAuthNumber
                  ? `Pre-authorisation · ${preauth.preAuthNumber}`
                  : preauth?.coverageStatus || preauth?.warningMessage || 'Coverage status'
              }
            />
            <li className="flex items-start gap-2 text-amber-800 text-sm">
              <span aria-hidden>⏳</span>
              <span>
                TPA settlement pending — <b>does not block discharge</b>
              </span>
            </li>
          </ul>
          <p className="text-xs text-gray-500">
            The claim continues after the patient goes home. Holding the bed would cost more than the receivable.
          </p>
        </div>
      </div>

      {(gates?.warnings ?? [])
        .filter(w => w.severity === 'warn')
        .slice(0, 4)
        .map(w => (
          <div key={w.code} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {w.message}
          </div>
        ))}

      <AnaesthesiaMonitoringPanel
        journeyId={journeyId}
        mode="discharge"
        readOnly={readOnly || !canEditMonitoring}
        onClearanceChange={setAnaesOk}
      />
    </div>
  );
}

function ClearRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-start gap-2 ${ok ? 'text-emerald-800' : 'text-red-800'}`}>
      <span aria-hidden>{ok ? '✓' : '⛔'}</span>
      <span>{label}</span>
    </li>
  );
}
