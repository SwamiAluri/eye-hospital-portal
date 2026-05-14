'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getClaimQueue, type ClaimQueueItem } from '@/lib/api/ccms/ccms-claims.api';
import { RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';

export default function CcmsClaimsPage() {
  const [queue, setQueue] = useState<ClaimQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getClaimQueue()
      .then(setQueue)
      .catch(e => setError(e?.message ?? 'Failed to load claims'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Claims</h1>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium">Claim #</th>
                <th className="px-4 py-3 text-left font-medium">Case #</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Claimed (₹)</th>
                <th className="px-4 py-3 text-right font-medium">Age (days)</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded-full" /></td>
                      ))}
                    </tr>
                  ))
                : queue.length === 0
                  ? <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">No claims found.</td></tr>
                  : queue.map(item => (
                      <tr key={item.claimId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800 text-xs">{item.claimNumber}</td>
                        <td className="px-4 py-3 text-xs">
                          <Link href={`/dashboard/ccms/cases/${item.caseId}`} className="text-indigo-600 hover:underline">
                            {item.caseId.slice(0, 8)}…
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            item.status === 'Submitted' ? 'bg-green-100 text-green-700' :
                            item.status === 'Generated' ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{item.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">₹{item.claimedAmount.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500">
                          <span className={item.ageInDays > 30 ? 'text-red-600 font-semibold' : ''}>{item.ageInDays}d</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/ccms/cases/${item.caseId}?tab=claims`} className="text-xs text-indigo-600 hover:underline">View →</Link>
                        </td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
