'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DocumentChecklist } from '@/components/ccms';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import type { DocumentSlot } from '@/components/ccms/DocumentChecklist';

const CCMS_DOCUMENT_SLOTS: DocumentSlot[] = [
  { id: 'preauth_form',         label: 'Pre-Authorization Form',      required: true },
  { id: 'insurance_card',       label: 'Insurance / TPA Card',        required: true },
  { id: 'policy_doc',           label: 'Policy Document',             required: true },
  { id: 'authorization_letter', label: 'Authorization Letter',        required: false },
  { id: 'bills',                label: 'Hospital Bills / Invoices',   required: true },
  { id: 'discharge_summary',    label: 'Discharge Summary',           required: false },
  { id: 'investigation_reports',label: 'Investigation Reports',       required: false },
  { id: 'clinical_notes',       label: 'Clinical Notes',              required: false },
];

export default function DocumentsPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/ccms/cases/${caseId}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
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
        <DocumentChecklist
          slots={CCMS_DOCUMENT_SLOTS}
          caseId={caseId}
        />
      </div>
    </div>
  );
}
