'use client';

import { ExternalLink, FileText } from 'lucide-react';

export interface InvestigationDocumentPreviewProps {
  fileName: string | null;
  fileUrl: string | null;
  contentType?: string | null;
  compact?: boolean;
}

export function InvestigationDocumentPreview({
  fileName,
  fileUrl,
  contentType,
  compact = false,
}: InvestigationDocumentPreviewProps) {
  if (!fileName && !fileUrl) return null;

  const isImage = contentType?.startsWith('image/') ?? false;
  const label = fileName ?? 'Report';

  if (compact) {
    return (
      <a
        href={fileUrl ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-900 underline-offset-2 hover:underline"
      >
        <FileText className="h-3.5 w-3.5 shrink-0" />
        {label}
        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
      </a>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-gray-500 shrink-0" />
          <span className="text-sm font-medium text-gray-800 truncate">{label}</span>
        </div>
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-900 shrink-0"
          >
            Open
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {fileUrl && isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl}
          alt={label}
          className="max-h-40 rounded border border-gray-200 object-contain bg-white"
        />
      )}
    </div>
  );
}
