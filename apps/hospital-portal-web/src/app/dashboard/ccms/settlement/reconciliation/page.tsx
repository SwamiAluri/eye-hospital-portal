'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CcmsReconciliationPage() {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-200">
        <Link href="/dashboard/ccms/settlement" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Settlement Reconciliation</h1>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-sm font-medium">Reconciliation Workbench</p>
          <p className="text-xs mt-1">Connect to settlement data to begin reconciliation.</p>
          <Link href="/dashboard/ccms/cases" className="mt-3 inline-block text-xs text-indigo-600 hover:underline">
            Browse Cases with Settlements →
          </Link>
        </div>
      </div>
    </div>
  );
}
