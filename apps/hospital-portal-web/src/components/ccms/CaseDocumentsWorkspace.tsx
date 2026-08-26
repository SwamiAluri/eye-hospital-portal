'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, X } from 'lucide-react';
import { DocumentChecklist, type DocumentSlot } from './DocumentChecklist';
import { uploadCaseDocument, deleteCaseDocument, type CaseDocument } from '@/lib/api/ccms/ccms-documents.api';
import { ccmsKeys, useCcmsCaseDocuments } from '@/hooks/use-ccms-case';
import { formatMissingDocumentsMessage, withBiometrySlot } from '@/lib/ccms/ccms-document-slots';
import { AttachOpdBiometryButton } from './AttachOpdBiometryButton';

interface PreviewState {
  url: string;
  fileName: string;
  mimeType?: string;
}

interface Props {
  caseId: string;
  patientId?: string | null;
  slots: Omit<DocumentSlot, 'uploadedUrl' | 'uploadedAt' | 'docId'>[];
  readOnly?: boolean;
  showScanButton?: boolean;
  /** Pre-loaded from parent query cache — skips initial fetch when provided. */
  documents?: CaseDocument[];
  documentsLoading?: boolean;
  /** Called after any successful upload or delete so parent can refresh counts. */
  onChanged?: () => void;
}

function mergeSlotsWithDocs(
  slots: Omit<DocumentSlot, 'uploadedUrl' | 'uploadedAt' | 'docId'>[],
  docs: CaseDocument[],
): DocumentSlot[] {
  return slots.map(slot => {
    const doc = docs.find(d => d.documentType === slot.key && d.isActive);
    return doc
      ? { ...slot, uploadedUrl: doc.url, uploadedAt: doc.uploadedAt, docId: doc.id }
      : { ...slot, uploadedUrl: undefined, uploadedAt: undefined, docId: undefined };
  });
}

export function CaseDocumentsWorkspace({
  caseId,
  patientId,
  slots,
  readOnly = false,
  showScanButton = true,
  documents: externalDocuments,
  documentsLoading: externalLoading,
  onChanged,
}: Props) {
  const queryClient = useQueryClient();
  const ownQuery = useCcmsCaseDocuments(externalDocuments === undefined ? caseId : null);
  const documents = externalDocuments ?? ownQuery.data ?? [];
  const loading = externalDocuments !== undefined
    ? (externalLoading ?? false)
    : ownQuery.isLoading;

  const [liveSlots, setLiveSlots] = useState<DocumentSlot[]>(() => mergeSlotsWithDocs(withBiometrySlot(slots), documents));
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    setLiveSlots(mergeSlotsWithDocs(withBiometrySlot(slots), documents));
  }, [slots, documents]);

  const invalidateDocuments = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ccmsKeys.documents(caseId) });
    onChanged?.();
  }, [caseId, queryClient, onChanged]);

  const handleUpload = useCallback(async (key: string, file: File): Promise<string> => {
    const doc = await uploadCaseDocument(caseId, file, key);
    setLiveSlots(prev =>
      prev.map(s => s.key === key ? { ...s, uploadedUrl: doc.url, uploadedAt: doc.uploadedAt, docId: doc.id } : s),
    );
    await invalidateDocuments();
    return doc.url;
  }, [caseId, invalidateDocuments]);

  const handleDelete = useCallback(async (key: string, docId: string): Promise<void> => {
    await deleteCaseDocument(caseId, docId);
    setLiveSlots(prev =>
      prev.map(s => s.key === key ? { ...s, uploadedUrl: undefined, uploadedAt: undefined, docId: undefined } : s),
    );
    await invalidateDocuments();
  }, [caseId, invalidateDocuments]);

  const handlePreview = useCallback((slot: DocumentSlot) => {
    if (!slot.uploadedUrl) return;
    setPreview({ url: slot.uploadedUrl, fileName: slot.label, mimeType: undefined });
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    try {
      await queryClient.invalidateQueries({ queryKey: ccmsKeys.documents(caseId) });
    } catch {
      setError('Could not load documents. Please try again.');
    }
  }, [caseId, queryClient]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
        {error}
        <button onClick={() => reload()} className="ml-2 font-semibold underline">Retry</button>
      </div>
    );
  }

  const uploadedCount   = liveSlots.filter(s => s.uploadedUrl).length;
  const requiredCount   = liveSlots.filter(s => s.required).length;
  const requiredDone    = liveSlots.filter(s => s.required && s.uploadedUrl).length;
  const allRequiredDone = requiredCount === 0 || requiredDone === requiredCount;
  const requiredPct     = requiredCount > 0 ? Math.round((requiredDone / requiredCount) * 100) : 100;
  const missingLabels   = liveSlots.filter(s => s.required && !s.uploadedUrl).map(s => s.label);

  return (
    <>
      {requiredCount === 0 ? (
        <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800" data-testid="ccms-docs-empty-master">
          No required documents are configured for this payer. Submit is allowed. Optional uploads still appear.
        </div>
      ) : allRequiredDone ? (
        <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" data-testid="ccms-docs-ready">
          All required documents are on file. Submit sends the packet. The TPA may still raise a query later.
        </div>
      ) : (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="ccms-docs-blocked">
          {formatMissingDocumentsMessage(missingLabels)}
        </div>
      )}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allRequiredDone ? 'bg-emerald-500' : 'bg-amber-400'}`}
              style={{ width: `${requiredPct}%` }}
            />
          </div>
        </div>
        <span className={`text-xs font-bold flex-shrink-0 ${allRequiredDone ? 'text-emerald-600' : 'text-amber-600'}`}>
          {requiredDone}/{requiredCount} required
        </span>
        <span className="text-xs text-gray-400 flex-shrink-0">
          {uploadedCount}/{liveSlots.length} total
        </span>
        {allRequiredDone && requiredCount > 0 && (
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex-shrink-0">✓ Done</span>
        )}
      </div>

      <AttachOpdBiometryButton
        caseId={caseId}
        patientId={patientId}
        readOnly={readOnly}
        onAttached={() => { void invalidateDocuments(); }}
      />
      <DocumentChecklist
        slots={liveSlots}
        caseId={caseId}
        onUpload={readOnly ? undefined : handleUpload}
        onDelete={readOnly ? undefined : handleDelete}
        onPreview={handlePreview}
        readOnly={readOnly}
        showScanButton={!readOnly && showScanButton}
      />

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <p className="text-sm font-semibold text-gray-800 truncate">{preview.fileName}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {preview.url.startsWith('http') && (
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-indigo-600 hover:underline"
                  >
                    Open in new tab ↗
                  </a>
                )}
                <button
                  onClick={() => setPreview(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100">
              {preview.url.startsWith('http') ? (
                <iframe
                  src={preview.url}
                  title={preview.fileName}
                  className="w-full h-full min-h-[60vh] border-0"
                />
              ) : (
                <p className="p-6 text-sm text-gray-700">
                  This is the OPD biometry record on file. Open Diagnostics → Biometry to view measurements.
                  Auth remains the source of truth; this case only stores a pointer.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
