'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { DocumentChecklist, type DocumentSlot } from './DocumentChecklist';
import { uploadCaseDocument, deleteCaseDocument, fetchCaseDocumentsFromApi, fetchCaseDocumentBlob, formatCcmsDocumentError, type CaseDocument } from '@/lib/api/ccms/ccms-documents.api';
import { ccmsKeys, useCcmsCaseDocuments } from '@/hooks/use-ccms-case';
import {
  augmentSlotsWithUploadedDocuments,
  formatOutstandingDocumentsMessage,
  mergeFetchedWithCachedDocuments,
  mergeSlotsWithDocuments,
  removeCaseDocumentFromList,
  upsertCaseDocumentInList,
  withBiometrySlot,
} from '@/lib/ccms/ccms-document-slots';
import {
  canPreviewDocumentInBrowser,
  getPointerDocumentNotice,
  isPointerDocumentUrl,
  resolveSlotDocumentMetadata,
} from '@/lib/ccms/case-document-preview';
import {
  downloadBlob,
  openBlobInNewTab,
} from '@/lib/ccms/case-document-actions';
import { InvestigationDocumentModal } from '@/components/ip-management/investigations/InvestigationDocumentModal';
import { AttachOpdBiometryButton } from './AttachOpdBiometryButton';

interface Props {
  caseId: string;
  patientId?: string | null;
  slots: Omit<DocumentSlot, 'uploadedUrl' | 'uploadedAt' | 'docId' | 'fileName' | 'mimeType'>[];
  readOnly?: boolean;
  showScanButton?: boolean;
  /** Pre-loaded from parent query cache — skips initial fetch when provided. */
  documents?: CaseDocument[];
  documentsLoading?: boolean;
  /** Called after any successful upload or delete so parent can refresh counts. */
  onChanged?: () => void;
  /** Wave 2E-INS — short status line instead of instructional banners. */
  compactStatusBanners?: boolean;
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
  compactStatusBanners = false,
}: Props) {
  const queryClient = useQueryClient();
  const ownQuery = useCcmsCaseDocuments(externalDocuments === undefined ? caseId : null);
  const documents = externalDocuments ?? ownQuery.data ?? [];
  const loading = externalDocuments !== undefined
    ? (externalLoading ?? false)
    : ownQuery.isLoading;

  const [liveSlots, setLiveSlots] = useState<DocumentSlot[]>(() =>
    mergeSlotsWithDocuments(
      augmentSlotsWithUploadedDocuments(withBiometrySlot(slots), documents),
      documents,
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [previewSlot, setPreviewSlot] = useState<DocumentSlot | null>(null);
  const [previewAccessUrl, setPreviewAccessUrl] = useState<string | null>(null);
  const [previewAccessLoading, setPreviewAccessLoading] = useState(false);
  const [previewAccessError, setPreviewAccessError] = useState<string | null>(null);
  const [previewUnsupported, setPreviewUnsupported] = useState(false);
  const [previewResolvedMime, setPreviewResolvedMime] = useState<string | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);
  const previewDocIdRef = useRef<string | null>(null);

  useEffect(() => {
    const augmented = augmentSlotsWithUploadedDocuments(withBiometrySlot(slots), documents);
    setLiveSlots(mergeSlotsWithDocuments(augmented, documents));
  }, [slots, documents]);

  const syncDocumentsCache = useCallback(async (options?: { authoritative?: boolean }) => {
    const cached = queryClient.getQueryData<CaseDocument[]>(ccmsKeys.documents(caseId)) ?? [];
    try {
      const fetched = await fetchCaseDocumentsFromApi(caseId);
      const merged = options?.authoritative
        ? fetched
        : mergeFetchedWithCachedDocuments(cached, fetched);
      queryClient.setQueryData(ccmsKeys.documents(caseId), merged);
      const augmented = augmentSlotsWithUploadedDocuments(withBiometrySlot(slots), merged);
      setLiveSlots(mergeSlotsWithDocuments(augmented, merged));
      return merged;
    } catch {
      return cached;
    }
  }, [caseId, queryClient, slots]);

  const invalidateDocuments = useCallback(async () => {
    await syncDocumentsCache();
    onChanged?.();
  }, [syncDocumentsCache, onChanged]);

  const fetchSlotDocumentBlob = useCallback(async (slot: DocumentSlot): Promise<Blob> => {
    if (isPointerDocumentUrl(slot.uploadedUrl)) {
      throw new Error('pointer_document');
    }
    if (!slot.docId) {
      throw new Error('missing_doc_id');
    }
    if (previewBlobRef.current && previewDocIdRef.current === slot.docId) {
      return previewBlobRef.current;
    }
    const { mimeType, fileName } = resolveSlotDocumentMetadata(slot, documents);
    const blob = await fetchCaseDocumentBlob(caseId, slot.docId, { mimeType, fileName });
    return blob;
  }, [caseId, documents]);

  const handleOpenDocument = useCallback(async (slot: DocumentSlot): Promise<void> => {
    try {
      const { fileName, mimeType } = resolveSlotDocumentMetadata(slot, documents);
      const blob = await fetchSlotDocumentBlob({ ...slot, fileName, mimeType });
      openBlobInNewTab(blob, mimeType);
    } catch (e) {
      toast.error(formatCcmsDocumentError(e, 'Could not open document. Please try again.'));
      throw e;
    }
  }, [fetchSlotDocumentBlob, documents]);

  const handleDownloadDocument = useCallback(async (slot: DocumentSlot): Promise<void> => {
    try {
      const { fileName, mimeType } = resolveSlotDocumentMetadata(slot, documents);
      const blob = await fetchSlotDocumentBlob({ ...slot, fileName, mimeType });
      downloadBlob(blob, fileName ?? slot.label ?? 'document', mimeType);
      toast.success(`${fileName ?? 'Document'} downloaded`);
    } catch (e) {
      toast.error(formatCcmsDocumentError(e, 'Could not download document. Please try again.'));
      throw e;
    }
  }, [fetchSlotDocumentBlob, documents]);

  const handleUpload = useCallback(async (key: string, file: File): Promise<string> => {
    try {
      const doc = await uploadCaseDocument(caseId, file, key);
      if (!doc.url?.trim() && !doc.accessUrl?.trim()) {
        throw new Error('upload_incomplete');
      }
      queryClient.setQueryData<CaseDocument[]>(ccmsKeys.documents(caseId), (prev) =>
        upsertCaseDocumentInList(prev, doc),
      );
      const mergedDocs = queryClient.getQueryData<CaseDocument[]>(ccmsKeys.documents(caseId)) ?? [];
      const augmented = augmentSlotsWithUploadedDocuments(withBiometrySlot(slots), mergedDocs);
      setLiveSlots(mergeSlotsWithDocuments(augmented, mergedDocs));
      void syncDocumentsCache();
      toast.success(`${doc.fileName ?? 'Document'} uploaded`);
      try {
        onChanged?.();
      } catch {
        // Upload succeeded; parent refresh failure must not show upload error toast.
      }
      return doc.url;
    } catch (e) {
      toast.error(formatCcmsDocumentError(e, 'Could not upload document. Please try again.'));
      throw new Error('upload_failed');
    }
  }, [caseId, onChanged, queryClient, slots, syncDocumentsCache]);

  const handleDelete = useCallback(async (key: string, docId: string): Promise<void> => {
    try {
      await deleteCaseDocument(caseId, docId);
      queryClient.setQueryData<CaseDocument[]>(ccmsKeys.documents(caseId), (prev) =>
        removeCaseDocumentFromList(prev, docId),
      );
      const mergedDocs = queryClient.getQueryData<CaseDocument[]>(ccmsKeys.documents(caseId)) ?? [];
      const augmented = augmentSlotsWithUploadedDocuments(withBiometrySlot(slots), mergedDocs);
      setLiveSlots(mergeSlotsWithDocuments(augmented, mergedDocs));
      await syncDocumentsCache();
      onChanged?.();
    } catch {
      toast.error('Could not remove document. Please try again.');
      throw new Error('delete_failed');
    }
  }, [caseId, onChanged, queryClient, slots, syncDocumentsCache]);

  const resetPreviewState = useCallback(() => {
    if (previewBlobUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    previewBlobRef.current = null;
    previewDocIdRef.current = null;
    setPreviewSlot(null);
    setPreviewAccessUrl(null);
    setPreviewAccessError(null);
    setPreviewAccessLoading(false);
    setPreviewUnsupported(false);
    setPreviewResolvedMime(null);
  }, []);

  const handlePreview = useCallback((slot: DocumentSlot) => {
    if (!slot.uploadedUrl) return;
    if (previewBlobUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    previewBlobRef.current = null;
    previewDocIdRef.current = null;
    setPreviewSlot(slot);
    setPreviewAccessUrl(null);
    setPreviewAccessError(null);
    setPreviewUnsupported(false);
    setPreviewResolvedMime(null);

    if (isPointerDocumentUrl(slot.uploadedUrl)) {
      setPreviewAccessUrl(slot.uploadedUrl);
      return;
    }

    if (!slot.docId) {
      setPreviewAccessError('Document access unavailable.');
      return;
    }

    const { fileName, mimeType } = resolveSlotDocumentMetadata(slot, documents);

    if (!canPreviewDocumentInBrowser(mimeType, fileName)) {
      setPreviewUnsupported(true);
      return;
    }

    setPreviewAccessLoading(true);
    void (async () => {
      try {
        const blob = await fetchCaseDocumentBlob(caseId, slot.docId!, { mimeType, fileName });
        previewBlobRef.current = blob;
        previewDocIdRef.current = slot.docId ?? null;
        setPreviewResolvedMime(blob.type || mimeType || null);
        const objectUrl = URL.createObjectURL(blob);
        previewBlobUrlRef.current = objectUrl;
        setPreviewAccessUrl(objectUrl);
      } catch (e) {
        setPreviewAccessError(
          formatCcmsDocumentError(e, 'Could not load document for preview. Please try again.'),
        );
      } finally {
        setPreviewAccessLoading(false);
      }
    })();
  }, [caseId, documents]);

  const reload = useCallback(async () => {
    setError(null);
    try {
      await syncDocumentsCache({ authoritative: true });
    } catch {
      setError('Could not load documents. Please try again.');
    }
  }, [syncDocumentsCache]);

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

  const previewUrl = previewAccessUrl ?? (previewSlot?.uploadedUrl && isPointerDocumentUrl(previewSlot.uploadedUrl)
    ? previewSlot.uploadedUrl
    : null);
  const previewPointerNotice = previewSlot?.uploadedUrl
    ? getPointerDocumentNotice(previewSlot.uploadedUrl)
    : null;
  const previewMeta = previewSlot
    ? resolveSlotDocumentMetadata(previewSlot, documents)
    : { fileName: undefined as string | undefined, mimeType: undefined as string | undefined };

  return (
    <>
      {requiredCount === 0 ? (
        <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800" data-testid="ccms-docs-empty-master">
          {compactStatusBanners
            ? 'No required documents configured for this payer.'
            : 'No required documents are configured for this payer. Submit is allowed. Optional uploads still appear.'}
        </div>
      ) : allRequiredDone ? (
        <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" data-testid="ccms-docs-ready">
          {compactStatusBanners
            ? 'All required documents are on file.'
            : 'All required documents are on file. Submit sends the packet. The TPA may still raise a query later.'}
        </div>
      ) : (
        <div
          className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          data-testid="ccms-docs-outstanding"
        >
          {formatOutstandingDocumentsMessage(missingLabels.length, {
            uploaded: requiredDone,
            required: requiredCount,
          })}
          {!compactStatusBanners ? (
            <span className="mt-0.5 block text-amber-800/80">
              Required for insurance packet readiness — counselling can continue.
            </span>
          ) : null}
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
        <span className={`text-xs font-bold flex-shrink-0 ${allRequiredDone ? 'text-emerald-600' : 'text-amber-700'}`}>
          {requiredDone} of {requiredCount} required
        </span>
        <span className="text-xs text-gray-400 flex-shrink-0">
          {uploadedCount}/{liveSlots.length} total
        </span>
        {allRequiredDone && requiredCount > 0 && (
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex-shrink-0">✓ Uploaded</span>
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
        onOpenDocument={handleOpenDocument}
        onDownloadDocument={handleDownloadDocument}
        readOnly={readOnly}
        showScanButton={!readOnly && showScanButton}
      />

      <InvestigationDocumentModal
        open={!!previewSlot}
        fileName={previewMeta.fileName ?? previewSlot?.label ?? null}
        fileUrl={previewUrl}
        mimeType={previewResolvedMime ?? previewMeta.mimeType}
        pointerNotice={previewPointerNotice}
        loading={previewAccessLoading}
        accessError={previewAccessError}
        unsupported={previewUnsupported}
        onOpen={previewSlot ? () => handleOpenDocument(previewSlot) : undefined}
        onDownload={previewSlot ? () => handleDownloadDocument(previewSlot) : undefined}
        onClose={resetPreviewState}
      />
    </>
  );
}
