'use client';

import { useEffect, useState } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { IpOverlayDialog } from '@/components/ip-management/IpOverlayDialog';
import {
  PREVIEW_LOAD_FAILED_MESSAGE,
  resolveDocumentPreviewKind,
} from '@/lib/ccms/case-document-preview';

export interface InvestigationDocumentModalProps {
  open: boolean;
  fileName: string | null;
  fileUrl: string | null;
  mimeType?: string | null;
  /** When set, shows explanatory content instead of file embed (biometry/pacs pointers). */
  pointerNotice?: string | null;
  loading?: boolean;
  accessError?: string | null;
  /** When true, skip embed and show unsupported-type fallback (Open/Download still available). */
  unsupported?: boolean;
  /** Re-fetch authorized URL for Open/Download when blob handlers are unavailable (legacy HTTP URLs). */
  onResolveAccessUrl?: () => Promise<string>;
  /** Preferred: fetch via authenticated content and open in a new tab. */
  onOpen?: () => Promise<void>;
  /** Preferred: fetch via authenticated content and trigger download. */
  onDownload?: () => Promise<void>;
  onClose: () => void;
  /** Optional — when provided, shows a "Replace" action. */
  onReplace?: () => void;
}

function DocumentActionButton({
  label,
  icon: Icon,
  onAction,
  fallbackUrl,
  fileName,
  onResolveAccessUrl,
  mode,
}: {
  label: string;
  icon: typeof ExternalLink;
  onAction?: () => Promise<void>;
  fallbackUrl: string;
  fileName: string | null;
  onResolveAccessUrl?: () => Promise<string>;
  mode: 'open' | 'download';
}) {
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (onAction) {
      setBusy(true);
      try {
        await onAction();
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!onResolveAccessUrl) return;
    setBusy(true);
    try {
      const url = await onResolveAccessUrl();
      if (mode === 'open') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName ?? 'document';
        anchor.rel = 'noopener noreferrer';
        anchor.click();
      }
    } finally {
      setBusy(false);
    }
  };

  const className =
    'inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50';

  if (onAction || onResolveAccessUrl) {
    return (
      <button type="button" disabled={busy} onClick={(e) => void handleClick(e)} className={className}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
        {busy ? '…' : label}
      </button>
    );
  }

  return (
    <a
      href={fallbackUrl}
      {...(mode === 'open'
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : { download: fileName ?? undefined })}
      className={className}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

function PreviewFallback({
  fileUrl,
  fileName,
  message,
  onOpen,
  onDownload,
  onResolveAccessUrl,
}: {
  fileUrl: string;
  fileName: string | null;
  message: string;
  onOpen?: () => Promise<void>;
  onDownload?: () => Promise<void>;
  onResolveAccessUrl?: () => Promise<string>;
}) {
  return (
    <div className="mx-auto max-w-md space-y-4 p-8 text-center">
      <p className="text-sm text-gray-600">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onOpen || onDownload || onResolveAccessUrl ? (
          <>
            <DocumentActionButton
              label="Open"
              icon={ExternalLink}
              fallbackUrl={fileUrl}
              fileName={fileName}
              onAction={onOpen}
              onResolveAccessUrl={onOpen ? undefined : onResolveAccessUrl}
              mode="open"
            />
            <DocumentActionButton
              label="Download"
              icon={Download}
              fallbackUrl={fileUrl}
              fileName={fileName}
              onAction={onDownload}
              onResolveAccessUrl={onDownload ? undefined : onResolveAccessUrl}
              mode="download"
            />
          </>
        ) : (
          <>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in new tab
            </a>
            <a
              href={fileUrl}
              download={fileName ?? undefined}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export function InvestigationDocumentModal({
  open,
  fileName,
  fileUrl,
  mimeType,
  pointerNotice,
  loading = false,
  accessError,
  unsupported = false,
  onResolveAccessUrl,
  onOpen,
  onDownload,
  onClose,
  onReplace,
}: InvestigationDocumentModalProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (open) setLoadFailed(false);
  }, [open, fileUrl, mimeType, fileName]);

  if (!open) return null;

  const label = fileName ?? 'Document';
  const previewKind = resolveDocumentPreviewKind(fileUrl, mimeType, fileName);
  const showDocumentActions =
    previewKind !== 'pointer' && (!!fileUrl || unsupported || !!accessError);

  return (
    <IpOverlayDialog
      open={open}
      onClose={onClose}
      size="4xl"
      title={label}
      dismissOnOverlay
      className="flex h-[min(90vh,900px)] max-h-[90vh] flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="truncate text-sm font-semibold text-gray-900">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {onReplace && (
              <button
                type="button"
                onClick={onReplace}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Replace
              </button>
            )}
            {showDocumentActions && fileUrl && (
              <DocumentActionButton
                label="Download"
                icon={Download}
                fallbackUrl={fileUrl}
                fileName={fileName}
                onAction={onDownload}
                onResolveAccessUrl={onDownload ? undefined : onResolveAccessUrl}
                mode="download"
              />
            )}
            {showDocumentActions && fileUrl && (
              <DocumentActionButton
                label="Open"
                icon={ExternalLink}
                fallbackUrl={fileUrl}
                fileName={fileName}
                onAction={onOpen}
                onResolveAccessUrl={onOpen ? undefined : onResolveAccessUrl}
                mode="open"
              />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-gray-100">
          {pointerNotice ? (
            <p className="max-w-lg p-6 text-sm text-gray-700">{pointerNotice}</p>
          ) : loading ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
              Loading document…
            </div>
          ) : accessError ? (
            <div className="flex h-full items-center justify-center">
              <PreviewFallback
                fileUrl={fileUrl ?? '#'}
                fileName={fileName}
                message={accessError}
                onOpen={onOpen}
                onDownload={onDownload}
                onResolveAccessUrl={onResolveAccessUrl}
              />
            </div>
          ) : unsupported || previewKind === 'unsupported' ? (
            <div className="flex h-full items-center justify-center">
              <PreviewFallback
                fileUrl={fileUrl ?? '#'}
                fileName={fileName}
                message="This file type cannot be previewed in the browser."
                onOpen={onOpen}
                onDownload={onDownload}
                onResolveAccessUrl={onResolveAccessUrl}
              />
            </div>
          ) : !fileUrl ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
              Preview unavailable.
            </div>
          ) : loadFailed ? (
            <div className="flex h-full items-center justify-center">
              <PreviewFallback
                fileUrl={fileUrl}
                fileName={fileName}
                message={PREVIEW_LOAD_FAILED_MESSAGE}
                onOpen={onOpen}
                onDownload={onDownload}
                onResolveAccessUrl={onResolveAccessUrl}
              />
            </div>
          ) : previewKind === 'image' ? (
            <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl}
                alt={label}
                className="max-h-full max-w-full object-contain"
                onError={() => setLoadFailed(true)}
              />
            </div>
          ) : (
            <iframe
              src={fileUrl}
              title={label}
              className="absolute inset-0 h-full w-full border-0 bg-white"
              onError={() => setLoadFailed(true)}
            />
          )}
        </div>
      </div>
    </IpOverlayDialog>
  );
}
