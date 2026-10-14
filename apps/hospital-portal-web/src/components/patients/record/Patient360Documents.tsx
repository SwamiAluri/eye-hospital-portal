'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import {
  clinicalEmptyMessage,
  clinicalUnauthorizedMessage,
  clinicalUnavailableMessage,
  loadPatient360Clinical,
  type ChartNoteRow,
  type ClinicalListResult,
  type LabReportRow,
} from '@/lib/patients/patient-360-clinical';
import {
  loadPatient360Documents,
  type DocumentListResult,
  type DocumentRow,
} from '@/lib/patients/patient-360-documents';
import {
  downloadPatient360CcmsDocument,
  insuranceDocumentEmptyMessage,
  insuranceDocumentUnauthorizedMessage,
  insuranceDocumentUnavailableMessage,
  isPatient360InsuranceDocument,
  loadPatient360InsuranceDocuments,
} from '@/lib/patients/patient-360-insurance-documents';
import {
  generalDocumentEmptyMessage,
  generalDocumentUnauthorizedMessage,
  generalDocumentUnavailableMessage,
  loadPatient360GeneralDocuments,
  uploadCanonicalPatientDocument,
  type GeneralDocumentListResult,
  type GeneralDocumentRow,
} from '@/lib/patients/patient-360-general-documents';
import { useHasAnyPermission, useHasPermission } from '@/hooks/use-permissions';
import { useAuthStore } from '@/lib/auth-store';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { toast } from '@/lib/toast';
import {
  CanonicalDocumentDuplicateError,
  deleteCanonicalPatientDocument,
  downloadCanonicalPatientDocument,
} from '@/lib/api/patient-canonical-documents.api';
import {
  deleteCounselingSessionDocument,
  downloadCounselingCanonicalDocument,
  uploadCounselingPatientDocument,
} from '@/lib/api/counseling-sessions.api';
import { downloadLabReportContent, labReportsApi } from '@/lib/api/lab-reports.api';
import { downloadLmsOfficialPdf } from '@/lib/lms/lms-reports.api';
import { LMS_REPORTS_PERMISSIONS } from '@/lib/lms/lms-permissions';
import {
  laboratoryDocumentsCombinedEmpty,
  laboratoryLmsHonestyAlongsidePathology,
  loadPatient360LmsOfficialPdfs,
  LMS_OFFICIAL_PDF_SOURCE_LABEL,
  LMS_OFFICIAL_PDF_TYPE_LABEL,
  type LmsOfficialPdfDocumentRow,
  type LmsOfficialPdfListResult,
} from '@/lib/patients/patient-360-lms-official-pdf';
import { LabAttachReportDialog } from '@/components/patients/tabs/LabAttachReportDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Patient360DocumentPreview,
  runPatient360DocumentPrint,
} from '@/components/patients/record/Patient360DocumentPreview';
import { Patient360UploadDocumentDialog } from '@/components/patients/record/Patient360UploadDocumentDialog';
import {
  patient360DocumentStatusLabel,
  patient360DocumentTypeLabel,
} from '@/lib/patients/patient-360-document-areas';
import { shouldSkipDuplicateCanonicalOnAll } from '@/lib/patients/patient-360-document-identity';
import {
  COUNSELLING_DOCUMENT_REMOVE_CONFIRM,
  GENERAL_DOCUMENT_REMOVE_CONFIRM,
} from '@/lib/patients/counselling-document-remove-confirm';
import {
  counsellingDocumentEmptyMessage,
  counsellingDocumentUnauthorizedMessage,
  counsellingDocumentUnavailableMessage,
  counsellingDocumentMimeType,
  loadPatient360CounsellingDocuments,
  type CounsellingDocumentListResult,
  type CounsellingDocumentRow,
} from '@/lib/patients/patient-360-counselling-documents';
import {
  imagingFilesEmptyMessage,
  imagingFilesUnauthorizedMessage,
  imagingFilesUnavailableMessage,
  loadPatient360ImagingFiles,
  type ImagingFileListResult,
  type ImagingFileRow,
} from '@/lib/patients/patient-360-imaging-files';
import { usePatientRecord } from './PatientRecordProvider';
import { Patient360ListPagination } from './Patient360ListPagination';
import {
  Patient360DetailSheet,
  Patient360RecordTable,
  formatPatient360DateTime,
  patient360Honesty,
  patient360LinkClass,
} from './Patient360RecordTable';

type DocumentFilter = 'all' | 'general' | 'clinical' | 'counselling' | 'insurance' | 'laboratory' | 'imaging';

const FILTERS: { id: DocumentFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'clinical', label: 'Clinical' },
  { id: 'counselling', label: 'Counselling' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'laboratory', label: 'Laboratory' },
  { id: 'imaging', label: 'Imaging' },
];

function typeLabel(...parts: (string | null | undefined)[]) {
  const labels = parts
    .filter((part): part is string => Boolean(part))
    .map((part) => patient360DocumentTypeLabel(part))
    .filter((part) => part !== '—');
  return labels.join(' · ') || '—';
}

function documentNameCell(name: string) {
  return (
    <span className="block max-w-[18rem] truncate" title={name}>
      {name}
    </span>
  );
}

function statusCell(status: string | null | undefined) {
  const label = patient360DocumentStatusLabel(status);
  if (label === '—') return '—';
  const variant = label === 'Superseded' ? 'secondary' : label === 'Active' ? 'default' : 'outline';
  return (
    <Badge variant={variant} className="whitespace-nowrap">
      {label}
    </Badge>
  );
}

function compareDocumentIndexRows(
  left: { sortAt: string; sortId: string },
  right: { sortAt: string; sortId: string },
) {
  const byDate = right.sortAt.localeCompare(left.sortAt);
  if (byDate !== 0) return byDate;
  return right.sortId.localeCompare(left.sortId);
}

function ccmsAction(
  row: DocumentRow,
  canReadCcms: boolean,
  onCcmsDownload?: (row: DocumentRow) => void,
  onCcmsPreviewContent?: (row: DocumentRow) => Promise<Blob>,
): ReactNode {
  const canContent = Boolean(
    canReadCcms &&
      !row.isPointer &&
      row.coverageCaseId &&
      onCcmsPreviewContent,
  );
  const loadContent =
    canContent && onCcmsPreviewContent ? () => onCcmsPreviewContent(row) : undefined;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Patient360DocumentPreview
        fileName={row.documentName ?? 'Document'}
        documentType={patient360DocumentTypeLabel(row.documentType)}
        source="CCMS Documents"
        uploadedLabel={formatPatient360DateTime(row.uploadedAt ?? row.createdAt)}
        statusLabel={patient360DocumentStatusLabel(row.status)}
        mimeType={row.mimeType}
        canLoadContent={canContent}
        loadContent={loadContent}
        canDownload={Boolean(canContent && onCcmsDownload)}
        onDownload={canContent && onCcmsDownload ? () => onCcmsDownload(row) : undefined}
      />
      {canContent && onCcmsDownload ? (
        <button
          type="button"
          className={patient360LinkClass}
          onClick={() => onCcmsDownload(row)}
        >
          Download
        </button>
      ) : null}
      {canContent && loadContent ? (
        <button
          type="button"
          className={patient360LinkClass}
          onClick={() =>
            void runPatient360DocumentPrint({
              fileName: row.documentName ?? 'Document',
              mimeType: row.mimeType,
              loadContent,
            })
          }
        >
          Print
        </button>
      ) : null}
    </span>
  );
}

function generalAction(
  row: GeneralDocumentRow,
  canDownload: boolean,
  onDownload?: (id: string, fileName: string) => void,
  onPreviewContent?: (id: string) => Promise<Blob>,
  canRemoveGeneral = false,
  onGeneralRemove?: (documentId: string) => void,
): ReactNode {
  const typeLabelValue = patient360DocumentTypeLabel(row.classification);
  const canContent = Boolean(canDownload && onPreviewContent);
  const loadContent = onPreviewContent ? () => onPreviewContent(row.id) : undefined;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Patient360DocumentPreview
        fileName={row.fileName ?? 'Document'}
        documentType={typeLabelValue === '—' ? null : typeLabelValue}
        source="General Patient Documents"
        uploadedLabel={formatPatient360DateTime(row.createdAt)}
        statusLabel={patient360DocumentStatusLabel(row.status)}
        mimeType={row.mimeType}
        canLoadContent={canContent}
        loadContent={loadContent}
        canDownload={canDownload}
        onDownload={onDownload ? () => onDownload(row.id, row.fileName ?? 'document') : undefined}
      />
      {canDownload && onDownload ? (
        <button
          type="button"
          className={patient360LinkClass}
          onClick={() => onDownload(row.id, row.fileName ?? 'document')}
        >
          Download
        </button>
      ) : null}
      {canContent && loadContent ? (
        <button
          type="button"
          className={patient360LinkClass}
          onClick={() =>
            void runPatient360DocumentPrint({
              fileName: row.fileName ?? 'Document',
              mimeType: row.mimeType,
              loadContent,
            })
          }
        >
          Print
        </button>
      ) : null}
      {canRemoveGeneral && onGeneralRemove ? (
        <button
          type="button"
          className={patient360LinkClass}
          onClick={() => onGeneralRemove(row.id)}
        >
          Remove
        </button>
      ) : null}
    </span>
  );
}

const LABORATORY_DOCUMENTS_EMPTY = 'No laboratory documents available.';

function lmsOfficialPdfAction(
  row: LmsOfficialPdfDocumentRow,
  canDownloadLms: boolean,
  onLmsDownload?: (row: LmsOfficialPdfDocumentRow) => void,
  onLmsPreviewContent?: (row: LmsOfficialPdfDocumentRow) => Promise<Blob>,
): ReactNode {
  const canContent = Boolean(canDownloadLms && onLmsPreviewContent);
  const loadContent = canContent && onLmsPreviewContent ? () => onLmsPreviewContent(row) : undefined;
  const parts: ReactNode[] = [];

  if (canContent && loadContent) {
    parts.push(
      <Patient360DocumentPreview
        key="preview"
        fileName={row.fileName}
        documentType={LMS_OFFICIAL_PDF_TYPE_LABEL}
        source={LMS_OFFICIAL_PDF_SOURCE_LABEL}
        uploadedLabel={formatPatient360DateTime(row.generatedAtUtc)}
        statusLabel={patient360DocumentStatusLabel(row.reportStatus)}
        mimeType={row.mimeType}
        canLoadContent
        loadContent={loadContent}
        canDownload={Boolean(canContent && onLmsDownload)}
        onDownload={canContent && onLmsDownload ? () => onLmsDownload(row) : undefined}
      />,
    );
    if (onLmsDownload) {
      parts.push(
        <button
          key="download"
          type="button"
          className={patient360LinkClass}
          onClick={() => onLmsDownload(row)}
        >
          Download
        </button>,
      );
    }
    parts.push(
      <button
        key="print"
        type="button"
        className={patient360LinkClass}
        onClick={() =>
          void runPatient360DocumentPrint({
            fileName: row.fileName,
            mimeType: row.mimeType,
            loadContent,
          })
        }
      >
        Print
      </button>,
    );
  }

  if (parts.length === 0) return '—';
  return <span className="inline-flex flex-wrap items-center gap-2">{parts}</span>;
}

function laboratoryAction(
  row: LabReportRow,
  canReadLab: boolean,
  onLabDownload?: (labReportId: string, fileName: string) => void,
  onLabPreviewContent?: (labReportId: string) => Promise<Blob>,
  canAttachLab = false,
  onLabAttach?: (row: LabReportRow) => void,
): ReactNode {
  const hasCanonical = Boolean(row.canonicalDocumentId);
  const canContent = Boolean(canReadLab && hasCanonical && onLabPreviewContent);
  const loadContent = canContent && onLabPreviewContent ? () => onLabPreviewContent(row.id) : undefined;
  const fileName = row.canonicalFileName ?? row.title;
  const parts: ReactNode[] = [];

  if (row.reportUrl) {
    parts.push(
      <a key="external" href={row.reportUrl} className={patient360LinkClass} target="_blank" rel="noopener noreferrer">
        Open report
      </a>,
    );
  }

  if (canContent && loadContent) {
    parts.push(
      <Patient360DocumentPreview
        key="preview"
        fileName={fileName}
        documentType="Lab report"
        source="Laboratory"
        uploadedLabel={formatPatient360DateTime(row.when)}
        statusLabel={patient360DocumentStatusLabel(row.status)}
        mimeType={row.canonicalMimeType}
        canLoadContent
        loadContent={loadContent}
        canDownload={Boolean(canContent && onLabDownload)}
        onDownload={
          canContent && onLabDownload ? () => onLabDownload(row.id, fileName) : undefined
        }
      />,
    );
    if (onLabDownload) {
      parts.push(
        <button
          key="download"
          type="button"
          className={patient360LinkClass}
          onClick={() => onLabDownload(row.id, fileName)}
        >
          Download
        </button>,
      );
    }
    parts.push(
      <button
        key="print"
        type="button"
        className={patient360LinkClass}
        onClick={() =>
          void runPatient360DocumentPrint({
            fileName,
            mimeType: row.canonicalMimeType,
            loadContent,
          })
        }
      >
        Print
      </button>,
    );
  } else if (canAttachLab && onLabAttach && !hasCanonical) {
    parts.push(
      <button
        key="attach"
        type="button"
        className={patient360LinkClass}
        onClick={() => onLabAttach(row)}
      >
        Attach Report
      </button>,
    );
  }

  if (parts.length === 0) return '—';
  return <span className="inline-flex flex-wrap items-center gap-2">{parts}</span>;
}

function counsellingAction(
  row: CounsellingDocumentRow,
  canReadCounselling: boolean,
  onCounsellingDownload?: (canonicalDocumentId: string, fileName: string) => void,
  onCounsellingPreviewContent?: (canonicalDocumentId: string) => Promise<Blob>,
  canRemoveCounselling = false,
  onCounsellingRemove?: (documentId: string, documentName: string) => void,
): ReactNode {
  const canonicalId = row.canonicalDocumentId;
  const canContent = Boolean(canReadCounselling && canonicalId && onCounsellingPreviewContent);
  const loadContent =
    canContent && canonicalId && onCounsellingPreviewContent
      ? () => onCounsellingPreviewContent(canonicalId)
      : undefined;
  const mimeType = counsellingDocumentMimeType(row.fileType);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Patient360DocumentPreview
        fileName={row.documentName ?? 'Document'}
        documentType={patient360DocumentTypeLabel(row.documentType)}
        source="Counselling Documents"
        uploadedLabel={formatPatient360DateTime(row.createdAt ?? row.updatedAt)}
        statusLabel={patient360DocumentStatusLabel(row.status)}
        mimeType={mimeType}
        canLoadContent={canContent}
        loadContent={loadContent}
        canDownload={Boolean(canReadCounselling && canonicalId && onCounsellingDownload)}
        onDownload={
          canReadCounselling && canonicalId && onCounsellingDownload
            ? () => onCounsellingDownload(canonicalId, row.documentName ?? 'document')
            : undefined
        }
      />
      {canReadCounselling && canonicalId && onCounsellingDownload ? (
        <button
          type="button"
          className={patient360LinkClass}
          onClick={() => onCounsellingDownload(canonicalId, row.documentName ?? 'document')}
        >
          Download
        </button>
      ) : null}
      {canContent && loadContent ? (
        <button
          type="button"
          className={patient360LinkClass}
          onClick={() =>
            void runPatient360DocumentPrint({
              fileName: row.documentName ?? 'Document',
              mimeType,
              loadContent,
            })
          }
        >
          Print
        </button>
      ) : null}
      {canRemoveCounselling && onCounsellingRemove ? (
        <button
          type="button"
          className={patient360LinkClass}
          onClick={() => onCounsellingRemove(row.id, row.documentName ?? 'Document')}
        >
          Remove
        </button>
      ) : null}
    </span>
  );
}

export function Patient360DocumentsView({
  documents,
  counsellingDocuments = null,
  generalDocuments = null,
  clinical,
  imagingFiles,
  onDocumentsPageChange,
  onCounsellingDocumentsPageChange,
  onGeneralDocumentsPageChange,
  onImagingFilesPageChange,
  canUpload = false,
  canDownload = false,
  canReadCounsellingDocuments = false,
  currentUserId = null,
  canDeleteCounsellingDocuments = false,
  canDeleteGeneralDocuments = false,
  onUploadClick,
  onDownload,
  onPreviewContent,
  onCounsellingDownload,
  onCounsellingPreviewContent,
  onCounsellingRemove,
  onGeneralRemove,
  onCcmsDownload,
  onCcmsPreviewContent,
  canReadCcmsDocuments = false,
  canReadLabDocuments = false,
  canAttachLab = false,
  onLabDownload,
  onLabPreviewContent,
  onLabAttach,
  lmsOfficialPdfs,
  canReadLmsOfficialPdfs = false,
  canDownloadLmsOfficialPdfs = false,
  onLmsOfficialPdfDownload,
  onLmsOfficialPdfPreviewContent,
  insuranceDocuments = null,
  onInsuranceDocumentsPageChange,
  initialFilter = 'all',
}: {
  documents: DocumentListResult | null;
  counsellingDocuments?: CounsellingDocumentListResult | null;
  generalDocuments?: GeneralDocumentListResult | null;
  insuranceDocuments?: DocumentListResult | null;
  clinical?: { labs: ClinicalListResult<LabReportRow>; notes: ClinicalListResult<ChartNoteRow> } | null;
  imagingFiles?: ImagingFileListResult | null;
  /** When omitted, Laboratory filter keeps Pathology-only empty/honesty behavior (tests / legacy). */
  lmsOfficialPdfs?: LmsOfficialPdfListResult | null;
  canReadLmsOfficialPdfs?: boolean;
  canDownloadLmsOfficialPdfs?: boolean;
  onLmsOfficialPdfDownload?: (row: LmsOfficialPdfDocumentRow) => void;
  onLmsOfficialPdfPreviewContent?: (row: LmsOfficialPdfDocumentRow) => Promise<Blob>;
  onDocumentsPageChange?: (page: number) => void;
  onCounsellingDocumentsPageChange?: (page: number) => void;
  onGeneralDocumentsPageChange?: (page: number) => void;
  onInsuranceDocumentsPageChange?: (page: number) => void;
  onImagingFilesPageChange?: (page: number) => void;
  canReadLabDocuments?: boolean;
  canAttachLab?: boolean;
  onLabDownload?: (labReportId: string, fileName: string) => void;
  onLabPreviewContent?: (labReportId: string) => Promise<Blob>;
  onLabAttach?: (row: LabReportRow) => void;
  canUpload?: boolean;
  canDownload?: boolean;
  canReadCounsellingDocuments?: boolean;
  canReadCcmsDocuments?: boolean;
  currentUserId?: string | null;
  canDeleteCounsellingDocuments?: boolean;
  canDeleteGeneralDocuments?: boolean;
  onUploadClick?: () => void;
  onDownload?: (id: string, fileName: string) => void;
  onPreviewContent?: (id: string) => Promise<Blob>;
  onCounsellingDownload?: (canonicalDocumentId: string, fileName: string) => void;
  onCounsellingPreviewContent?: (canonicalDocumentId: string) => Promise<Blob>;
  onCounsellingRemove?: (documentId: string, documentName: string) => void;
  onGeneralRemove?: (documentId: string) => void;
  onCcmsDownload?: (row: DocumentRow) => void;
  onCcmsPreviewContent?: (row: DocumentRow) => Promise<Blob>;
  initialFilter?: DocumentFilter;
}) {
  const [filter, setFilter] = useState<DocumentFilter>(initialFilter);

  const rows = useMemo(() => {
    const merged: { id: string; sortAt: string; sortId: string; cells: ReactNode[] }[] = [];
    const seenCanonicalIds = new Set<string>();
    const showCcms = filter === 'all';
    const showInsurance = filter === 'insurance';
    const showGeneral = filter === 'all' || filter === 'general';
    const showCounselling = filter === 'all' || filter === 'counselling';
    const showNotes = filter === 'all' || filter === 'clinical';
    const showLabs = filter === 'all' || filter === 'laboratory';
    const showImaging = filter === 'all' || filter === 'imaging';

    if (showInsurance && insuranceDocuments?.state === 'ready') {
      for (const row of insuranceDocuments.rows) {
        if (!isPatient360InsuranceDocument(row)) continue;
        merged.push({
          id: `insurance-${row.id}`,
          sortAt: row.uploadedAt ?? row.createdAt ?? '',
          sortId: row.id,
          cells: [
            documentNameCell(row.documentName ?? '—'),
            typeLabel(row.documentType, row.documentCategory),
            'CCMS Documents',
            formatPatient360DateTime(row.uploadedAt ?? row.createdAt),
            statusCell(row.status),
            ccmsAction(row, canReadCcmsDocuments, onCcmsDownload, onCcmsPreviewContent),
          ],
        });
      }
    }
    // All-tab: General/Counselling first so shared canonical identity prefers existing content paths.
    if (showGeneral && generalDocuments?.state === 'ready') {
      for (const row of generalDocuments.rows) {
        if (shouldSkipDuplicateCanonicalOnAll(filter, seenCanonicalIds, row.id)) continue;
        merged.push({
          id: filter === 'all' ? `canonical-${row.id}` : `general-${row.id}`,
          sortAt: row.createdAt ?? '',
          sortId: row.id,
          cells: [
            documentNameCell(row.fileName ?? '—'),
            typeLabel(row.classification),
            'General Patient Documents',
            formatPatient360DateTime(row.createdAt),
            statusCell(row.status),
            generalAction(
              row,
              canDownload,
              onDownload,
              onPreviewContent,
              Boolean(
                canDeleteGeneralDocuments &&
                  currentUserId &&
                  row.createdByUserId &&
                  row.createdByUserId === currentUserId &&
                  onGeneralRemove,
              ),
              onGeneralRemove,
            ) || '—',
          ],
        });
      }
    }
    if (showCounselling && counsellingDocuments?.state === 'ready') {
      for (const row of counsellingDocuments.rows) {
        if (shouldSkipDuplicateCanonicalOnAll(filter, seenCanonicalIds, row.canonicalDocumentId)) {
          continue;
        }
        merged.push({
          id:
            filter === 'all' && row.canonicalDocumentId
              ? `canonical-${row.canonicalDocumentId}`
              : `counsel-${row.id}`,
          sortAt: row.createdAt ?? row.updatedAt ?? '',
          sortId: row.id,
          cells: [
            documentNameCell(row.documentName ?? '—'),
            typeLabel(row.documentType),
            'Counselling Documents',
            formatPatient360DateTime(row.createdAt ?? row.updatedAt),
            statusCell(row.status),
            counsellingAction(
              row,
              canReadCounsellingDocuments,
              onCounsellingDownload,
              onCounsellingPreviewContent,
              Boolean(
                canDeleteCounsellingDocuments &&
                  currentUserId &&
                  row.createdByUserId &&
                  row.createdByUserId === currentUserId &&
                  onCounsellingRemove,
              ),
              onCounsellingRemove,
            ),
          ],
        });
      }
    }
    if (showCcms && documents?.state === 'ready') {
      for (const row of documents.rows) {
        if (shouldSkipDuplicateCanonicalOnAll(filter, seenCanonicalIds, row.canonicalDocumentId)) {
          continue;
        }
        merged.push({
          id:
            filter === 'all' && row.canonicalDocumentId
              ? `canonical-${row.canonicalDocumentId}`
              : `ccms-${row.id}`,
          sortAt: row.uploadedAt ?? row.createdAt ?? '',
          sortId: row.id,
          cells: [
            documentNameCell(row.documentName ?? '—'),
            typeLabel(row.documentType, row.documentCategory),
            'CCMS Documents',
            formatPatient360DateTime(row.uploadedAt ?? row.createdAt),
            statusCell(row.status),
            ccmsAction(row, canReadCcmsDocuments, onCcmsDownload, onCcmsPreviewContent),
          ],
        });
      }
    }
    if (showNotes && clinical?.notes.state === 'ready') {
      for (const row of clinical.notes.rows) {
        merged.push({
          id: `note-${row.id}`,
          sortAt: row.when ?? '',
          sortId: row.id,
          cells: [
            documentNameCell(row.title),
            typeLabel(row.noteType, row.kind),
            'Chart notes',
            formatPatient360DateTime(row.when),
            statusCell(row.status),
            row.content ? (
              <Patient360DetailSheet trigger="View chart note" title={row.title}>
                <p>{row.content}</p>
              </Patient360DetailSheet>
            ) : (
              '—'
            ),
          ],
        });
      }
    }
    if (showLabs && clinical?.labs.state === 'ready') {
      for (const row of clinical.labs.rows) {
        if (shouldSkipDuplicateCanonicalOnAll(filter, seenCanonicalIds, row.canonicalDocumentId)) {
          continue;
        }
        merged.push({
          id:
            filter === 'all' && row.canonicalDocumentId
              ? `canonical-${row.canonicalDocumentId}`
              : `lab-${row.id}`,
          sortAt: row.when ?? '',
          sortId: row.id,
          cells: [
            documentNameCell(row.canonicalFileName ?? row.title),
            'Lab report',
            'Laboratory',
            formatPatient360DateTime(row.when),
            statusCell(row.status),
            laboratoryAction(
              row,
              canReadLabDocuments,
              onLabDownload,
              onLabPreviewContent,
              canAttachLab,
              onLabAttach,
            ),
          ],
        });
      }
    }
    if (showLabs && lmsOfficialPdfs?.state === 'ready' && canReadLmsOfficialPdfs) {
      for (const row of lmsOfficialPdfs.rows) {
        if (shouldSkipDuplicateCanonicalOnAll(filter, seenCanonicalIds, row.canonicalDocumentId)) {
          continue;
        }
        merged.push({
          id:
            filter === 'all'
              ? `canonical-${row.canonicalDocumentId}`
              : `lms-official-${row.reportId}-${row.artifactId}`,
          sortAt: row.generatedAtUtc ?? '',
          sortId: row.reportId,
          cells: [
            documentNameCell(row.fileName),
            LMS_OFFICIAL_PDF_TYPE_LABEL,
            LMS_OFFICIAL_PDF_SOURCE_LABEL,
            formatPatient360DateTime(row.generatedAtUtc),
            statusCell(row.reportStatus),
            lmsOfficialPdfAction(
              row,
              canDownloadLmsOfficialPdfs,
              onLmsOfficialPdfDownload,
              onLmsOfficialPdfPreviewContent,
            ),
          ],
        });
      }
    }
    if (showImaging && imagingFiles?.state === 'ready') {
      for (const row of imagingFiles.rows) {
        merged.push({
          id: `img-${row.id}`,
          sortAt: row.uploadedAt ?? '',
          sortId: row.id,
          cells: [
            documentNameCell(row.fileName),
            typeLabel(row.modality, row.contentType),
            'Imaging files',
            formatPatient360DateTime(row.uploadedAt),
            '—',
            <Patient360DocumentPreview
              fileName={row.fileName}
              documentType={typeLabel(row.modality, row.contentType)}
              source="Imaging files"
              uploadedLabel={formatPatient360DateTime(row.uploadedAt)}
              mimeType={row.contentType}
            />,
          ],
        });
      }
    }
    return merged.sort(compareDocumentIndexRows);
  }, [
    canDeleteCounsellingDocuments,
    canDeleteGeneralDocuments,
    canDownload,
    canReadCcmsDocuments,
    canReadCounsellingDocuments,
    canAttachLab,
    canReadLabDocuments,
    canReadLmsOfficialPdfs,
    canDownloadLmsOfficialPdfs,
    clinical,
    counsellingDocuments,
    currentUserId,
    documents,
    filter,
    generalDocuments,
    imagingFiles,
    insuranceDocuments,
    lmsOfficialPdfs,
    onCcmsDownload,
    onCcmsPreviewContent,
    onCounsellingDownload,
    onCounsellingPreviewContent,
    onCounsellingRemove,
    onDownload,
    onGeneralRemove,
    onLabAttach,
    onLabDownload,
    onLabPreviewContent,
    onLmsOfficialPdfDownload,
    onLmsOfficialPdfPreviewContent,
    onPreviewContent,
  ]);

  const emptyState = (() => {
    if (filter === 'insurance') {
      return (
        patient360Honesty(insuranceDocuments, {
          empty: insuranceDocumentEmptyMessage(),
          unauthorized: insuranceDocumentUnauthorizedMessage(),
          unavailable: insuranceDocumentUnavailableMessage(),
          loading: 'Loading insurance documents.',
        }) ?? insuranceDocumentEmptyMessage()
      );
    }
    if (filter === 'all') {
      const loading: string[] = [];
      if (generalDocuments == null) loading.push('Loading general patient documents.');
      if (documents == null) loading.push('Loading documents.');
      if (counsellingDocuments == null) loading.push('Loading counselling documents.');
      if (loading.length) return loading.join(' ');
      return 'No documents recorded.';
    }
    const parts: string[] = [];
    if (filter === 'general') {
      const general = patient360Honesty(generalDocuments, {
        empty: generalDocumentEmptyMessage(),
        unauthorized: generalDocumentUnauthorizedMessage(),
        unavailable: generalDocumentUnavailableMessage(),
        loading: 'Loading general patient documents.',
      });
      if (general) parts.push(general);
    }
    if (filter === 'counselling') {
      const counselling = patient360Honesty(counsellingDocuments, {
        empty: counsellingDocumentEmptyMessage(),
        unauthorized: counsellingDocumentUnauthorizedMessage(),
        unavailable: counsellingDocumentUnavailableMessage(),
        loading: 'Loading counselling documents.',
      });
      if (counselling) parts.push(counselling);
    }
    if (filter === 'clinical' && clinical !== undefined) {
      const notes = patient360Honesty(clinical?.notes, {
        empty: clinicalEmptyMessage('notes'),
        unauthorized: clinicalUnauthorizedMessage('notes'),
        unavailable: clinicalUnavailableMessage('notes'),
        loading: 'Loading chart notes.',
      });
      if (notes) parts.push(notes);
    }
    if (filter === 'laboratory' && clinical !== undefined) {
      if (lmsOfficialPdfs !== undefined) {
        const pathologyCount =
          clinical?.labs.state === 'ready' ? clinical.labs.rows.length : 0;
        const lmsCount =
          lmsOfficialPdfs?.state === 'ready' && canReadLmsOfficialPdfs
            ? lmsOfficialPdfs.rows.length
            : 0;
        if (clinical == null || lmsOfficialPdfs == null) {
          parts.push('Loading laboratory documents.');
        } else {
          const combined = laboratoryDocumentsCombinedEmpty(
            clinical.labs.state,
            canReadLmsOfficialPdfs ? lmsOfficialPdfs.state : 'ready',
            pathologyCount,
            lmsCount,
          );
          if (combined) parts.push(combined);
        }
      } else {
        const labs = patient360Honesty(clinical?.labs, {
          empty: LABORATORY_DOCUMENTS_EMPTY,
          unauthorized: clinicalUnauthorizedMessage('labs'),
          unavailable: clinicalUnavailableMessage('labs'),
          loading: 'Loading laboratory reports.',
        });
        if (labs) parts.push(labs);
      }
    }
    if (filter === 'imaging' && imagingFiles !== undefined) {
      const imaging = patient360Honesty(imagingFiles, {
        empty: imagingFilesEmptyMessage(),
        unauthorized: imagingFilesUnauthorizedMessage(),
        unavailable: imagingFilesUnavailableMessage(),
        loading: 'Loading imaging files.',
      });
      if (imaging) parts.push(imaging);
    }
    return parts.join(' ');
  })();

  const laboratoryFooterState = (() => {
    if (filter !== 'laboratory' || !canReadLmsOfficialPdfs || lmsOfficialPdfs == null || clinical == null) {
      return undefined;
    }
    const pathologyCount = clinical.labs.state === 'ready' ? clinical.labs.rows.length : 0;
    const lmsCount = lmsOfficialPdfs.state === 'ready' ? lmsOfficialPdfs.rows.length : 0;
    return (
      laboratoryLmsHonestyAlongsidePathology(
        lmsOfficialPdfs.state,
        canReadLmsOfficialPdfs,
        pathologyCount,
        lmsCount,
      ) ?? undefined
    );
  })();

  const showCcmsPager = filter === 'all' && onDocumentsPageChange && documents;
  const showInsurancePager =
    filter === 'insurance' && onInsuranceDocumentsPageChange && insuranceDocuments;
  const showGeneralPager =
    (filter === 'all' || filter === 'general') && onGeneralDocumentsPageChange && generalDocuments;
  const showCounsellingPager =
    (filter === 'all' || filter === 'counselling') && onCounsellingDocumentsPageChange && counsellingDocuments;
  const showImagingPager =
    (filter === 'all' || filter === 'imaging') && onImagingFilesPageChange && imagingFiles;

  return (
    <>
      <p className="sr-only">Source: CCMS Documents</p>
      <p className="sr-only">Source: Counselling Documents</p>
      <p className="sr-only">Source: General Patient Documents</p>
      <p className="sr-only">Indexed patient-linked documents. This is not the complete hospital document record.</p>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1" aria-label="Document sources">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              className={
                filter === item.id
                  ? 'rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2'
                  : 'rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2'
              }
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {canUpload && onUploadClick ? (
          <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={onUploadClick}>
            Upload document
          </Button>
        ) : null}
      </div>

      <div className="mt-4 min-w-0">
        <Patient360RecordTable
          caption="Documents"
          columns={[
            { header: 'Document', className: 'max-w-[18rem]' },
            { header: 'Type', className: 'whitespace-nowrap' },
            { header: 'Source', className: 'whitespace-nowrap' },
            { header: 'Date / Time', className: 'whitespace-nowrap tabular-nums' },
            { header: 'Status', className: 'whitespace-nowrap' },
            { header: 'Action', className: 'whitespace-nowrap' },
          ]}
          emptyState={emptyState}
          footerState={laboratoryFooterState}
          rows={rows}
        />

        {showCcmsPager ? (
          <Patient360ListPagination
            label="CCMS documents"
            currentPage={documents.pageNumber ?? 1}
            pageSize={documents.pageSize ?? 20}
            totalCount={documents.totalCount ?? 0}
            onPageChange={onDocumentsPageChange}
          />
        ) : null}
        {showInsurancePager ? (
          <Patient360ListPagination
            label="Insurance documents"
            currentPage={insuranceDocuments.pageNumber ?? 1}
            pageSize={insuranceDocuments.pageSize ?? 20}
            totalCount={insuranceDocuments.totalCount ?? 0}
            onPageChange={onInsuranceDocumentsPageChange}
          />
        ) : null}
        {showGeneralPager ? (
          <Patient360ListPagination
            label="General patient documents"
            currentPage={generalDocuments.pageNumber ?? 1}
            pageSize={generalDocuments.pageSize ?? 20}
            totalCount={generalDocuments.totalCount ?? 0}
            onPageChange={onGeneralDocumentsPageChange}
          />
        ) : null}
        {showCounsellingPager ? (
          <Patient360ListPagination
            label="Counselling documents"
            currentPage={counsellingDocuments.pageNumber ?? 1}
            pageSize={counsellingDocuments.pageSize ?? 20}
            totalCount={counsellingDocuments.totalCount ?? 0}
            onPageChange={onCounsellingDocumentsPageChange}
          />
        ) : null}
        {showImagingPager ? (
          <Patient360ListPagination
            label="Imaging files"
            currentPage={imagingFiles.pageNumber}
            pageSize={imagingFiles.pageSize}
            totalCount={imagingFiles.totalCount}
            onPageChange={onImagingFilesPageChange}
          />
        ) : null}
      </div>
    </>
  );
}

export function Patient360DocumentsPanel() {
  const { patientId } = usePatientRecord();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const canUploadGeneral = useHasPermission('patient.patient_document.upload');
  const canUploadCounselling = useHasPermission('session_documents.create');
  const canUpload = canUploadGeneral || canUploadCounselling;
  const canDownload = useHasPermission('patient.patient_document.download');
  const canReadCounsellingDocuments = useHasPermission('session_documents.read');
  const canReadCcmsDocuments = useHasPermission('ccms.document.read');
  const canReadLabDocuments = useHasPermission('patient.view');
  const canAttachLab = useHasPermission('patient.update');
  // Align with LaboratoryApi ForbidUnless(view|manage) and ReportsWorkbench gating.
  const canReadLmsOfficialPdfs = useHasAnyPermission([
    LMS_REPORTS_PERMISSIONS.view,
    LMS_REPORTS_PERMISSIONS.manage,
  ]);
  const canDownloadLmsOfficialPdfs = useHasPermission(LMS_REPORTS_PERMISSIONS.download);
  const canDeleteCounsellingDocuments = useHasPermission('session_documents.delete');
  const canDeleteGeneralDocuments = useHasPermission('patient.patient_document.delete');
  const [documents, setDocuments] = useState<DocumentListResult | null>(null);
  const [insuranceDocuments, setInsuranceDocuments] = useState<DocumentListResult | null>(null);
  const [counsellingDocuments, setCounsellingDocuments] = useState<CounsellingDocumentListResult | null>(null);
  const [generalDocuments, setGeneralDocuments] = useState<GeneralDocumentListResult | null>(null);
  const [clinical, setClinical] = useState<{
    labs: ClinicalListResult<LabReportRow>;
    notes: ClinicalListResult<ChartNoteRow>;
  } | null>(null);
  const [lmsOfficialPdfs, setLmsOfficialPdfs] = useState<LmsOfficialPdfListResult | null>(null);
  const [imagingFiles, setImagingFiles] = useState<ImagingFileListResult | null>(null);
  const [documentPage, setDocumentPage] = useState(1);
  const [insuranceDocumentPage, setInsuranceDocumentPage] = useState(1);
  const [counsellingDocumentPage, setCounsellingDocumentPage] = useState(1);
  const [generalDocumentPage, setGeneralDocumentPage] = useState(1);
  const [imagingFilesPage, setImagingFilesPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [labAttachTarget, setLabAttachTarget] = useState<LabReportRow | null>(null);
  const [labAttachUploading, setLabAttachUploading] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<
    { kind: 'counselling' | 'general'; documentId: string } | null
  >(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setDocumentPage(1);
    setInsuranceDocumentPage(1);
    setCounsellingDocumentPage(1);
    setGeneralDocumentPage(1);
    setImagingFilesPage(1);
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    setDocuments(null);
    void loadPatient360Documents(patientId, documentPage).then((next) => {
      if (!cancelled) setDocuments(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, documentPage]);

  useEffect(() => {
    let cancelled = false;
    setInsuranceDocuments(null);
    void loadPatient360InsuranceDocuments(patientId, insuranceDocumentPage).then((next) => {
      if (!cancelled) setInsuranceDocuments(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, insuranceDocumentPage]);

  useEffect(() => {
    let cancelled = false;
    setCounsellingDocuments(null);
    void loadPatient360CounsellingDocuments(patientId, counsellingDocumentPage).then((next) => {
      if (!cancelled) setCounsellingDocuments(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, counsellingDocumentPage]);

  useEffect(() => {
    let cancelled = false;
    setGeneralDocuments(null);
    void loadPatient360GeneralDocuments(patientId, generalDocumentPage).then((next) => {
      if (!cancelled) setGeneralDocuments(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, generalDocumentPage]);

  useEffect(() => {
    let cancelled = false;
    setClinical(null);
    void loadPatient360Clinical(patientId).then((next) => {
      if (!cancelled) setClinical({ labs: next.labs, notes: next.notes });
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    if (!canReadLmsOfficialPdfs) {
      setLmsOfficialPdfs({ state: 'unauthorized', rows: [] });
      return () => {
        cancelled = true;
      };
    }
    setLmsOfficialPdfs(null);
    void loadPatient360LmsOfficialPdfs(patientId).then((next) => {
      if (!cancelled) setLmsOfficialPdfs(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, canReadLmsOfficialPdfs]);

  useEffect(() => {
    let cancelled = false;
    setImagingFiles(null);
    void loadPatient360ImagingFiles(patientId, imagingFilesPage).then((next) => {
      if (!cancelled) setImagingFiles(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, imagingFilesPage]);

  return (
    <section
      id="patient-360-panel-documents"
      role="tabpanel"
      aria-labelledby="patient-360-tab-documents"
      className="min-w-0 overflow-x-hidden p-4"
      data-testid={patientLookupTestIds.recordSectionPanel('documents')}
    >
      <Patient360DocumentsView
        documents={documents}
        insuranceDocuments={insuranceDocuments}
        counsellingDocuments={counsellingDocuments}
        generalDocuments={generalDocuments}
        clinical={clinical}
        imagingFiles={imagingFiles}
        onDocumentsPageChange={setDocumentPage}
        onInsuranceDocumentsPageChange={setInsuranceDocumentPage}
        onCounsellingDocumentsPageChange={setCounsellingDocumentPage}
        onGeneralDocumentsPageChange={setGeneralDocumentPage}
        onImagingFilesPageChange={setImagingFilesPage}
        canUpload={canUpload}
        canDownload={canDownload}
        canReadCounsellingDocuments={canReadCounsellingDocuments}
        canReadCcmsDocuments={canReadCcmsDocuments}
        canReadLabDocuments={canReadLabDocuments}
        canAttachLab={canAttachLab}
        lmsOfficialPdfs={lmsOfficialPdfs}
        canReadLmsOfficialPdfs={canReadLmsOfficialPdfs}
        canDownloadLmsOfficialPdfs={canDownloadLmsOfficialPdfs}
        currentUserId={currentUserId}
        canDeleteCounsellingDocuments={canDeleteCounsellingDocuments}
        canDeleteGeneralDocuments={canDeleteGeneralDocuments}
        onUploadClick={() => setUploadOpen(true)}
        onLabAttach={(row) => setLabAttachTarget(row)}
        onLabDownload={async (labReportId, fileName) => {
          try {
            const blob = await downloadLabReportContent(labReportId);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
          } catch {
            toast.error('Document download failed.');
          }
        }}
        onLabPreviewContent={(labReportId) => downloadLabReportContent(labReportId)}
        onLmsOfficialPdfDownload={async (row) => {
          try {
            const blob = await downloadLmsOfficialPdf({
              reportId: row.reportId,
              operatingBranchId: row.operatingBranchId,
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = row.fileName;
            link.click();
            URL.revokeObjectURL(url);
          } catch {
            toast.error('Document download failed.');
          }
        }}
        onLmsOfficialPdfPreviewContent={(row) =>
          downloadLmsOfficialPdf({
            reportId: row.reportId,
            operatingBranchId: row.operatingBranchId,
          })
        }
        onDownload={async (id, fileName) => {
          try {
            const blob = await downloadCanonicalPatientDocument(patientId, id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
          } catch {
            toast.error('Document download failed.');
          }
        }}
        onPreviewContent={(id) => downloadCanonicalPatientDocument(patientId, id)}
        onCcmsDownload={async (row) => {
          if (!row.coverageCaseId) {
            toast.error('Document download failed.');
            return;
          }
          try {
            const blob = await downloadPatient360CcmsDocument(row.coverageCaseId, row.id, {
              mimeType: row.mimeType,
              fileName: row.documentName,
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = row.documentName ?? 'document';
            link.click();
            URL.revokeObjectURL(url);
          } catch {
            toast.error('Document download failed.');
          }
        }}
        onCcmsPreviewContent={(row) => {
          if (!row.coverageCaseId) {
            return Promise.reject(new Error('Missing coverage case.'));
          }
          return downloadPatient360CcmsDocument(row.coverageCaseId, row.id, {
            mimeType: row.mimeType,
            fileName: row.documentName,
          });
        }}
        onCounsellingDownload={async (canonicalDocumentId, fileName) => {
          try {
            const blob = await downloadCounselingCanonicalDocument(patientId, canonicalDocumentId);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
          } catch {
            toast.error('Document download failed.');
          }
        }}
        onCounsellingPreviewContent={(canonicalDocumentId) =>
          downloadCounselingCanonicalDocument(patientId, canonicalDocumentId)
        }
        onCounsellingRemove={(documentId) => {
          setPendingRemove({ kind: 'counselling', documentId });
        }}
        onGeneralRemove={(documentId) => {
          setPendingRemove({ kind: 'general', documentId });
        }}
      />
      <LabAttachReportDialog
        open={Boolean(labAttachTarget)}
        uploading={labAttachUploading}
        testName={labAttachTarget?.title ?? 'lab report'}
        onOpenChange={(open) => {
          if (!open) setLabAttachTarget(null);
        }}
        onAttach={async (file) => {
          if (!labAttachTarget) return;
          setLabAttachUploading(true);
          try {
            await labReportsApi.attachReport(labAttachTarget.id, file);
            toast.success('Report attached.');
            const next = await loadPatient360Clinical(patientId);
            setClinical({ labs: next.labs, notes: next.notes });
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Attach report failed.'));
            throw err;
          } finally {
            setLabAttachUploading(false);
          }
        }}
      />
      <AlertDialog
        open={pendingRemove != null}
        onOpenChange={(open) => {
          if (!open && !removing) setPendingRemove(null);
        }}
      >
        <AlertDialogContent data-testid="patient-360-document-remove-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(pendingRemove?.kind === 'general'
                ? GENERAL_DOCUMENT_REMOVE_CONFIRM
                : COUNSELLING_DOCUMENT_REMOVE_CONFIRM
              ).title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(pendingRemove?.kind === 'general'
                ? GENERAL_DOCUMENT_REMOVE_CONFIRM
                : COUNSELLING_DOCUMENT_REMOVE_CONFIRM
              ).description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={removing}>
              {(pendingRemove?.kind === 'general'
                ? GENERAL_DOCUMENT_REMOVE_CONFIRM
                : COUNSELLING_DOCUMENT_REMOVE_CONFIRM
              ).cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={removing}
              data-testid="patient-360-document-remove-confirm-submit"
              onClick={(event) => {
                event.preventDefault();
                if (!pendingRemove || removing) return;
                setRemoving(true);
                const { kind, documentId } = pendingRemove;
                const removePromise =
                  kind === 'general'
                    ? deleteCanonicalPatientDocument(patientId, documentId)
                    : deleteCounselingSessionDocument(documentId);
                void removePromise
                  .then(async () => {
                    toast.success('Document removed.');
                    setPendingRemove(null);
                    if (kind === 'general') {
                      const next = await loadPatient360GeneralDocuments(patientId, generalDocumentPage);
                      setGeneralDocuments(next);
                    } else {
                      const next = await loadPatient360CounsellingDocuments(
                        patientId,
                        counsellingDocumentPage,
                      );
                      setCounsellingDocuments(next);
                    }
                  })
                  .catch(() => toast.error('Document remove failed.'))
                  .finally(() => setRemoving(false));
              }}
            >
              {(pendingRemove?.kind === 'general'
                ? GENERAL_DOCUMENT_REMOVE_CONFIRM
                : COUNSELLING_DOCUMENT_REMOVE_CONFIRM
              ).confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Patient360UploadDocumentDialog
        open={uploadOpen}
        uploading={uploading}
        patientId={patientId}
        onOpenChange={setUploadOpen}
        onUpload={async (payload) => {
          setUploading(true);
          try {
            if (payload.area === 'counselling') {
              await uploadCounselingPatientDocument({
                patientId,
                file: payload.file,
                documentType: payload.documentType,
              });
              toast.success('Document uploaded.');
              const next = await loadPatient360CounsellingDocuments(patientId, 1);
              setCounsellingDocumentPage(1);
              setCounsellingDocuments(next);
              return;
            }
            await uploadCanonicalPatientDocument(patientId, payload.file, payload.options);
            toast.success('Document uploaded.');
            const next = await loadPatient360GeneralDocuments(patientId, 1);
            setGeneralDocumentPage(1);
            setGeneralDocuments(next);
          } catch (error) {
            if (error instanceof CanonicalDocumentDuplicateError) throw error;
            toast.error(getApiErrorMessage(error, 'Document upload failed.'));
            throw error;
          } finally {
            setUploading(false);
          }
        }}
      />
    </section>
  );
}
