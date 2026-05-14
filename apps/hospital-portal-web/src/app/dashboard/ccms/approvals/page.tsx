'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getApprovalQueue, type ApprovalQueueItem } from '@/lib/api/ccms/ccms-approvals.api';
import { PreAuthStatusBadge } from '@/components/ccms';
import { RefreshCw, AlertCircle, CheckSquare } from 'lucide-react';
import type { CcmsState } from '@/lib/api/ccms/ccms-coverage-cases.api';

export default function ApprovalsQueuePage() {
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getApprovalQueue()
      .then(setItems)
      .catch(e => setError(e?.message ?? 'Failed to load approval queue'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Approvals Queue</h1>
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
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Case</th>
                <th className="px-4 py-3 text-left">Current State</th>
                <th className="px-4 py-3 text-left">Pending Action</th>
                <th className="px-4 py-3 text-left">Urgency</th>
                <th className="px-4 py-3 text-left">Last Event</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                : items.length === 0
                  ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                          No pending approvals.
                        </td>
                      </tr>
                    )
                  : items.map(item => {
                      const lastAt = new Date(item.lastEventAt);
                      const hoursAgo = Math.floor((Date.now() - lastAt.getTime()) / 3600000);
                      const isUrgent = item.urgencyLevel === 'HIGH' || item.urgencyLevel === 'CRITICAL';
                      return (
                        <tr key={item.caseId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-indigo-700">
                            <Link href={`/dashboard/ccms/cases/${item.caseId}`} className="hover:underline">
                              {item.caseId.slice(0, 8)}…
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <PreAuthStatusBadge state={item.currentState as CcmsState} size="sm" />
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{item.pendingAction ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              item.urgencyLevel === 'CRITICAL'
                                ? 'bg-red-100 text-red-700'
                                : item.urgencyLevel === 'HIGH'
                                  ? 'bg-orange-100 text-orange-700'
                                  : item.urgencyLevel === 'MEDIUM'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-600'
                            }`}>
                              {item.urgencyLevel ?? 'NORMAL'}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-xs ${isUrgent && hoursAgo > 24 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            {hoursAgo}h ago
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/dashboard/ccms/approvals/${item.caseId}`}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              Review →
                            </Link>
                          </td>
                        </tr>
                      );
                    })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
