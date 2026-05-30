'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { CaseDocumentsWorkspace } from '@/components/ccms/CaseDocumentsWorkspace';
import { ALL_DOC_SLOTS } from '@/lib/ccms/ccms-document-slots';

export default function DocumentsPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;

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
              <p className="text-xs text-gray-500 font-mono">{caseId}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Intake / pre-auth documents */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-4">
              Intake &amp; Pre-Authorization
            </p>
            <CaseDocumentsWorkspace
              caseId={caseId}
              slots={ALL_DOC_SLOTS}
              showScanButton={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
