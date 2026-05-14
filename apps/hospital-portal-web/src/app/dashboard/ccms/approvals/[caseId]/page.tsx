'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getEventStream,
  getApprovalSnapshot,
  type ApprovalEvent,
  type ApprovalSnapshot,
} from '@/lib/api/ccms/ccms-approvals.api';
import {
  getAvailableActions,
  type WorkflowAction,
} from '@/lib/api/ccms/ccms-workflow.api';
import { ApprovalEventFeed, WorkflowActionBar } from '@/components/ccms';
import { PreAuthStatusBadge } from '@/components/ccms';
import type { CcmsState } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ApprovalDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;

  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [snapshot, setSnapshot] = useState<ApprovalSnapshot | null>(null);
  const [actions, setActions] = useState<WorkflowAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getEventStream(caseId),
      getApprovalSnapshot(caseId),
      getAvailableActions('coverage-case', caseId),
    ])
      .then(([evts, snap, avail]) => {
        setEvents(evts);
        setSnapshot(snap);
        setActions(avail);
      })
      .catch(e => setError(e?.message ?? 'Failed to load approval detail'))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(load, [load]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/ccms/approvals" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Approval Review</h1>
            <p className="text-xs text-gray-500 font-mono">{caseId}</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {error && (
          <div className="lg:col-span-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Left: Snapshot + Actions */}
        <div className="space-y-4">
          {/* Snapshot summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Approval Summary</h2>
            {loading || !snapshot
              ? <div className="animate-pulse space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded" />)}</div>
              : (
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Current State</span>
                      <PreAuthStatusBadge state={snapshot.currentState as CcmsState} size="sm" />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Approved Amount</span>
                      <span className="font-medium text-green-700">₹{snapshot.approvedAmount?.toLocaleString('en-IN') ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Events</span>
                      <span className="font-medium">{snapshot.totalEvents}</span>
                    </div>
                    {snapshot.approvedBy && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Approved By</span>
                        <span className="font-medium">{snapshot.approvedBy}</span>
                      </div>
                    )}
                  </div>
                )
            }
          </div>

          {/* Actions */}
          {!loading && actions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-bold text-gray-700 mb-3">Available Actions</h2>
              <WorkflowActionBar
                entityType="coverage-case"
                entityId={caseId}
                actions={actions}
                onTransitionComplete={load}
              />
            </div>
          )}

          {/* Case link */}
          <Link
            href={`/dashboard/ccms/cases/${caseId}`}
            className="block text-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-2"
          >
            View Full Case →
          </Link>
        </div>

        {/* Right: Event feed */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Approval Event Stream</h2>
          <ApprovalEventFeed events={events} isLoading={loading} />
        </div>
      </div>
    </div>
  );
}
