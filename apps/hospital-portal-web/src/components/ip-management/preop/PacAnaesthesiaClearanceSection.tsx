'use client';

import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ipManagementApi,
  type PacAssessmentDto,
  type PreOpCompletionDto,
} from '@/lib/api/ip-management.api';
import {
  buildAnaesthesiaClearanceRows,
  findFitnessCertificateCompletion,
} from '@/lib/ip-management/pac-anaesthesia-clearance';
import type { PreOpStatus } from '@/lib/ip-management/preop-status';
import { PacClinicalSection } from '@/components/ip-management/preop/primitives/PacClinicalSection';
import { PacClinicalTable } from '@/components/ip-management/preop/primitives/PacClinicalTable';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface PacAnaesthesiaClearanceSectionProps {
  journeyId: string;
  pac: PacAssessmentDto;
  anaesthetistName?: string | null;
  completions?: PreOpCompletionDto[];
  disabled?: boolean;
  onChanged?: () => void;
}

function sectionStatus(pac: PacAssessmentDto): PreOpStatus {
  if (pac.assessmentStatus === 'Completed') return 'completed';
  if (pac.isComplete) return 'in-progress';
  return 'not-started';
}

export function PacAnaesthesiaClearanceSection({
  journeyId,
  pac,
  anaesthetistName,
  completions,
  disabled = false,
  onChanged,
}: PacAnaesthesiaClearanceSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const rows = buildAnaesthesiaClearanceRows(pac, anaesthetistName);
  const certCompletion = findFitnessCertificateCompletion(completions);
  const certUploaded = !!certCompletion?.documentId || !!certCompletion?.isCompleted;

  async function handleUpload(file: File) {
    if (!certCompletion || disabled) return;
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const doc = await ipManagementApi.uploadPreOpDocument(journeyId, {
        documentType: 'Other',
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileData: base64,
      });
      if (!doc) return;
      await ipManagementApi.savePreOpCompletion(journeyId, certCompletion.itemId, {
        itemId: certCompletion.itemId,
        isCompleted: true,
        isBypassed: false,
        documentId: doc.id,
      });
      onChanged?.();
    } finally {
      setUploading(false);
    }
  }

  return (
    <PacClinicalSection
      sectionKey="anaesthesia-clearance"
      title="Anaesthesia Clearance"
      status={sectionStatus(pac)}
    >
      <div data-testid={WARD_PREOP_TEST_IDS.pacAnaesthesiaClearance}>
        <PacClinicalTable>
          {rows.map(row => (
            <tr key={row.parameter}>
              <th
                scope="row"
                className="w-[38%] px-4 py-2 text-left text-xs font-medium text-gray-600"
              >
                {row.parameter}
              </th>
              <td className="px-4 py-2 text-sm font-medium text-gray-900">{row.value}</td>
            </tr>
          ))}
          <tr>
            <th
              scope="row"
              className="w-[38%] px-4 py-2 text-left text-xs font-medium text-gray-600"
            >
              Fitness Certificate
            </th>
            <td className="px-4 py-2 text-right">
              {uploading ? (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Uploading
                </span>
              ) : certUploaded ? (
                <span
                  data-testid={WARD_PREOP_TEST_IDS.pacFitnessCertificate}
                  className="text-sm font-medium text-emerald-700"
                >
                  Uploaded
                </span>
              ) : (
                <button
                  type="button"
                  data-testid={WARD_PREOP_TEST_IDS.pacFitnessCertificateUpload}
                  disabled={disabled || !certCompletion}
                  onClick={() => fileRef.current?.click()}
                  className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Upload
                </button>
              )}
            </td>
          </tr>
        </PacClinicalTable>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleUpload(file);
        }}
      />
    </PacClinicalSection>
  );
}
