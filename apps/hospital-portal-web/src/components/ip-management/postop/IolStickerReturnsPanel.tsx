'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  type ImplantUsageDto,
  type IolReturnDto,
  type IolStickerChecksDto,
  type WardPostOpChecklistDto,
} from '@/lib/api/ip-management.api';

function statusBadge(status: string): string {
  switch (status) {
    case 'Implanted':
      return 'bg-emerald-50 text-emerald-700';
    case 'Opened_Unused':
    case 'Wasted':
      return 'bg-amber-50 text-amber-800';
    case 'Returned':
      return 'bg-sky-50 text-sky-700';
    case 'Reversed':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-50 text-gray-700';
  }
}

function fmtWhen(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function IolStickerReturnsPanel({
  journeyId,
  readOnly,
  onChanged,
}: {
  journeyId: string;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const [implants, setImplants] = useState<ImplantUsageDto[]>([]);
  const [returns, setReturns] = useState<IolReturnDto[]>([]);
  const [checklist, setChecklist] = useState<WardPostOpChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnBarcode, setReturnBarcode] = useState('');
  const [returnPower, setReturnPower] = useState('');
  const [savingReturn, setSavingReturn] = useState(false);
  const [savingSticker, setSavingSticker] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [imp, ret, cl] = await Promise.all([
      ipManagementApi.listImplants(journeyId),
      ipManagementApi.getIolReturns(journeyId),
      ipManagementApi.getWardPostOpChecklist(journeyId),
    ]);
    setImplants(imp);
    setReturns(ret);
    setChecklist(cl);
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sticker: IolStickerChecksDto = checklist?.iolStickerChecks ?? {
    barcodeScan: false,
    stickerInFile: false,
    inventoryMatch: false,
  };

  async function saveSticker(patch: Partial<IolStickerChecksDto>) {
    if (readOnly) return;
    setSavingSticker(true);
    const next = { ...sticker, ...patch };
    const updated = await ipManagementApi.saveIolStickerChecks(journeyId, next);
    setSavingSticker(false);
    if (!updated) {
      toast.error('Failed to save sticker checks');
      return;
    }
    setChecklist(updated);
    onChanged?.();
  }

  async function confirmWriteOff(row: ImplantUsageDto) {
    if (readOnly) return;
    setConfirmingId(row.id);
    try {
      await ipManagementApi.updateImplant(journeyId, row.id, {
        usageStatus: 'Wasted',
        reason: 'Opened unused — confirmed write-off on ward',
      });
      toast.success('Write-off recorded. Patient is not charged.');
      await load();
      onChanged?.();
    } catch {
      toast.error('Failed to confirm write-off');
    } finally {
      setConfirmingId(null);
    }
  }

  async function recordReturn() {
    if (readOnly || !returnReason.trim()) return;
    setSavingReturn(true);
    const created = await ipManagementApi.recordIolReturn(journeyId, {
      reason: returnReason.trim(),
      iolBarcode: returnBarcode.trim() || undefined,
      iolPower: returnPower.trim() || undefined,
    });
    setSavingReturn(false);
    if (!created) {
      toast.error('Failed to record return');
      return;
    }
    toast.success('Return recorded');
    setReturnOpen(false);
    setReturnReason('');
    setReturnBarcode('');
    setReturnPower('');
    await load();
    onChanged?.();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading implant registry…
      </div>
    );
  }

  const needsConfirm = implants.filter(i => i.usageStatus === 'Opened_Unused');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Implant record confirmation</h3>
          <p className="text-xs text-gray-500 mt-0.5">Read from the OT registry — do not re-key.</p>
        </div>
        {needsConfirm.length > 0 && (
          <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium">
            {needsConfirm.length} to confirm
          </span>
        )}
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        <b>Read from the OT registry, not re-entered.</b> The ward confirms what theatre recorded.
      </div>

      {implants.length === 0 ? (
        <p className="text-sm text-gray-500">No implants recorded in OT for this journey.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Implant</th>
                <th className="text-left px-3 py-2 font-medium">Serial</th>
                <th className="text-left px-3 py-2 font-medium">OT status</th>
                <th className="text-right px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {implants.map(row => (
                <tr key={row.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">
                      {[row.brand, row.model, row.power != null ? `+${row.power} D` : null]
                        .filter(Boolean)
                        .join(' ') || 'Implant'}
                    </div>
                    <div className="text-xs text-gray-500">{row.eye ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.serialNumber || row.udiBarcode || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(row.usageStatus)}`}>
                      {row.usageStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.usageStatus === 'Opened_Unused' && !readOnly && (
                      <button
                        type="button"
                        disabled={confirmingId === row.id}
                        onClick={() => void confirmWriteOff(row)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-amber-300 text-amber-900 hover:bg-amber-50 disabled:opacity-60"
                      >
                        {confirmingId === row.id ? '…' : 'Confirm write-off'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">IOL sticker in file</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {(
            [
              { key: 'barcodeScan' as const, label: 'Barcode scanned' },
              { key: 'stickerInFile' as const, label: 'Sticker in file' },
              { key: 'inventoryMatch' as const, label: 'Inventory match' },
            ] as const
          ).map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={!!sticker[key]}
                disabled={readOnly || savingSticker}
                onChange={e => void saveSticker({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">
            Returns and write-offs{' '}
            <span className="text-xs font-normal text-gray-500">{returns.length} recorded</span>
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setReturnOpen(s => !s)}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Record return
            </button>
          )}
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Unopened returns reverse stock. Opened-and-unused items are write-offs — neither is charged to the patient.
        </div>

        {returnOpen && !readOnly && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="text-xs block">
                <span className="font-medium text-gray-600">Power</span>
                <input
                  value={returnPower}
                  onChange={e => setReturnPower(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                />
              </label>
              <label className="text-xs block">
                <span className="font-medium text-gray-600">Barcode / serial</span>
                <input
                  value={returnBarcode}
                  onChange={e => setReturnBarcode(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white font-mono"
                />
              </label>
            </div>
            <label className="text-xs block">
              <span className="font-medium text-gray-600">Reason</span>
              <input
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                placeholder="Required"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReturnOpen(false)} className="text-xs px-3 py-1.5 border rounded-lg">
                Cancel
              </button>
              <button
                type="button"
                disabled={savingReturn || !returnReason.trim()}
                onClick={() => void recordReturn()}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-60"
              >
                {savingReturn ? 'Saving…' : 'Record return'}
              </button>
            </div>
          </div>
        )}

        {returns.length === 0 ? (
          <p className="text-sm text-gray-500">No returns recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">Power</th>
                  <th className="text-left px-3 py-2">Barcode</th>
                  <th className="text-left px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {returns.map(r => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtWhen(r.returnedAt)}</td>
                    <td className="px-3 py-2">{r.iolPower || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.iolBarcode || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
