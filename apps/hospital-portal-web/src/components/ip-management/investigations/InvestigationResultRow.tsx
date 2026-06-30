'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  WardInvestigationChecklistDto,
  WardInvestigationItemDto,
} from '@/lib/api/ip-management.api';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { statusFromEntry } from '@/lib/ip-management/preop-status';
import { computeResultFlag, investigationMeta } from '@/lib/ip-management/investigation-catalog';
import { StatusChip } from '@/components/ip-management/preop/primitives/StatusChip';

export function documentTypeForItemKey(itemKey: string): string {
  if (['ascan_done', 'bscan_done', 'xray_ga_cases', 'ecg_done'].includes(itemKey)) {
    return 'ImagingReport';
  }
  return 'LabReport';
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmtTime(dt: string | null | undefined): string {
  if (!dt) return '';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface InvestigationResultRowProps {
  journeyId: string;
  item: WardInvestigationItemDto;
  readOnly?: boolean;
  canVerify?: boolean;
  busy?: boolean;
  onUpdated: (checklist: WardInvestigationChecklistDto) => void;
  onBusyChange: (itemId: string | null) => void;
  onPreview: (item: WardInvestigationItemDto) => void;
}

export function InvestigationResultRow({
  journeyId,
  item,
  readOnly = false,
  canVerify = false,
  busy = false,
  onUpdated,
  onBusyChange,
  onPreview,
}: InvestigationResultRowProps) {
  const meta = investigationMeta(item.itemKey, item.valueType);
  const isDerived = meta.captureMode === 'derived';
  const isSelect = meta.captureMode === 'select';

  const fileRef = useRef<HTMLInputElement>(null);
  const [resultValue, setResultValue] = useState(item.resultValue ?? '');
  const resultUnit = meta.unit ?? item.resultUnit ?? item.defaultUnit ?? '';
  const referenceRange = item.referenceRange ?? meta.referenceRange ?? '';

  useEffect(() => {
    setResultValue(item.resultValue ?? '');
  }, [item.resultValue]);

  const hasValue = Boolean((item.resultValue ?? '').trim());
  const isVerified = item.entryStatus === 'verified';
  const canEdit = !readOnly && !isDerived;
  const showVerify =
    canVerify && !readOnly && hasValue && !isVerified && item.entryStatus === 'entered';
  const hasDoc = Boolean(item.documentPreviewUrl || item.documentFileName);

  const status = statusFromEntry(item.entryStatus, { hasValue });
  const flag = meta.captureMode === 'numeric'
    ? computeResultFlag(item.resultValue, referenceRange)
    : null;
  const abnormal = flag === 'H' || flag === 'L';

  async function persist(nextValue: string) {
    const trimmed = nextValue.trim();
    if (!trimmed) return;
    onBusyChange(item.itemId);
    const updated = await ipManagementApi.saveWardInvestigationResult(journeyId, item.itemId, {
      resultValue: trimmed,
      resultUnit: resultUnit.trim() || null,
      referenceRange: referenceRange.trim() || null,
      resultFlag: computeResultFlag(trimmed, referenceRange),
      resultSource: 'manual_ward',
      externalReportNote: null,
    });
    if (updated) onUpdated(updated);
    else toast.error('Failed to save result');
    onBusyChange(null);
  }

  function commitValue() {
    if (!canEdit) return;
    if (resultValue.trim() === (item.resultValue ?? '').trim()) return;
    void persist(resultValue);
  }

  async function handleVerify() {
    onBusyChange(item.itemId);
    const updated = await ipManagementApi.verifyWardInvestigation(journeyId, item.itemId);
    if (updated) {
      onUpdated(updated);
      toast.success(`${item.itemLabel} verified`);
    } else {
      toast.error('Failed to verify');
    }
    onBusyChange(null);
  }

  async function handleUpload(file: File) {
    onBusyChange(item.itemId);
    try {
      const base64 = await fileToBase64(file);
      const updated = await ipManagementApi.uploadWardInvestigationDocument(journeyId, item.itemId, {
        documentType: documentTypeForItemKey(item.itemKey),
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileData: base64,
      });
      if (updated) {
        onUpdated(updated);
        toast.success('Report uploaded');
      } else {
        toast.error('Upload failed');
      }
    } catch {
      toast.error('Could not read file');
    }
    onBusyChange(null);
  }

  const valueClass = `w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 ${
    abnormal
      ? 'border-red-300 text-red-700 font-medium focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-indigo-500'
  } disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:px-0`;

  return (
    <tr
      data-testid={WARD_PREOP_TEST_IDS.investigationRow(item.itemKey)}
      className="border-t border-gray-100 hover:bg-gray-50/60"
    >
      {/* Test */}
      <td className="px-3 py-2 align-middle">
        <span className="text-sm font-medium text-gray-900">{item.itemLabel}</span>
      </td>

      {/* Result */}
      <td className="px-3 py-2 align-middle">
        {isDerived ? (
          <span className={`text-sm ${hasValue ? 'text-gray-900' : 'text-gray-400'}`}>
            {hasValue ? `${item.resultValue}${resultUnit ? ` ${resultUnit}` : ''}` : 'From Vitals'}
          </span>
        ) : isSelect ? (
          <select
            value={resultValue}
            disabled={!canEdit || busy}
            onChange={e => {
              setResultValue(e.target.value);
              if (e.target.value) void persist(e.target.value);
            }}
            className={valueClass}
          >
            <option value="">Select…</option>
            {(meta.options ?? []).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              inputMode={meta.captureMode === 'numeric' ? 'decimal' : 'text'}
              value={resultValue}
              disabled={!canEdit || busy}
              placeholder={canEdit ? (meta.captureMode === 'numeric' ? 'e.g. 11.4' : 'Enter result') : '—'}
              onChange={e => setResultValue(e.target.value)}
              onBlur={commitValue}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className={valueClass}
            />
            {resultUnit && hasValue && (
              <span className="shrink-0 text-xs text-gray-400">{resultUnit}</span>
            )}
          </div>
        )}
        {abnormal && referenceRange && (
          <span className="mt-0.5 block text-[11px] text-red-500">Ref {referenceRange}</span>
        )}
      </td>

      {/* Verified at & by */}
      <td className="px-3 py-2 align-middle">
        {isVerified ? (
          <span className="text-xs text-gray-600">
            {fmtTime(item.verifiedAt)}
            {item.verifiedByName ? <span className="text-gray-400"> · {item.verifiedByName}</span> : null}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>

      {/* Report */}
      <td className="px-3 py-2 align-middle">
        {hasDoc ? (
          <button
            type="button"
            onClick={() => onPreview(item)}
            className="inline-flex max-w-[140px] items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-900"
            title={item.documentFileName ?? 'Preview report'}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.documentFileName ?? 'Preview'}</span>
          </button>
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
        {canEdit && (
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = '';
            }}
          />
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-2 align-middle">
        <div className="flex flex-col items-end gap-1">
          <StatusChip
            status={status}
            size="sm"
            label={status === 'pending-verification' ? 'Pending' : undefined}
          />
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
          ) : showVerify ? (
            <button
              type="button"
              onClick={handleVerify}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-600 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
            >
              <ShieldCheck className="h-3 w-3" />
              Verify
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
