'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  isPatient360DocumentZoomed,
  nextPatient360DocumentZoomIn,
  nextPatient360DocumentZoomOut,
  PATIENT_360_DOCUMENT_FIT_ZOOM,
  patient360DocumentZoomLabel,
  type Patient360DocumentZoomPercent,
} from '@/lib/patients/patient-360-document-preview-zoom';
import { printPatient360DocumentFromLoader } from '@/lib/patients/patient-360-document-print';
import { toast } from '@/lib/toast';
import { patient360LinkClass } from './Patient360RecordTable';

export async function runPatient360DocumentPrint(input: {
  fileName: string;
  mimeType?: string | null;
  loadContent: () => Promise<Blob>;
}): Promise<void> {
  const result = await printPatient360DocumentFromLoader(input);
  if (!result.opened) {
    toast.error('Document print failed.');
  }
}

export interface Patient360DocumentPreviewProps {
  fileName: string;
  documentType?: string | null;
  source?: string | null;
  uploadedLabel?: string | null;
  statusLabel?: string | null;
  mimeType?: string | null;
  canLoadContent?: boolean;
  loadContent?: () => Promise<Blob>;
  canDownload?: boolean;
  onDownload?: () => void;
}

function Patient360ImageViewport({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [zoom, setZoom] = useState<Patient360DocumentZoomPercent>(PATIENT_360_DOCUMENT_FIT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const zoomed = isPatient360DocumentZoomed(zoom);

  function fit() {
    setZoom(PATIENT_360_DOCUMENT_FIT_ZOOM);
    setPan({ x: 0, y: 0 });
    setDragging(false);
    dragOrigin.current = null;
  }

  function zoomIn() {
    setZoom((current) => nextPatient360DocumentZoomIn(current));
  }

  function zoomOut() {
    setZoom((current) => {
      const next = nextPatient360DocumentZoomOut(current);
      if (next <= PATIENT_360_DOCUMENT_FIT_ZOOM) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  }

  function onWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.deltaY < 0) zoomIn();
    else zoomOut();
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!zoomed) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging || !dragOrigin.current) return;
    event.preventDefault();
    setPan({
      x: dragOrigin.current.panX + (event.clientX - dragOrigin.current.x),
      y: dragOrigin.current.panY + (event.clientY - dragOrigin.current.y),
    });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    dragOrigin.current = null;
    setDragging(false);
  }

  return (
    <div className="flex h-full min-h-[min(60vh,36rem)] flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Document zoom">
        <Button type="button" variant="secondary" size="sm" aria-label="Zoom out" onClick={zoomOut}>
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-[3.5rem] text-center text-xs font-medium tabular-nums text-gray-700" aria-live="polite">
          <span className="sr-only">Zoom level </span>
          {patient360DocumentZoomLabel(zoom)}
        </span>
        <Button type="button" variant="secondary" size="sm" aria-label="Zoom in" onClick={zoomIn}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="secondary" size="sm" aria-label="Fit to screen" onClick={fit}>
          Fit
        </Button>
      </div>
      <div
        className={`relative min-h-0 flex-1 overflow-hidden rounded-md bg-white ${
          zoomed ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="flex h-full w-full items-center justify-center select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
            transformOrigin: 'center center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- blob preview from authenticated download */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

export function Patient360DocumentPreview({
  fileName,
  documentType,
  source,
  uploadedLabel,
  statusLabel,
  mimeType,
  canLoadContent = false,
  loadContent,
  canDownload = false,
  onDownload,
}: Patient360DocumentPreviewProps) {
  const [open, setOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [contentState, setContentState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open) {
      setContentState('idle');
      return;
    }
    if (!canLoadContent || !loadContent) {
      setContentState('unavailable');
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
  }, [open, canLoadContent, loadContent]);

  useEffect(() => {
    if (open) return;
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
  }, [open, objectUrl]);

  const title = fileName.trim() || 'Document';
  const normalizedMime = (mimeType ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? '';
  const isImage = normalizedMime === 'image/jpeg' || normalizedMime === 'image/png' || normalizedMime === 'image/jpg';
  const isPdf = normalizedMime === 'application/pdf';
  const canPrint = Boolean(canLoadContent && loadContent);

  async function handlePrint() {
    if (!loadContent || !canPrint) return;
    setPrinting(true);
    try {
      await runPatient360DocumentPrint({
        fileName: title,
        mimeType,
        loadContent,
      });
    } finally {
      setPrinting(false);
    }
  }

  const metaLine = [documentType, source].filter(Boolean).join(' · ');
  const statusLine = [uploadedLabel, statusLabel].filter(Boolean).join(' · ');

  return (
    <>
      <button type="button" className={patient360LinkClass} onClick={() => setOpen(true)}>
        Preview
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="4xl"
          className="flex max-h-[min(90vh,56rem)] w-[calc(100vw-2rem)] flex-col gap-4 overflow-hidden"
        >
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>

          <div className="min-w-0 shrink-0 space-y-1 text-sm text-gray-700">
            <p className="truncate font-medium text-gray-900" title={title}>
              {title}
            </p>
            {metaLine ? <p className="text-gray-600">{metaLine}</p> : null}
            {statusLine ? <p className="text-gray-600">{statusLine}</p> : null}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-3">
            {contentState === 'loading' ? <p role="status">Loading preview…</p> : null}
            {contentState === 'ready' && objectUrl && isImage ? (
              <Patient360ImageViewport src={objectUrl} alt={title} />
            ) : null}
            {contentState === 'ready' && objectUrl && isPdf ? (
              <iframe
                title={title}
                src={objectUrl}
                className="h-[min(60vh,36rem)] w-full rounded-md border-0 bg-white"
              />
            ) : null}
            {contentState === 'ready' && objectUrl && !isImage && !isPdf ? (
              <p role="status">Preview is not available for this file type. Use Download to open the file.</p>
            ) : null}
            {contentState === 'unavailable' ? (
              <p role="status">
                {canLoadContent
                  ? 'Preview is not available. Use Download to open the file.'
                  : 'Document preview is limited to metadata for this source. Use Download when available.'}
              </p>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 gap-2 sm:justify-end">
            {canPrint ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={printing}
                aria-label="Print document"
                onClick={() => void handlePrint()}
              >
                Print
              </Button>
            ) : null}
            {canDownload && onDownload ? (
              <Button type="button" variant="primary" size="sm" aria-label="Download document" onClick={onDownload}>
                Download
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
