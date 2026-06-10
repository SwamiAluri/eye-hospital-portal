'use client';

import { useState } from 'react';
import { Download, Loader2, Printer, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  CounsellingButton,
  CounsellingDialog,
  CounsellingDialogContent,
  CounsellingDialogFooter,
  CounsellingDialogHeader,
  CounsellingDialogTitle,
  CounsellingEmptyState,
} from '@/components/counsellors-desk/session/primitives';
import {
  COUNSELLING_ESTIMATE_PRINT_ROOT_ID,
  CounsellingEstimatePdfDocument,
} from '@/components/counsellors-desk/session/CounsellingEstimatePdfDocument';
import type { CounsellingEstimatePdfData } from '@/lib/counsellors-desk/counselling-estimate-pdf-content';
import {
  canShareCounsellingEstimatePdf,
  downloadCounsellingEstimatePdf,
  printCounsellingEstimateDocument,
  shareCounsellingEstimatePdf,
} from '@/lib/counsellors-desk/counselling-estimate-pdf';

interface CounsellingEstimatePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CounsellingEstimatePdfData | null;
}

export function CounsellingEstimatePrintDialog({
  open,
  onOpenChange,
  data,
}: CounsellingEstimatePrintDialogProps) {
  const [busy, setBusy] = useState<'print' | 'download' | 'share' | null>(null);
  const shareAvailable = canShareCounsellingEstimatePdf();

  const filename = data
    ? `counselling-estimate-${data.uhid}-${data.issueDate.toISOString().slice(0, 10)}.pdf`
    : 'counselling-estimate.pdf';

  const handlePrint = async () => {
    setBusy('print');
    try {
      printCounsellingEstimateDocument(COUNSELLING_ESTIMATE_PRINT_ROOT_ID);
    } catch {
      toast.error('Unable to open print dialog');
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    setBusy('download');
    try {
      await downloadCounsellingEstimatePdf(COUNSELLING_ESTIMATE_PRINT_ROOT_ID, filename);
      toast.success('Estimate PDF downloaded');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy('share');
    try {
      const shared = await shareCounsellingEstimatePdf(
        COUNSELLING_ESTIMATE_PRINT_ROOT_ID,
        filename,
        'Counselling estimate',
      );
      if (shared) {
        toast.success('Estimate shared');
      } else {
        toast.error('Sharing is not supported on this device');
      }
    } catch {
      toast.error('Failed to share PDF');
    } finally {
      setBusy(null);
    }
  };

  return (
    <CounsellingDialog open={open} onOpenChange={onOpenChange}>
      <CounsellingDialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 p-0">
        <CounsellingDialogHeader className="border-b border-counselling-border px-6 py-4">
          <CounsellingDialogTitle>Print estimate</CounsellingDialogTitle>
        </CounsellingDialogHeader>
        <div className="flex-1 overflow-y-auto bg-counselling-muted px-4 py-4">
          {data ? (
            <CounsellingEstimatePdfDocument data={data} />
          ) : (
            <CounsellingEmptyState
              compact
              title="No estimate data"
              description="Select a procedure or package to generate a printable estimate."
            />
          )}
        </div>
        <CounsellingDialogFooter className="border-t border-counselling-border px-6 py-4">
          <CounsellingButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </CounsellingButton>
          <CounsellingButton
            type="button"
            variant="outline"
            disabled={!data || busy !== null}
            onClick={() => void handlePrint()}
            className="border-counselling-primary/40 text-counselling-primary hover:bg-counselling-accent"
          >
            {busy === 'print' ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            Print
          </CounsellingButton>
          {shareAvailable && (
            <CounsellingButton
              type="button"
              variant="outline"
              disabled={!data || busy !== null}
              onClick={() => void handleShare()}
              className="border-counselling-primary/40 bg-counselling-accent text-counselling-primary hover:bg-counselling-accent"
            >
              {busy === 'share' ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              Share
            </CounsellingButton>
          )}
          <CounsellingButton
            type="button"
            disabled={!data || busy !== null}
            onClick={() => void handleDownload()}
            className="bg-counselling-primary hover:bg-counselling-primary/90"
          >
            {busy === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download PDF
          </CounsellingButton>
        </CounsellingDialogFooter>
      </CounsellingDialogContent>
    </CounsellingDialog>
  );
}
