'use client';

import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/auth-interceptors';

export interface LabAttachReportDialogProps {
  open: boolean;
  uploading?: boolean;
  testName: string;
  onOpenChange: (open: boolean) => void;
  onAttach: (file: File) => Promise<void>;
}

function selectedFileSummary(file: File): string {
  const kilobytes = file.size / 1024;
  const sizeLabel =
    kilobytes >= 1024 ? `${(kilobytes / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kilobytes))} KB`;
  return `${file.name} · ${sizeLabel}`;
}

export function LabAttachReportDialog({
  open,
  uploading = false,
  testName,
  onOpenChange,
  onAttach,
}: LabAttachReportDialogProps) {
  const fileFieldId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function submit() {
    if (!file || uploading) return;
    setError(null);
    try {
      await onAttach(file);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Attach report failed.'));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attach Report</DialogTitle>
          <DialogDescription>
            Attach a PDF or image report to {testName}. Clinical status is not changed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={fileFieldId}>Report file</Label>
            <input
              id={fileFieldId}
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-800"
              disabled={uploading}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
            {file ? <p className="text-xs text-gray-500">{selectedFileSummary(file)}</p> : null}
            <p className="text-xs text-gray-500">PDF, JPEG, or PNG. Maximum 20 MB.</p>
          </div>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={uploading}
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!file || uploading} onClick={() => void submit()}>
            {uploading ? 'Attaching…' : 'Attach Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
