'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CounsellingAlertDialog,
  CounsellingAlertDialogAction,
  CounsellingAlertDialogCancel,
  CounsellingAlertDialogContent,
  CounsellingAlertDialogDescription,
  CounsellingAlertDialogFooter,
  CounsellingAlertDialogHeader,
  CounsellingAlertDialogTitle,
  CounsellingCard,
  CounsellingCardContent,
  CounsellingCardHeader,
  CounsellingCardTitle,
} from '@/components/counsellors-desk/session/primitives';
import { CounsellingStatusMessage } from '@/components/counsellors-desk/session/primitives/CounsellingStatusMessage';
import { Patient360DocumentPreview, runPatient360DocumentPrint } from '@/components/patients/record/Patient360DocumentPreview';
import { CustomDocumentModal } from '@/components/widgets/CustomDocumentModal';
import {
  counselingSessionsApi,
  deleteCounselingSessionDocument,
  downloadCounselingCanonicalDocument,
  getCounselingDocumentsByPatient,
  type CounselingDocumentPatientMetadata,
  type SessionDocument,
} from '@/lib/api/counseling-sessions.api';
import { useAuthStore } from '@/lib/auth-store';
import { useHasPermission } from '@/hooks/use-permissions';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { patient360DocumentTypeLabel } from '@/lib/patients/patient-360-document-areas';
import {
  counsellingDocumentMimeType,
  isPatient360ExcludedCounsellingDocumentType,
} from '@/lib/patients/patient-360-counselling-documents';
import { COUNSELLING_DOCUMENT_REMOVE_CONFIRM } from '@/lib/patients/counselling-document-remove-confirm';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const linkClass = 'text-sm font-medium text-primary underline-offset-2 hover:underline';

type PendingRemove = {
  documentId: string;
};

function DocumentActions({
  patientId,
  documentName,
  documentType,
  status,
  mimeType,
  canonicalId,
  canRemove,
  onRequestRemove,
}: {
  patientId: string;
  documentName: string | null | undefined;
  documentType: string | null | undefined;
  status?: string | null;
  mimeType: string | null;
  canonicalId: string | null | undefined;
  canRemove: boolean;
  onRequestRemove: () => void;
}) {
  const typeLabel = patient360DocumentTypeLabel(documentType);
  const canContent = Boolean(canonicalId);
  const loadContent = canonicalId
    ? () => downloadCounselingCanonicalDocument(patientId, canonicalId)
    : undefined;

  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{documentName}</p>
        <p className="text-xs text-muted-foreground">
          {typeLabel}
          {status ? ` · ${status}` : ''}
        </p>
      </div>
      <div className={cn('flex flex-wrap items-center gap-2')}>
        <Patient360DocumentPreview
          fileName={documentName}
          documentType={typeLabel === '—' ? null : typeLabel}
          source="Counselling Documents"
          statusLabel={status}
          mimeType={mimeType}
          canLoadContent={canContent}
          loadContent={loadContent}
          canDownload={canContent}
          onDownload={
            canonicalId
              ? () => {
                  void downloadCounselingCanonicalDocument(patientId, canonicalId).then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = documentName || 'document';
                    link.click();
                    URL.revokeObjectURL(url);
                  });
                }
              : undefined
          }
        />
        {canContent && loadContent ? (
          <button
            type="button"
            className={linkClass}
            onClick={() =>
              void runPatient360DocumentPrint({
                fileName: documentName,
                mimeType,
                loadContent,
              })
            }
          >
            Print
          </button>
        ) : null}
        {canContent && canonicalId ? (
          <button
            type="button"
            className={linkClass}
            onClick={() => {
              void downloadCounselingCanonicalDocument(patientId, canonicalId).then((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = documentName || 'document';
                link.click();
                URL.revokeObjectURL(url);
              });
            }}
          >
            Download
          </button>
        ) : null}
        {canRemove ? (
          <button type="button" className={linkClass} onClick={onRequestRemove}>
            Remove
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function CounsellingSessionDocumentsPanel({
  sessionId,
  patientId,
}: {
  sessionId: string;
  patientId: string;
}) {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const canRead = useHasPermission('session_documents.read');
  const canCreate = useHasPermission('session_documents.create');
  const canDelete = useHasPermission('session_documents.delete');
  const [rows, setRows] = useState<SessionDocument[] | null>(null);
  const [patientRows, setPatientRows] = useState<CounselingDocumentPatientMetadata[]>([]);
  const [error, setError] = useState<'unauthorized' | 'unavailable' | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [canonicalBySource, setCanonicalBySource] = useState<Record<string, string>>({});
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [removing, setRemoving] = useState(false);

  const reload = useCallback(async () => {
    if (!canRead) {
      setError('unauthorized');
      setRows([]);
      setPatientRows([]);
      return;
    }
    try {
      const list = await counselingSessionsApi.getSessionDocuments(sessionId);
      const nonAudio = list.filter((doc) => !isPatient360ExcludedCounsellingDocumentType(doc.documentType));
      setRows(nonAudio);
      setError(null);

      try {
        const page = await getCounselingDocumentsByPatient(patientId, 1, 100);
        const map: Record<string, string> = {};
        const patientLevel: CounselingDocumentPatientMetadata[] = [];
        for (const doc of page.documents ?? []) {
          if (isPatient360ExcludedCounsellingDocumentType(doc.documentType)) continue;
          if (doc.sessionId === sessionId && doc.canonicalDocumentId) {
            map[doc.id] = doc.canonicalDocumentId;
          }
          if (!doc.sessionId) {
            patientLevel.push(doc);
          }
        }
        setCanonicalBySource(map);
        setPatientRows(patientLevel);
      } catch {
        setCanonicalBySource({});
        setPatientRows([]);
      }
    } catch (err) {
      const status = (err as { response?: { status?: number } } | null)?.response?.status;
      setError(status === 401 || status === 403 ? 'unauthorized' : 'unavailable');
      setRows([]);
      setPatientRows([]);
    }
  }, [canRead, patientId, sessionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const confirmRemove = useCallback(async () => {
    if (!pendingRemove || removing) return;
    setRemoving(true);
    try {
      await deleteCounselingSessionDocument(pendingRemove.documentId);
      toast.success('Document removed.');
      setPendingRemove(null);
      await reload();
    } catch {
      toast.error('Document remove failed.');
    } finally {
      setRemoving(false);
    }
  }, [pendingRemove, reload, removing]);

  if (!canRead) {
    return (
      <CounsellingCard>
        <CounsellingCardHeader>
          <CounsellingCardTitle>{counsellingCopy.sessionDocuments}</CounsellingCardTitle>
        </CounsellingCardHeader>
        <CounsellingCardContent>
          <CounsellingStatusMessage
            tone="info"
            title="Counselling documents are not available to this sign-in"
          />
        </CounsellingCardContent>
      </CounsellingCard>
    );
  }

  return (
    <>
      <CounsellingCard>
        <CounsellingCardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CounsellingCardTitle>{counsellingCopy.sessionDocuments}</CounsellingCardTitle>
          {canCreate ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setUploadOpen(true)}>
              Upload
            </Button>
          ) : null}
        </CounsellingCardHeader>
        <CounsellingCardContent className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Session documents</h3>
            {rows == null ? (
              <CounsellingStatusMessage tone="loading" title="Loading documents" />
            ) : error === 'unavailable' ? (
              <CounsellingStatusMessage tone="error" title="Counselling documents are unavailable" />
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No counselling documents recorded.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border">
                {rows.map((doc) => {
                  const canonicalId = canonicalBySource[doc.id];
                  const mimeType = counsellingDocumentMimeType(doc.fileType ?? null);
                  const canRemove = Boolean(
                    canDelete && currentUserId && doc.createdByUserId === currentUserId,
                  );
                  return (
                    <DocumentActions
                      key={doc.id}
                      patientId={patientId}
                      documentName={doc.documentName}
                      documentType={doc.documentType}
                      status={
                        [doc.isVerified ? 'Verified' : null, doc.status].filter(Boolean).join(' · ') ||
                        null
                      }
                      mimeType={mimeType}
                      canonicalId={canonicalId}
                      canRemove={canRemove}
                      onRequestRemove={() => setPendingRemove({ documentId: doc.id })}
                    />
                  );
                })}
              </ul>
            )}
          </div>

          {patientRows.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Patient counselling documents</h3>
              <ul className="divide-y divide-border rounded-md border">
                {patientRows.map((doc) => {
                  const canonicalId = doc.canonicalDocumentId ?? doc.id;
                  const mimeType = counsellingDocumentMimeType(doc.fileType ?? null);
                  const canRemove = Boolean(
                    canDelete && currentUserId && doc.createdByUserId === currentUserId,
                  );
                  return (
                    <DocumentActions
                      key={doc.id}
                      patientId={patientId}
                      documentName={doc.documentName}
                      documentType={doc.documentType}
                      status={doc.status}
                      mimeType={mimeType}
                      canonicalId={canonicalId}
                      canRemove={canRemove}
                      onRequestRemove={() => setPendingRemove({ documentId: doc.id })}
                    />
                  );
                })}
              </ul>
            </div>
          ) : null}
        </CounsellingCardContent>
      </CounsellingCard>

      <CounsellingAlertDialog
        open={pendingRemove != null}
        onOpenChange={(open) => {
          if (!open && !removing) setPendingRemove(null);
        }}
      >
        <CounsellingAlertDialogContent data-testid="counselling-document-remove-confirm">
          <CounsellingAlertDialogHeader>
            <CounsellingAlertDialogTitle>
              {COUNSELLING_DOCUMENT_REMOVE_CONFIRM.title}
            </CounsellingAlertDialogTitle>
            <CounsellingAlertDialogDescription>
              {COUNSELLING_DOCUMENT_REMOVE_CONFIRM.description}
            </CounsellingAlertDialogDescription>
          </CounsellingAlertDialogHeader>
          <CounsellingAlertDialogFooter>
            <CounsellingAlertDialogCancel type="button" disabled={removing}>
              {COUNSELLING_DOCUMENT_REMOVE_CONFIRM.cancelLabel}
            </CounsellingAlertDialogCancel>
            <CounsellingAlertDialogAction
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={removing}
              data-testid="counselling-document-remove-confirm-submit"
              onClick={(event) => {
                event.preventDefault();
                void confirmRemove();
              }}
            >
              {COUNSELLING_DOCUMENT_REMOVE_CONFIRM.confirmLabel}
            </CounsellingAlertDialogAction>
          </CounsellingAlertDialogFooter>
        </CounsellingAlertDialogContent>
      </CounsellingAlertDialog>

      <CustomDocumentModal
        sessionId={sessionId}
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onComplete={() => {
          void reload();
        }}
      />
    </>
  );
}
