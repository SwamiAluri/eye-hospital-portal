'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { CaseDocumentsWorkspace } from '@/components/ccms/CaseDocumentsWorkspace';
import { getCoverageCaseById } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { listDocumentRequirements } from '@/lib/api/ccms/ccms-master-data.api';
import { slotsFromMasterOrFallback } from '@/lib/ccms/ccms-document-slots';

export default function DocumentsPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;

  const caseQuery = useQuery({
    queryKey: ['ccms', 'case', caseId],
    queryFn: () => getCoverageCaseById(caseId),
    enabled: Boolean(caseId),
  });

  const case_ = caseQuery.data;
  const reqQuery = useQuery({
    queryKey: [
      'ccms', 'document-requirements', caseId,
      case_?.insuranceProviderId, case_?.tpaProviderId, case_?.governmentSchemeId,
    ],
    queryFn: () => listDocumentRequirements({
      stage: 'preauth',
      insuranceProviderId: case_?.insuranceProviderId,
      tpaProviderId: case_?.tpaProviderId,
      governmentSchemeId: case_?.governmentSchemeId,
      caseScoped: true,
    }),
    enabled: Boolean(caseId) && caseQuery.isSuccess,
    staleTime: 60_000,
  });

  const slots = slotsFromMasterOrFallback(reqQuery.data ?? []);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/ccms/cases/${caseId}`}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-indigo-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Case Documents</h1>
              <p className="text-xs text-gray-500 font-mono">{case_?.caseNumber ?? caseId}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-4">
              Intake &amp; Pre-Authorization
            </p>
            <CaseDocumentsWorkspace
              caseId={caseId}
              patientId={case_?.patientId}
              slots={slots}
              showScanButton={true}
              documentsLoading={caseQuery.isLoading || reqQuery.isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
