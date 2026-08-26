'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, ExternalLink } from 'lucide-react';
import { CaseDocumentsWorkspace } from './CaseDocumentsWorkspace';
import { listDocumentRequirements } from '@/lib/api/ccms/ccms-master-data.api';
import { slotsFromMasterOrFallback } from '@/lib/ccms/ccms-document-slots';
import type { CaseDocument } from '@/lib/api/ccms/ccms-documents.api';

interface Props {
  caseId: string;
  patientId?: string | null;
  insuranceProviderId?: string;
  tpaProviderId?: string;
  governmentSchemeId?: string;
  /** Pre-loaded documents from React Query cache (avoids duplicate fetch). */
  documents?: CaseDocument[];
  documentsLoading?: boolean;
}

export function CaseDocumentsPanel({
  caseId,
  patientId,
  insuranceProviderId,
  tpaProviderId,
  governmentSchemeId,
  documents,
  documentsLoading,
}: Props) {
  const reqQuery = useQuery({
    queryKey: ['ccms', 'document-requirements', 'preauth', caseId, insuranceProviderId, tpaProviderId, governmentSchemeId],
    queryFn: () => listDocumentRequirements({
      stage: 'preauth',
      insuranceProviderId,
      tpaProviderId,
      governmentSchemeId,
      caseScoped: true,
    }),
    staleTime: 60_000,
  });

  const slots = slotsFromMasterOrFallback(reqQuery.data ?? []);
  const requiredSlots = slots.filter(s => s.required).length;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-800">Documents</p>
            <p className="text-xs text-gray-400">
              {slots.length} slots · {requiredSlots} required
            </p>
          </div>
        </div>
        <Link
          href={`/dashboard/ccms/documents/${caseId}`}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          Full workspace <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="px-4 pb-4 pt-3">
        <CaseDocumentsWorkspace
          caseId={caseId}
          patientId={patientId}
          slots={slots}
          showScanButton={true}
          documents={documents}
          documentsLoading={documentsLoading || reqQuery.isLoading}
        />
      </div>
    </div>
  );
}
