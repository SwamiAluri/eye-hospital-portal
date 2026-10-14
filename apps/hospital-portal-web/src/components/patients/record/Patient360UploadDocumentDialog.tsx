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
import {
  ModalSelectContent,
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import {
  CanonicalDocumentDuplicateError,
  type CanonicalDocumentDuplicateCandidate,
  type CanonicalDocumentUploadOptions,
} from '@/lib/api/patient-canonical-documents.api';
import {
  defaultPatient360DocumentTypeId,
  isWritablePatient360DocumentArea,
  PATIENT_360_DOCUMENT_AREAS,
  patient360DocumentTypesForArea,
  type Patient360DocumentAreaId,
} from '@/lib/patients/patient-360-document-areas';

export type Patient360UploadPayload =
  | {
      area: 'general';
      file: File;
      options: CanonicalDocumentUploadOptions;
    }
  | {
      area: 'counselling';
      file: File;
      documentType: string;
    };

export interface Patient360UploadDocumentDialogProps {
  open: boolean;
  uploading?: boolean;
  patientId: string;
  onOpenChange: (open: boolean) => void;
  onUpload: (payload: Patient360UploadPayload) => Promise<void>;
}

function selectedFileSummary(file: File): string {
  const kilobytes = file.size / 1024;
  const sizeLabel = kilobytes >= 1024 ? `${(kilobytes / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kilobytes))} KB`;
  return `${file.name} · ${sizeLabel}`;
}

export function Patient360UploadDocumentDialog({
  open,
  uploading = false,
  patientId: _patientId,
  onOpenChange,
  onUpload,
}: Patient360UploadDocumentDialogProps) {
  const areaFieldId = useId();
  const typeFieldId = useId();
  const fileFieldId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [area, setArea] = useState<Patient360DocumentAreaId>('general');
  const [classification, setClassification] = useState(defaultPatient360DocumentTypeId('general'));
  const [file, setFile] = useState<File | null>(null);
  const [duplicate, setDuplicate] = useState<CanonicalDocumentDuplicateCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const typeOptions = patient360DocumentTypesForArea(area);
  const areaWritable = isWritablePatient360DocumentArea(area);

  function reset() {
    setArea('general');
    setClassification(defaultPatient360DocumentTypeId('general'));
    setFile(null);
    setDuplicate(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function selectArea(next: Patient360DocumentAreaId) {
    setArea(next);
    setClassification(defaultPatient360DocumentTypeId(next));
    setDuplicate(null);
    setError(null);
  }

  async function submit(options?: CanonicalDocumentUploadOptions) {
    if (!file || !areaWritable) return;

    if (area === 'counselling') {
      setError(null);
      try {
        await onUpload({
          area: 'counselling',
          file,
          documentType: classification,
        });
        reset();
        onOpenChange(false);
      } catch (caught) {
        setError(getApiErrorMessage(caught, 'Document upload failed.'));
      }
      return;
    }

    setError(null);
    try {
      await onUpload({
        area: 'general',
        file,
        options: {
          classification,
          ...options,
        },
      });
      reset();
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof CanonicalDocumentDuplicateError) {
        setDuplicate(caught.candidate);
        return;
      }
      setError(getApiErrorMessage(caught, 'Document upload failed.'));
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
      <DialogContent size="md" className="gap-5 sm:max-w-md">
        {duplicate && area === 'general' ? (
          <>
            <DialogHeader>
              <DialogTitle>Document already exists</DialogTitle>
              <DialogDescription>
                A document with the same patient context and document type is already available.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-gray-600">What would you like to do?</p>
            <DialogFooter className="gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => { reset(); onOpenChange(false); }}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => void submit({ duplicateResolution: 'keepBoth' })}
              >
                Keep both
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={uploading}
                onClick={() => void submit({ duplicateResolution: 'replace', replaceDocumentId: duplicate.id })}
              >
                Replace
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Upload document</DialogTitle>
              <DialogDescription>
                Choose the document area, then attach a PDF, JPEG, or PNG.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor={areaFieldId}>Document area</Label>
                <Select value={area} onValueChange={(value) => selectArea(value as Patient360DocumentAreaId)}>
                  <SelectTrigger id={areaFieldId} className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <ModalSelectContent>
                    {PATIENT_360_DOCUMENT_AREAS.map((item) => (
                      <SelectItem key={item.id} value={item.id} textValue={item.label} disabled={!item.writable}>
                        <span className="flex min-w-0 flex-col py-0.5">
                          <span>{item.label}</span>
                          {!item.writable && item.unavailableHint ? (
                            <span className="text-xs font-normal text-gray-500">{item.unavailableHint}</span>
                          ) : null}
                        </span>
                      </SelectItem>
                    ))}
                  </ModalSelectContent>
                </Select>
                {!areaWritable ? (
                  <p className="text-xs text-gray-500">
                    Upload from this area is not available in Patient 360 yet.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={typeFieldId}>Document type</Label>
                <Select value={classification} onValueChange={setClassification} disabled={!areaWritable}>
                  <SelectTrigger id={typeFieldId} className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <ModalSelectContent>
                    {typeOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </ModalSelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={fileFieldId}>File</Label>
                <div
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    setFile(event.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  <input
                    ref={fileInputRef}
                    id={fileFieldId}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                    className="sr-only"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose file
                  </Button>
                  <span className={`min-w-0 truncate text-sm ${file ? 'text-gray-900' : 'text-gray-500'}`}>
                    {file ? selectedFileSummary(file) : 'PDF, JPEG, or PNG · 20 MB max'}
                  </span>
                </div>
              </div>
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={uploading || !file || !areaWritable}
                onClick={() => void submit()}
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
