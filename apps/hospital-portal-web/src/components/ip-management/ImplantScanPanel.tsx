'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ScanLine } from 'lucide-react';
import {
  ipManagementApi,
  ImplantUsageDto,
  RecordImplantRequest,
  formatApiError,
} from '@/lib/api/ip-management.api';
import { toast } from 'react-hot-toast';
import { ReasonConfirmDialog } from '@/components/ip-management/ReasonConfirmDialog';
import { usePermissions } from '@/hooks/use-permissions';
import { resolveIpRoleActions } from '@/lib/ip-management/ip-role-actions';
import {
  describeIolMismatch,
  formatIolDiopter,
  parseIolDiopter,
} from '@/lib/ip-management/iol-diopter';
import {
  GS1_UNREADABLE_MESSAGE,
  formatGs1Expiry,
  parseGs1Barcode,
  type Gs1ParseResult,
} from '@/lib/ip-management/gs1-barcode';

const STATUSES: { id: RecordImplantRequest['usageStatus']; label: string }[] = [
  { id: 'Implanted', label: 'Implanted' },
  { id: 'Opened_Unused', label: 'Opened, not used' },
  { id: 'Wasted', label: 'Wasted / damaged' },
  { id: 'Returned', label: 'Returned unopened' },
];

const REASONS = [
  'Wrong power',
  'Capsule rupture',
  'Contamination',
  'Damaged',
  'Other',
];

function normalizeEye(value: string | null | undefined): string {
  const raw = (value ?? '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'OD' || raw === 'OS' || raw === 'OU') return raw;
  if (raw === 'RE' || raw.includes('RIGHT')) return 'OD';
  if (raw === 'LE' || raw.includes('LEFT')) return 'OS';
  if (raw === 'BOTH' || raw.includes('BILAT')) return 'OU';
  return raw;
}

function statusLabel(status: string): string {
  return STATUSES.find(s => s.id === status)?.label ?? status;
}

export function ImplantScanPanel({
  journeyId,
  patientName,
  eyeOperated,
  procedureName,
  clinicalState,
  canRecord,
  readOnly,
  plannedIolPower,
  plannedIolModel,
}: {
  journeyId: string;
  patientName?: string | null;
  eyeOperated?: string | null;
  procedureName?: string | null;
  clinicalState?: string | null;
  canRecord: boolean;
  readOnly?: boolean;
  plannedIolPower?: string | null;
  plannedIolModel?: string | null;
}) {
  const operatingEye = normalizeEye(eyeOperated);
  const canWrite = canRecord && !readOnly
    && (clinicalState === 'InOT' || clinicalState === 'SurgeryCompleted');
  const permissions = usePermissions();
  const canOverrideMismatch = resolveIpRoleActions(permissions).canOverrideImplantMismatch;
  const plannedPower = parseIolDiopter(plannedIolPower);

  const [rows, setRows] = useState<ImplantUsageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [barcode, setBarcode] = useState('');
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [catalogRef, setCatalogRef] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [batch, setBatch] = useState('');
  const [power, setPower] = useState('');
  const [eye, setEye] = useState(operatingEye === 'OS' ? 'OS' : 'OD');
  const [usageStatus, setUsageStatus] = useState<RecordImplantRequest['usageStatus']>('Implanted');
  const [reason, setReason] = useState('');
  const [reasonOther, setReasonOther] = useState('');
  const [block, setBlock] = useState<string | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const [mismatchCopy, setMismatchCopy] = useState('');
  const [mismatchBusy, setMismatchBusy] = useState(false);
  const [mismatchError, setMismatchError] = useState<string | undefined>();
  const [gs1, setGs1] = useState<Gs1ParseResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await ipManagementApi.listImplants(journeyId));
    } finally {
      setLoading(false);
    }
  }, [journeyId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (operatingEye === 'OD' || operatingEye === 'OS') setEye(operatingEye);
  }, [operatingEye]);

  const eyeMismatch = useMemo(() => {
    const selected = normalizeEye(eye);
    if (!operatingEye || operatingEye === 'OU' || !selected) return false;
    return selected !== operatingEye;
  }, [eye, operatingEye]);

  const reasonRequired = usageStatus !== 'Implanted';
  const effectiveReason = reason === 'Other' ? reasonOther : reason;
  const scannedPower = parseIolDiopter(power);
  const mismatch = useMemo(
    () => describeIolMismatch({
      plannedPower,
      scannedPower,
      plannedModel: plannedIolModel,
      scannedModel: model,
      implanted: usageStatus === 'Implanted',
    }),
    [plannedPower, scannedPower, plannedIolModel, model, usageStatus],
  );
  const emptyPlanned = usageStatus === 'Implanted' && plannedPower == null;

  async function handleResolve() {
    const code = barcode.trim();
    if (!code) return;
    setResolving(true);
    setBlock(null);
    setGs1(null);
    try {
      const local = parseGs1Barcode(code);
      const res = await ipManagementApi.verifyIolBarcode(journeyId, { barcode: code });
      if (!res?.isValid) {
        const unreadable = local.unreadable || local.isGs1
          || (res?.message?.includes('could not be read') ?? false);
        if (unreadable) {
          setGs1({ ...local, unreadable: true, isGs1: true });
          setSerial('');
          setBatch('');
          setCatalogId(null);
        } else {
          setBlock(res?.message ?? GS1_UNREADABLE_MESSAGE);
        }
        return;
      }
      const parsed: Gs1ParseResult = {
        parsed: !!(res.gtin || res.serial) || local.parsed,
        unreadable: false,
        isGs1: !!(res.gtin || res.serial) || local.parsed,
        gtin: res.gtin ?? local.gtin,
        serial: res.serial ?? local.serial,
        lot: res.lot ?? local.lot,
        expiry: res.expiry ?? local.expiry,
        symbology: res.symbology ?? local.symbology,
      };
      setGs1(parsed.parsed ? parsed : null);
      setCatalogId(res.catalogId ?? null);
      setCatalogRef(res.productCode ?? parsed.gtin ?? code);
      setBrand(res.brand ?? '');
      setModel(res.model ?? res.catalogEntry ?? '');
      if (parsed.parsed && parsed.serial) {
        setSerial(parsed.serial);
      } else {
        setSerial(prev => prev || code);
      }
      if (parsed.lot) setBatch(parsed.lot);
      toast.success(res.message ?? 'Barcode resolved.');
    } catch (e) {
      setBlock(formatApiError(e, 'Could not resolve barcode.'));
    } finally {
      setResolving(false);
    }
  }

  async function postImplant(acknowledgeMismatch?: boolean, mismatchReason?: string) {
    const powerNum = parseIolDiopter(power);
    const dto = await ipManagementApi.recordImplant(journeyId, {
      itemId: catalogId ?? undefined,
      catalogRef: catalogRef || barcode.trim() || undefined,
      serialNumber: serial.trim() || undefined,
      batchNumber: batch.trim() || undefined,
      udiBarcode: barcode.trim() || undefined,
      power: powerNum ?? undefined,
      eye,
      usageStatus,
      wastageReason: reasonRequired ? effectiveReason.trim() : undefined,
      acknowledgeMismatch: acknowledgeMismatch || undefined,
      mismatchReason: mismatchReason || undefined,
    });
    setBarcode('');
    setSerial('');
    setBatch('');
    setPower('');
    setReason('');
    setReasonOther('');
    setUsageStatus('Implanted');
    setMismatchOpen(false);
    setMismatchError(undefined);
    setGs1(null);
    if (dto.warning) toast(dto.warning, { icon: '⚠️' });
    toast.success(usageStatus === 'Implanted'
      ? 'Implant recorded. Charge posts automatically.'
      : 'Write-off recorded. No patient charge.');
    await load();
  }

  async function handleRecord() {
    if (eyeMismatch) {
      setBlock(`This implant is marked ${eye}, the operating eye is ${operatingEye}. Recording is blocked.`);
      return;
    }
    if (reasonRequired && effectiveReason.trim().length < 3) {
      setBlock('Reason is required unless status is Implanted.');
      return;
    }
    if (!catalogId && !catalogRef.trim()) {
      setBlock('Resolve a barcode or enter a catalog reference before recording.');
      return;
    }
    if (mismatch.powerRequired) {
      setBlock('Power is required.');
      return;
    }
    if (mismatch.blocked) {
      if (!canOverrideMismatch) {
        setBlock(`${mismatch.message} Ask a surgeon to record this lens. Scan a different lens, or wait.`);
        return;
      }
      setMismatchCopy(mismatch.message ?? 'Lens does not match the plan.');
      setMismatchError(undefined);
      setMismatchOpen(true);
      return;
    }
    setSaving(true);
    setBlock(null);
    try {
      await postImplant();
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      const message = e instanceof Error ? e.message : 'Could not record implant.';
      if (status === 409 && canOverrideMismatch) {
        setMismatchCopy(message);
        setMismatchError(undefined);
        setMismatchOpen(true);
      } else {
        setBlock(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleMismatchConfirm(reasonText: string) {
    setMismatchBusy(true);
    setMismatchError(undefined);
    try {
      await postImplant(true, reasonText);
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      const message = e instanceof Error ? e.message : 'Could not record implant.';
      if (status === 401 || status === 403) {
        setMismatchOpen(false);
        setBlock('You do not have permission to override a lens mismatch. Ask a surgeon to record this lens.');
      } else {
        setMismatchError(message);
      }
    } finally {
      setMismatchBusy(false);
    }
  }

  async function handleReverse(usageId: string) {
    if (reverseReason.trim().length < 3) {
      toast.error('Reason is required to reverse an implant record.');
      return;
    }
    try {
      await ipManagementApi.updateImplant(journeyId, usageId, {
        usageStatus: 'Reversed',
        reason: reverseReason.trim(),
      });
      setReversingId(null);
      setReverseReason('');
      toast.success('Reversal recorded. A credit line will post; the original is kept.');
      await load();
    } catch (e) {
      toast.error(formatApiError(e, 'Could not reverse implant.'));
    }
  }

  const implantedCount = rows.filter(r => r.usageStatus === 'Implanted').length;

  return (
    <div className="ip-target panel space-y-4" data-testid="implant-scan-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <ScanLine className="h-3.5 w-3.5" /> Record implant
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {(patientName ?? 'Patient')} · operating eye <b>{operatingEye || '—'}</b>
            {procedureName ? ` · ${procedureName}` : ''}
          </p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
          {implantedCount} implanted
        </span>
      </div>

      {!canRecord && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          You need OT safety sign or surgery complete permission to record implants.
        </p>
      )}

      {canWrite && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Scan or enter barcode / UDI</label>
            <div className="flex gap-2">
              <input
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleResolve(); } }}
                placeholder="Scan UDI…"
                className="flex-1 font-mono border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => void handleResolve()} disabled={resolving || !barcode.trim()}
                className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50">
                {resolving ? '…' : 'Resolve'}
              </button>
            </div>
          </div>

          {gs1?.unreadable && (
            <div className="flex gap-2 text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {GS1_UNREADABLE_MESSAGE}
            </div>
          )}

          {gs1?.parsed && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs space-y-1">
              <p className="font-semibold text-slate-700">Parsed from GS1</p>
              <p className="flex justify-between gap-3"><span className="text-slate-500">GTIN</span><span className="font-mono text-slate-800">{gs1.gtin ?? '—'}</span></p>
              <p className="flex justify-between gap-3"><span className="text-slate-500">Serial</span><span className="font-mono text-slate-800">{gs1.serial ?? '—'}</span></p>
              <p className="flex justify-between gap-3"><span className="text-slate-500">Lot</span><span className="font-mono text-slate-800">{gs1.lot ?? '—'}</span></p>
              <p className="flex justify-between gap-3"><span className="text-slate-500">Expiry</span><span className="text-slate-800">{formatGs1Expiry(gs1.expiry)}</span></p>
            </div>
          )}

          {(brand || model) && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs space-y-1">
              <p className="font-semibold text-slate-700">Resolved</p>
              <p className="text-slate-800">{brand} {model}</p>
              {catalogRef && <p className="font-mono text-slate-500">{catalogRef}</p>}
              <p className="text-slate-600">
                Scanned power {scannedPower != null ? formatIolDiopter(scannedPower) : '—'}
                {' · '}Planned power {plannedPower != null ? formatIolDiopter(plannedPower) : 'not on journey'}
              </p>
              {(plannedIolModel || model) && (
                <p className="text-slate-600">
                  Scanned model {model || '—'}
                  {' · '}Planned model {plannedIolModel || 'not on journey'}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Serial</label>
              <input value={serial} onChange={e => setSerial(e.target.value)}
                placeholder={gs1?.unreadable ? 'Type serial' : undefined}
                className="w-full font-mono border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Batch</label>
              <input value={batch} onChange={e => setBatch(e.target.value)}
                className="w-full font-mono border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Power</label>
              <input value={power} onChange={e => setPower(e.target.value)} placeholder="+21.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">Eye</p>
            <div className="flex gap-3">
              {(['OD', 'OS'] as const).map(opt => (
                <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="radio" name={`implant-eye-${journeyId}`} checked={eye === opt} onChange={() => setEye(opt)} />
                  {opt} {opt === 'OD' ? '(right)' : '(left)'}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Must match the operating eye on the journey and consent.</p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">Status</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {STATUSES.map(s => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="radio" name={`implant-status-${journeyId}`} checked={usageStatus === s.id}
                    onChange={() => setUsageStatus(s.id)} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          {reasonRequired && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reason <span className="text-red-600">*</span>
              </label>
              <select value={reason} onChange={e => setReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Select reason…</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {reason === 'Other' && (
                <input value={reasonOther} onChange={e => setReasonOther(e.target.value)}
                  placeholder="Describe the reason"
                  className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              )}
            </div>
          )}

          <div className={`text-xs rounded-lg px-3 py-2 border ${
            usageStatus === 'Implanted'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {usageStatus === 'Implanted'
              ? 'Implanted → charge posts automatically. Stock deduction follows in inventory.'
              : 'Opened / wasted → hospital write-off, no patient charge. Returned unopened is not wastage.'}
          </div>

          {emptyPlanned && (
            <div className="flex gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No planned IOL power is on this journey.
              {scannedPower != null ? ` Confirm ${formatIolDiopter(scannedPower)} with the surgeon.` : ' Confirm the lens power with the surgeon.'}
              {' '}Recording is allowed.
            </div>
          )}

          {eyeMismatch && (
            <div className="flex gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              This implant is marked {eye}, the operating eye is {operatingEye}. Recording is blocked.
            </div>
          )}
          {mismatch.blocked && !eyeMismatch && !canOverrideMismatch && (
            <div className="flex gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {mismatch.message} Ask a surgeon to record this lens. Scan a different lens, or wait.
            </div>
          )}
          {mismatch.blocked && !eyeMismatch && canOverrideMismatch && (
            <div className="flex gap-2 text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {mismatch.message} Recording is blocked unless you override with a reason.
            </div>
          )}
          {block && !eyeMismatch && (
            <div className="flex gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {block}
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" onClick={() => void handleRecord()}
              disabled={saving || eyeMismatch || (mismatch.blocked && !canOverrideMismatch)}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Recording…' : mismatch.blocked && canOverrideMismatch ? 'Record with override…' : 'Record implant'}
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Recorded implants</p>
        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-gray-400">None recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map(row => (
              <li key={row.id} className="rounded-lg border border-gray-100 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{row.brand} {row.model}</p>
                    <p className="font-mono text-gray-500">
                      {row.serialNumber ?? '—'} · {row.eye}
                      {row.power != null ? ` · ${formatIolDiopter(row.power)}` : ''}
                    </p>
                    <p className="text-gray-500 mt-0.5">
                      {statusLabel(row.usageStatus)}
                      {row.wastageReason ? ` · ${row.wastageReason}` : ''}
                    </p>
                  </div>
                  {canWrite && row.usageStatus === 'Implanted' && (
                    reversingId === row.id ? (
                      <div className="flex flex-col gap-1 min-w-[12rem]">
                        <input value={reverseReason} onChange={e => setReverseReason(e.target.value)}
                          placeholder="Reason"
                          className="border border-gray-300 rounded px-2 py-1 text-xs" />
                        <div className="flex gap-1 justify-end">
                          <button type="button" className="text-gray-500" onClick={() => setReversingId(null)}>Cancel</button>
                          <button type="button" className="text-red-700 font-semibold"
                            onClick={() => void handleReverse(row.id)}>Reverse</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="text-red-600 font-medium"
                        onClick={() => { setReversingId(row.id); setReverseReason(''); }}>
                        Reverse
                      </button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ReasonConfirmDialog
        open={mismatchOpen}
        onOpenChange={setMismatchOpen}
        title="Lens does not match the plan"
        patientName={patientName ?? undefined}
        patientMeta={operatingEye ? `Operating eye ${operatingEye}` : undefined}
        consequence={
          <>
            {mismatchCopy} Recording is blocked unless a surgeon overrides with a reason.
            Eye mismatch cannot be overridden this way.
          </>
        }
        confirmLabel="Record with override"
        cancelLabel="Scan a different lens"
        minReasonLength={10}
        destructive
        busy={mismatchBusy}
        error={mismatchError}
        onConfirm={reasonText => void handleMismatchConfirm(reasonText)}
      />
    </div>
  );
}

export async function implantCompletionSummary(journeyId: string): Promise<string> {
  const rows = await ipManagementApi.listImplants(journeyId);
  const implanted = rows.filter(r => r.usageStatus === 'Implanted').length;
  const writeOff = rows.filter(r => r.usageStatus === 'Opened_Unused' || r.usageStatus === 'Wasted').length;
  let msg = `${implanted} implant${implanted === 1 ? '' : 's'}, ${writeOff} write-off${writeOff === 1 ? '' : 's'} recorded. Charges post automatically.`;
  if (implanted === 0) {
    msg += ' No implant recorded for this procedure — this does not block completion.';
  }
  return msg;
}
