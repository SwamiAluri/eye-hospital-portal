'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { downloadLmsOfficialPdf } from '@/lib/lms/lms-reports.api';

export type ReportOfficialPdfPreviewProps = {
  reportId: string;
  operatingBranchId: string;
  fileName: string;
  disabled?: boolean;
  /** Report Detail uses outline Button; worklist uses link-style to match Open/Download. */
  triggerVariant?: 'button' | 'link';
  triggerLabel?: string;
  triggerTestId?: string;
};

/**
 * L-REP-03 CUT D-A — Official PDF Preview (Report Detail + Reports worklist).
 * Authenticated Blob via existing CUT C `downloadLmsOfficialPdf` (DOWNLOAD_OFFICIAL_PDF audit).
 * Shared Dialog → object URL → PDF iframe lifecycle; no second viewer.
 */
export function ReportOfficialPdfPreview({
  reportId,
  operatingBranchId,
  fileName,
  disabled = false,
  triggerVariant = 'button',
  triggerLabel = 'Preview Official PDF',
  triggerTestId = 'report-official-pdf-preview',
}: ReportOfficialPdfPreviewProps) {
  const [open, setOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [contentState, setContentState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>(
    'idle',
  );

  const loadContent = useCallback(
    () =>
      downloadLmsOfficialPdf({
        reportId,
        operatingBranchId,
      }),
    [reportId, operatingBranchId],
  );

  useEffect(() => {
    if (!open) {
      setContentState('idle');
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    setContentState('loading');
    void loadContent()
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
        setContentState('ready');
      })
      .catch(() => {
        if (!cancelled) setContentState('unavailable');
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, loadContent]);

  useEffect(() => {
    if (open) return;
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
  }, [open, objectUrl]);

  const title = fileName.trim() || 'Official PDF';

  const trigger =
    triggerVariant === 'link' ? (
      <button
        type="button"
        className="text-emerald-700 underline disabled:opacity-50"
        disabled={disabled}
        onClick={() => setOpen(true)}
        data-testid={triggerTestId}
      >
        {triggerLabel}
      </button>
    ) : (
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        data-testid={triggerTestId}
      >
        {triggerLabel}
      </Button>
    );

  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="4xl"
          className="flex max-h-[min(90vh,56rem)] w-[calc(100vw-2rem)] flex-col gap-4 overflow-hidden"
          data-testid="report-official-pdf-preview-dialog"
        >
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>Official PDF Preview</DialogTitle>
          </DialogHeader>

          <div className="min-w-0 shrink-0 space-y-1 text-sm text-gray-700">
            <p className="truncate font-medium text-gray-900" title={title}>
              {title}
            </p>
            <p className="text-gray-600">Official PDF · Enterprise LMS</p>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-3">
            {contentState === 'loading' ? (
              <p role="status" data-testid="report-official-pdf-preview-loading">
                Loading preview…
              </p>
            ) : null}
            {contentState === 'ready' && objectUrl ? (
              <iframe
                title={title}
                src={objectUrl}
                className="h-[min(60vh,36rem)] w-full rounded-md border-0 bg-white"
                data-testid="report-official-pdf-preview-frame"
              />
            ) : null}
            {contentState === 'unavailable' ? (
              <p role="status" data-testid="report-official-pdf-preview-error">
                Preview is not available. Use Download to open the file.
              </p>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 gap-2 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
              data-testid="report-official-pdf-preview-close"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
