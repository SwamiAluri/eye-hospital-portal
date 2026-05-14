'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getAllocation,
  getNonPayables,
  type BillAllocation,
  type NonPayableItem,
} from '@/lib/api/ccms/ccms-billing.api';
import { AllocationBreakdown } from '@/components/ccms';
import { RefreshCw, AlertCircle, ArrowLeft, Receipt } from 'lucide-react';

export default function BillingDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;

  const [allocation, setAllocation] = useState<BillAllocation | null>(null);
  const [nonPayables, setNonPayables] = useState<NonPayableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    Promise.all([getAllocation(caseId), getNonPayables(caseId)])
      .then(([alloc, np]) => { setAllocation(alloc); setNonPayables(np); })
      .catch(e => setError(e?.message ?? 'Failed to load billing data'))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(load, [load]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/ccms/cases/${caseId}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Billing Allocation</h1>
              <p className="text-xs text-gray-500 font-mono">{caseId}</p>
            </div>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading
          ? <div className="animate-pulse bg-gray-200 rounded-xl h-48" />
          : allocation
            ? <AllocationBreakdown allocation={allocation} />
            : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
                  No billing allocation found for this case.
                </div>
              )
        }

        {/* Non-payables */}
        {!loading && nonPayables.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-red-50">
              <h2 className="text-sm font-bold text-red-800">Non-Payable Items ({nonPayables.length})</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-right">Amount (₹)</th>
                  <th className="px-4 py-2 text-left">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {nonPayables.map((np, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{np.itemName}</td>
                    <td className="px-4 py-2.5 text-right text-red-600 font-medium">
                      ₹{np.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{np.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
