'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';

export default function EnhancementsPage() {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Enhancement Requests</h1>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
              <Info className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <h2 className="text-base font-bold text-gray-800">Enhancements are Case-Level</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Benefit enhancements are requested from within a specific coverage case, via the Pre-Auth tab.
            Once approved, the enhanced amounts are reflected in the case summary.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/dashboard/ccms/cases"
              className="inline-block text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
            >
              Browse Cases
            </Link>
            <Link
              href="/dashboard/ccms/authorization"
              className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Authorization Queue →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
