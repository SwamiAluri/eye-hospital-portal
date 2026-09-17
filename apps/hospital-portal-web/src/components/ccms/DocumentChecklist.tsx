'use client';

import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  FileCheck2,
  FileX2,
  FileText,
  Upload,
  Camera,
  Trash2,
  Eye,
  Loader2,
} from 'lucide-react';

export interface DocumentSlot {
  key: string;
  label: string;
  required: boolean;
  accept?: string;
  uploadedUrl?: string;
  uploadedAt?: string;
  docId?: string;
  fileName?: string;
  mimeType?: string;
}

interface Props {
  slots: DocumentSlot[];
  caseId: string;
  onUpload?: (key: string, file: File) => Promise<string>;
  onDelete?: (key: string, docId: string) => Promise<void>;
  onPreview?: (slot: DocumentSlot) => void;
  /** Opens document in a new tab via authenticated content blob. */
  onOpenDocument?: (slot: DocumentSlot) => Promise<void>;
  /** Downloads document via authenticated content blob. */
  onDownloadDocument?: (slot: DocumentSlot) => Promise<void>;
  /** @deprecated Use onOpenDocument/onDownloadDocument for CCMS blobs. */
  onResolveAccessUrl?: (slot: DocumentSlot) => Promise<string>;
  readOnly?: boolean;
  showScanButton?: boolean;
}

const actionBtn =
  'inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40';

const primaryActionBtn =
  'inline-flex items-center gap-1 rounded-md border border-counselling-primary/30 bg-counselling-accent px-2 py-1 text-[11px] font-semibold text-counselling-primary hover:bg-counselling-accent/80 transition-colors';

export function DocumentChecklist({
  slots,
  caseId: _caseId,
  onUpload,
  onDelete,
  onPreview,
  onOpenDocument,
  onDownloadDocument,
  onResolveAccessUrl,
  readOnly = false,
  showScanButton = true,
}: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const openDocument = async (slot: DocumentSlot) => {
    if (!slot.uploadedUrl) return;
    setOpening(slot.key);
    try {
      if (onOpenDocument) {
        await onOpenDocument(slot);
        return;
      }
      const url = onResolveAccessUrl
        ? await onResolveAccessUrl(slot)
        : slot.uploadedUrl;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // Parent handler may already have toasted a specific message.
    } finally {
      setOpening(null);
    }
  };

  const downloadDocument = async (slot: DocumentSlot) => {
    if (!slot.uploadedUrl) return;
    setDownloading(slot.key);
    try {
      if (onDownloadDocument) {
        await onDownloadDocument(slot);
      }
    } catch {
      // Parent handler may already have toasted a specific message.
    } finally {
      setDownloading(null);
    }
  };

  const handleFile = async (key: string, file: File) => {
    if (!onUpload) return;
    setUploading(key);
    try {
      await onUpload(key, file);
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (key: string, docId: string) => {
    if (!onDelete) return;
    setDeleting(key);
    try {
      await onDelete(key, docId);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <ul className="space-y-1.5">
      {slots.map((slot) => {
        const isUploaded = !!slot.uploadedUrl;
        const isRequired = slot.required;

        const borderCls = isUploaded
          ? 'border-l-2 border-emerald-400'
          : isRequired
            ? 'border-l-2 border-amber-300'
            : 'border-l-2 border-gray-200';

        const rowBg = isUploaded ? 'bg-emerald-50/40' : isRequired ? 'bg-amber-50/40' : 'bg-white';

        const StatusIcon = isUploaded
          ? () => (
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
              </span>
            )
          : isRequired
            ? () => (
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <FileX2 className="h-3.5 w-3.5 text-amber-600" />
                </span>
              )
            : () => (
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <FileText className="h-3.5 w-3.5 text-gray-400" />
                </span>
              );

        const uploadedMeta = isUploaded && (
          <p className="mt-0.5 text-[11px] text-emerald-600">
            {slot.fileName ? (
              <>
                <span className="font-medium text-emerald-700">{slot.fileName}</span>
                {slot.uploadedAt ? <span className="text-emerald-500"> · </span> : null}
              </>
            ) : null}
            {slot.uploadedAt
              ? `Uploaded ${new Date(slot.uploadedAt).toLocaleDateString('en-IN')}`
              : slot.fileName
                ? 'Uploaded'
                : null}
          </p>
        );

        const uploadedActions = isUploaded && (
          <>
            {onPreview && (
              <button
                type="button"
                data-testid="ccms-doc-preview-btn"
                onClick={() => onPreview(slot)}
                className={primaryActionBtn}
              >
                <Eye className="h-3 w-3" />
                Preview
              </button>
            )}
            <button
              type="button"
              data-testid="ccms-doc-open-btn"
              disabled={opening === slot.key}
              onClick={() => void openDocument(slot)}
              className={actionBtn}
            >
              {opening === slot.key ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ExternalLink className="h-3 w-3" />
              )}
              Open
            </button>
            {onDownloadDocument && (
              <button
                type="button"
                data-testid="ccms-doc-download-btn"
                disabled={downloading === slot.key}
                onClick={() => void downloadDocument(slot)}
                className={actionBtn}
              >
                {downloading === slot.key ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Download
              </button>
            )}
            {!readOnly && onUpload && (
              <label
                className={`${actionBtn} cursor-pointer ${uploading === slot.key ? 'pointer-events-none' : ''}`}
              >
                {uploading === slot.key ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                Replace
                <input
                  type="file"
                  className="hidden"
                  accept={slot.accept ?? 'image/*,application/pdf'}
                  disabled={uploading !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(slot.key, f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            {!readOnly && slot.docId && onDelete && (
              <button
                type="button"
                data-testid="ccms-doc-remove-btn"
                disabled={deleting === slot.key}
                onClick={() => handleDelete(slot.key, slot.docId!)}
                className={`${actionBtn} hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
              >
                {deleting === slot.key ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Remove
              </button>
            )}
          </>
        );

        const scanAction = !readOnly && showScanButton && onUpload && (
          <label
            className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-counselling-accent hover:text-counselling-primary"
            title="Scan with camera"
          >
            {uploading === slot.key ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-counselling-primary" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            <input
              type="file"
              className="hidden"
              accept={slot.accept ?? 'image/*,application/pdf'}
              capture="environment"
              disabled={uploading !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(slot.key, f);
                e.target.value = '';
              }}
            />
          </label>
        );

        const lockedEmptyHint = readOnly && !isUploaded && (
          <span className="text-[11px] text-gray-400 italic">View only</span>
        );

        const uploadAction = !readOnly && !isUploaded && onUpload && (
          <label
            className={`flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              isRequired
                ? 'bg-counselling-primary text-white shadow-sm hover:bg-counselling-primary/90'
                : 'bg-counselling-accent text-counselling-primary hover:bg-counselling-accent/80'
            } ${uploading === slot.key ? 'pointer-events-none' : ''}`}
          >
            {uploading === slot.key ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            Upload
            <input
              type="file"
              className="hidden"
              accept={slot.accept ?? 'image/*,application/pdf'}
              disabled={uploading !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(slot.key, f);
                e.target.value = '';
              }}
            />
          </label>
        );

        return (
          <li
            key={slot.key}
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors ${rowBg} ${borderCls} hover:brightness-95`}
            data-testid={`ccms-doc-row-${slot.key}`}
            data-uploaded={isUploaded ? 'true' : 'false'}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <StatusIcon />
              <div className="min-w-0">
                <p
                  className={`truncate text-xs leading-snug ${
                    isUploaded
                      ? 'text-gray-700'
                      : isRequired
                        ? 'font-semibold text-gray-800'
                        : 'text-gray-500'
                  }`}
                >
                  {slot.label}
                  {isRequired && !isUploaded && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      Required · Outstanding
                    </span>
                  )}
                  {isUploaded && (
                    <span className="ml-1.5 rounded bg-emerald-100 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Uploaded
                    </span>
                  )}
                </p>
                {uploadedMeta}
              </div>
            </div>

            <div className="ml-2 flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
              {readOnly ? (
                <>
                  {isUploaded && uploadedActions}
                  {lockedEmptyHint}
                </>
              ) : (
                <>
                  {uploadedActions}
                  {scanAction}
                  {uploadAction}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
