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
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-gray-400 font-medium">CCMS</span>
            <span className="text-gray-300">/</span>
            <span className="text-[11px] text-gray-600 font-semibold">Approvals Queue</span>
          </div>
          <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-500" />
            Approvals Queue
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Cases awaiting TPA decision or internal approval</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-xl px-3 py-2 hover:border-indigo-300 hover:bg-indigo-50 transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Case</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Current State</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Pending Action</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Urgency</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Last Event</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse border-l-2 border-l-gray-100">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-3 bg-gray-100 rounded-full w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                : items.length === 0
                  ? (
                      <tr>
                        <td colSpan={6} className="py-14 text-center">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                            <CheckSquare className="w-6 h-6 text-indigo-400" />
                          </div>
                          <p className="text-sm font-semibold text-gray-600">No pending approvals</p>
                          <p className="text-xs text-gray-400 mt-1">All cases have been actioned.</p>
                        </td>
                      </tr>
                    )
                  : items.map(item => {
                      const lastAt = new Date(item.lastEventAt);
                      const hoursAgo = Math.floor((Date.now() - lastAt.getTime()) / 3600000);
                      const isCritical = item.urgencyLevel === 'CRITICAL';
                      const isHigh     = item.urgencyLevel === 'HIGH';
                      return (
                        <tr key={item.caseId} className={`transition-colors border-l-2 ${
                          isCritical ? 'border-l-red-500 bg-red-50/30 hover:bg-red-50/50'
                          : isHigh    ? 'border-l-orange-400 bg-orange-50/20 hover:bg-orange-50/40'
                          : 'border-l-indigo-200 hover:bg-indigo-50/20'
                        }`}>
                          <td className="px-5 py-3.5">
                            <Link href={`/dashboard/ccms/cases/${item.caseId}`}
                              className="font-bold font-mono text-indigo-600 hover:text-indigo-800 hover:underline">
                              {item.caseNumber ?? item.caseId.slice(0, 8) + '…'}
                            </Link>
                            {item.patientName && (
                              <p className="text-[10px] text-gray-400 mt-0.5">{item.patientName}</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <PreAuthStatusBadge state={item.currentState as CcmsState} size="sm" />
                          </td>
                          <td className="px-4 py-3.5 text-gray-600 max-w-[150px]">
                            <span className="truncate block">{item.pendingAction ?? '—'}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isCritical  ? 'bg-red-100 text-red-700'
                              : isHigh    ? 'bg-orange-100 text-orange-700'
                              : item.urgencyLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-500'
                            }`}>
                              {item.urgencyLevel ?? 'NORMAL'}
                            </span>
                          </td>
                          <td className={`px-4 py-3.5 ${isCritical && hoursAgo > 24 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                            {hoursAgo >= 24 ? `${Math.floor(hoursAgo/24)}d` : `${hoursAgo}h`} ago
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Link href={`/dashboard/ccms/approvals/${item.caseId}`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors">
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
