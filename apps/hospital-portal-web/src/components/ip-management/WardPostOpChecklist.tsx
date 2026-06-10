'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, ClipboardCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  WardPostOpChecklistDto,
  IolStickerChecksDto,
} from '@/lib/api/ip-management.api';
import { useWardChecklistHints } from '@/hooks/use-ward-checklist-hints';
import { hintForItem } from '@/lib/ip-checklist/outpatient-integration';

export interface WardPostOpChecklistProps {
  journeyId: string;
  patientId?: string;
  counselingSessionId?: string;
  readOnly?: boolean;
}

function fmtTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function WardPostOpChecklist({
  journeyId,
  patientId,
  counselingSessionId,
  readOnly = false,
}: WardPostOpChecklistProps) {
  const [checklist, setChecklist] = useState<WardPostOpChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [iolSaving, setIolSaving] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeVerifying, setBarcodeVerifying] = useState(false);

  const itemKeys = ['postop_medication_prescribed'];
  const { hints } = useWardChecklistHints({ patientId, sessionId: counselingSessionId }, itemKeys);
  const rxHint = hintForItem(hints, 'postop_medication_prescribed');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getWardPostOpChecklist(journeyId);
    setChecklist(data);
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleItem(itemId: string, currentlyDone: boolean) {
    if (readOnly) return;
    setSavingItemId(itemId);
    const updated = await ipManagementApi.saveWardPostOpCompletion(journeyId, itemId, {
      isCompleted: !currentlyDone,
    });
    if (updated) setChecklist(updated);
    else toast.error('Failed to save checklist item');
    setSavingItemId(null);
  }

  async function verifyIolBarcode() {
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeVerifying(true);
    const res = await ipManagementApi.verifyIolBarcode(journeyId, { barcode: code });
    if (res?.isValid) {
      await saveIolChecks({ barcodeScan: true });
      toast.success(res.message ?? 'IOL barcode verified');
    } else {
      toast.error(res?.message ?? 'Invalid IOL barcode');
    }
    setBarcodeVerifying(false);
  }
  async function saveIolChecks(patch: Partial<IolStickerChecksDto>) {
    if (readOnly || !checklist) return;
    const next: IolStickerChecksDto = {
      barcodeScan: patch.barcodeScan ?? checklist.iolStickerChecks.barcodeScan,
      stickerInFile: patch.stickerInFile ?? checklist.iolStickerChecks.stickerInFile,
      inventoryMatch: patch.inventoryMatch ?? checklist.iolStickerChecks.inventoryMatch,
    };
    setIolSaving(true);
    const updated = await ipManagementApi.saveIolStickerChecks(journeyId, next);
    if (updated) setChecklist(updated);
    else toast.error('Failed to save IOL sticker checks');
    setIolSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading post-op checklist…
      </div>
    );
  }

  if (!checklist || checklist.items.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        Post-op checklist is not configured. Run migration 136 to seed items.
      </p>
    );
  }

  const { completedItems, totalItems } = checklist;
  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const form4Items = checklist.items.filter(i => i.formCode === 'WARD_POSTOP');
  const safetyItems = checklist.items.filter(i => i.formCode === 'WARD_POSTOP_SAFETY');

  function renderItems(items: typeof checklist.items) {
    return (
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
        {items.map(item => {
          const done = item.isCompleted || item.isBypassed;
          const isSaving = savingItemId === item.itemId;
          const isAuto = ['patient_received_from_ot', 'ward_checkout_time'].includes(item.itemKey);

          return (
            <li
              key={item.itemId}
              className={['flex items-start gap-3 px-3 py-2.5', done ? 'bg-green-50/60' : 'bg-white'].join(' ')}
            >
              <button
                type="button"
                disabled={readOnly || isSaving || isAuto}
                onClick={() => toggleItem(item.itemId, item.isCompleted)}
                className={[
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                  done ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white hover:border-violet-500',
                  readOnly || isAuto ? 'cursor-default opacity-70' : 'cursor-pointer',
                  isSaving ? 'opacity-50' : '',
                ].join(' ')}
                aria-label={item.itemLabel}
                aria-pressed={done}
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : done ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${done ? 'text-gray-700' : 'text-gray-900'}`}>{item.itemLabel}</p>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
                {item.itemKey === 'discharge_summary_issued' && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Nurse confirmation — not auto-ticked from summary finalize
                  </p>
                )}
                {item.itemKey === 'postop_medication_prescribed' && rxHint && (
                  <p className="text-[10px] text-indigo-600 mt-0.5">{rxHint.label} (soft link — nurse still confirms)</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg bg-violet-50 border border-violet-200 px-3 py-2">
        <span className="text-sm font-semibold text-violet-900 flex items-center gap-1.5">
          <ClipboardCheck className="h-4 w-4" />
          Ward Post-Op Checklist (Form 4)
        </span>
        <span className="text-sm font-medium text-violet-800">
          {completedItems}/{totalItems}
          <span className="text-violet-600 ml-1">({pct}%)</span>
        </span>
      </div>

      <p className="text-xs text-gray-500">
        Informational only — does not block discharge. Day-care items are optional.
      </p>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-gray-500">Sent to OT</span>
          <p className="font-medium text-gray-800 mt-0.5">{fmtTime(checklist.sentToOtAt)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-gray-500">Received from OT</span>
          <p className="font-medium text-gray-800 mt-0.5">{fmtTime(checklist.receivedFromOtAt)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-gray-500">Ward check-out</span>
          <p className="font-medium text-gray-800 mt-0.5">{fmtTime(checklist.wardCheckoutAt)}</p>
        </div>
      </div>

      {renderItems(form4Items)}

      <div className="rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-700">IOL power sticker (optional sub-checks)</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            placeholder="Scan IOL barcode…"
            disabled={readOnly || barcodeVerifying}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5"
          />
          <button
            type="button"
            disabled={readOnly || barcodeVerifying || !barcodeInput.trim()}
            onClick={verifyIolBarcode}
            className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg disabled:opacity-50"
          >
            {barcodeVerifying ? '…' : 'Verify'}
          </button>
        </div>
        {(['barcodeScan', 'stickerInFile', 'inventoryMatch'] as const).map(key => {
          const labels = {
            barcodeScan: 'Barcode scan verified',
            stickerInFile: 'Sticker in file',
            inventoryMatch: 'Inventory match',
          };
          return (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                disabled={readOnly || iolSaving}
                checked={checklist.iolStickerChecks[key]}
                onChange={e => saveIolChecks({ [key]: e.target.checked })}
                className="rounded border-gray-300"
              />
              {labels[key]}
            </label>
          );
        })}
      </div>

      {safetyItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Post-Op Safety (Form 1)
          </p>
          {renderItems(safetyItems)}
        </div>
      )}
    </div>
  );
}
