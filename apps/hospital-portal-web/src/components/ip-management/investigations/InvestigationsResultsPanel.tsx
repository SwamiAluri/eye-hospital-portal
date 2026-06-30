'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  WardInvestigationChecklistDto,
  WardInvestigationItemDto,
} from '@/lib/api/ip-management.api';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import {
  INVESTIGATION_GROUP_ORDER,
  investigationMeta,
  isHiddenInvestigation,
} from '@/lib/ip-management/investigation-catalog';
import {
  InvestigationResultRow,
  documentTypeForItemKey,
  fileToBase64,
} from './InvestigationResultRow';
import { InvestigationDocumentModal } from './InvestigationDocumentModal';

export interface InvestigationsResultsPanelProps {
  journeyId: string;
  patientId?: string;
  sessionId?: string;
  anaesthesiaType?: string;
  readOnly?: boolean;
  canVerify?: boolean;
  /** Notify the workspace that data changed so the step rail rollup can refresh. */
  onChanged?: () => void;
}

export function InvestigationsResultsPanel({
  journeyId,
  readOnly = false,
  canVerify = false,
  onChanged,
}: InvestigationsResultsPanelProps) {
  const [checklist, setChecklist] = useState<WardInvestigationChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getWardInvestigationChecklist(journeyId);
    setLoadError(data === null);
    setChecklist(data);
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    load();
  }, [load]);

  const applicable = useMemo(
    () =>
      (checklist?.items ?? []).filter(
        i => i.appliesToJourney && !isHiddenInvestigation(i.itemKey),
      ),
    [checklist?.items],
  );

  // Flat, single-list ordering: keep related tests clustered by discipline
  // order, then by display order — but without visible group header rows.
  const rows = useMemo(() => {
    const groupRank = (item: WardInvestigationItemDto) => {
      const idx = INVESTIGATION_GROUP_ORDER.indexOf(
        investigationMeta(item.itemKey, item.valueType).group,
      );
      return idx === -1 ? INVESTIGATION_GROUP_ORDER.length : idx;
    };
    return [...applicable].sort((a, b) => {
      const ga = groupRank(a);
      const gb = groupRank(b);
      if (ga !== gb) return ga - gb;
      return a.displayOrder - b.displayOrder;
    });
  }, [applicable]);

  const verifiableCount = applicable.filter(i => i.entryStatus === 'entered').length;
  const previewItem = applicable.find(i => i.itemId === previewItemId) ?? null;

  async function handleBulkVerify() {
    if (bulkBusy) return;
    const targets = applicable.filter(i => i.entryStatus === 'entered');
    if (targets.length === 0) return;
    setBulkBusy(true);
    let latest: WardInvestigationChecklistDto | null = null;
    for (const item of targets) {
      latest = await ipManagementApi.verifyWardInvestigation(journeyId, item.itemId);
    }
    if (latest) setChecklist(latest);
    else await load();
    onChanged?.();
    setBulkBusy(false);
  }

  async function handleReplace(file: File) {
    if (!previewItem) return;
    setBusyItemId(previewItem.itemId);
    try {
      const base64 = await fileToBase64(file);
      const updated = await ipManagementApi.uploadWardInvestigationDocument(journeyId, previewItem.itemId, {
        documentType: documentTypeForItemKey(previewItem.itemKey),
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileData: base64,
      });
      if (updated) {
        setChecklist(updated);
        onChanged?.();
        toast.success('Report replaced');
      } else {
        toast.error('Replace failed');
      }
    } catch {
      toast.error('Could not read file');
    }
    setBusyItemId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading investigations…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-2 py-4">
        <p className="flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Couldn&apos;t load investigations. This is usually a temporary glitch.
        </p>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!applicable.length) {
    const catalogEmpty = (checklist?.items.length ?? 0) === 0;
    return (
      <p className="py-4 text-sm text-gray-500">
        {catalogEmpty
          ? 'Investigation checklist not configured. Run migration 142.'
          : 'No investigations apply to this journey.'}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid={WARD_PREOP_TEST_IDS.sectionInvestigations}>
      {/* Minimal header: title · progress · verify all */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Investigations &amp; Results</h3>
        <div className="flex items-center gap-3">
          {canVerify && !readOnly && verifiableCount > 0 && (
            <button
              type="button"
              data-testid={WARD_PREOP_TEST_IDS.investigationBulkVerify}
              onClick={handleBulkVerify}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-600 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Verify all ({verifiableCount})
            </button>
          )}
        </div>
      </div>

      {/* Single aligned, flat table (no group rows) */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[640px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[24%]" />
            <col className="w-[24%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">Test</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">Verified</th>
              <th className="px-3 py-2">Report</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(item => (
              <InvestigationResultRow
                key={item.itemId}
                journeyId={journeyId}
                item={item}
                readOnly={readOnly}
                canVerify={canVerify}
                busy={busyItemId === item.itemId}
                onUpdated={c => { setChecklist(c); onChanged?.(); }}
                onBusyChange={setBusyItemId}
                onPreview={i => setPreviewItemId(i.itemId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <InvestigationDocumentModal
        open={Boolean(previewItem)}
        fileName={previewItem?.documentFileName ?? null}
        fileUrl={previewItem?.documentPreviewUrl ?? null}
        onClose={() => setPreviewItemId(null)}
        onReplace={!readOnly && previewItem ? () => replaceRef.current?.click() : undefined}
      />

      <input
        ref={replaceRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void handleReplace(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
