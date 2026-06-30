'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, FileText, RefreshCw, X } from 'lucide-react';

export interface InvestigationDocumentModalProps {
  open: boolean;
  fileName: string | null;
  fileUrl: string | null;
  onClose: () => void;
  /** Optional — when provided, shows a "Replace" action. */
  onReplace?: () => void;
}

function isImageName(name: string | null): boolean {
  if (!name) return false;
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);
}

export function InvestigationDocumentModal({
  open,
  fileName,
  fileUrl,
  onClose,
  onReplace,
}: InvestigationDocumentModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const label = fileName ?? 'Report';
  const isImage = isImageName(fileName);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${label}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
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
            {fileUrl && (
              <a
                href={fileUrl}
                download={fileName ?? undefined}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
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

        <div className="flex min-h-[60vh] flex-1 items-center justify-center overflow-auto bg-gray-100">
          {!fileUrl ? (
            <p className="p-6 text-sm text-gray-500">Preview unavailable.</p>
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <iframe src={fileUrl} title={label} className="h-[70vh] w-full border-0" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
