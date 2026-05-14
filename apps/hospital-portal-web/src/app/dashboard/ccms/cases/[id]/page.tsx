'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getCoverageCaseById,
  type CoverageCase,
} from '@/lib/api/ccms/ccms-coverage-cases.api';
import {
  getAvailableActions,
  getWorkflowHistory,
  type WorkflowAction,
  type WorkflowHistoryEntry,
} from '@/lib/api/ccms/ccms-workflow.api';
import {
  getPreAuthByCaseId,
  type PreAuthorization,
} from '@/lib/api/ccms/ccms-authorizations.api';
import {
  getEventStream,
  type ApprovalEvent,
} from '@/lib/api/ccms/ccms-approvals.api';
import { getAllocation, type BillAllocation } from '@/lib/api/ccms/ccms-billing.api';
import { getClaimByCaseId, type ClaimPacket } from '@/lib/api/ccms/ccms-claims.api';
import { getSettlementByCaseId, type Settlement } from '@/lib/api/ccms/ccms-settlements.api';
import { CaseSummaryPanel } from '@/components/ccms/CaseSummaryPanel';
import { WorkflowTimeline } from '@/components/ccms/WorkflowTimeline';
import { WorkflowActionBar } from '@/components/ccms/WorkflowActionBar';
import { ApprovalEventFeed } from '@/components/ccms/ApprovalEventFeed';
import { AllocationBreakdown } from '@/components/ccms/AllocationBreakdown';
import { ClaimPacketPreview } from '@/components/ccms/ClaimPacketPreview';
import { SettlementReceipt } from '@/components/ccms/SettlementReceipt';
import { ArrowLeft, RefreshCw } from 'lucide-react';

type TabKey = 'overview' | 'authorization' | 'billing' | 'claims' | 'settlement' | 'events';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',       label: 'Overview' },
  { key: 'authorization',  label: 'Pre-Auth' },
  { key: 'billing',        label: 'Billing' },
  { key: 'claims',         label: 'Claims' },
  { key: 'settlement',     label: 'Settlement' },
  { key: 'events',         label: 'Events' },
];

export default function CcmsCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>('overview');
  const [case_, setCase_] = useState<CoverageCase | null>(null);
  const [history, setHistory] = useState<WorkflowHistoryEntry[]>([]);
  const [actions, setActions] = useState<WorkflowAction[]>([]);
  const [preAuths, setPreAuths] = useState<PreAuthorization[]>([]);
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [allocation, setAllocation] = useState<BillAllocation | null>(null);
  const [claims, setClaims] = useState<ClaimPacket[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getCoverageCaseById(id),
      getWorkflowHistory('coverage-case', id),
      getAvailableActions('coverage-case', id),
      getPreAuthByCaseId(id),
      getEventStream(id),
      getAllocation(id),
      getClaimByCaseId(id),
      getSettlementByCaseId(id),
    ]).then(([c, h, a, pa, ev, alloc, cl, sett]) => {
      setCase_(c); setHistory(h); setActions(a);
      setPreAuths(pa); setEvents(ev); setAllocation(alloc);
      setClaims(cl); setSettlements(sett);
    }).finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-200">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">{case_?.caseNumber ?? 'Case Detail'}</h1>
          <p className="text-xs text-gray-500">Coverage & Claims case</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-6 gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {case_ && <CaseSummaryPanel case_={case_} isLoading={loading} />}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-700">Workflow</h2>
              <WorkflowTimeline history={history} currentState={case_?.currentState ?? ''} isLoading={loading} />
              {actions.length > 0 && case_ && (
                <WorkflowActionBar
                  entityType="coverage-case"
                  entityId={id}
                  actions={actions}
                  onTransitionComplete={() => load()}
                />
              )}
            </div>
          </div>
        )}

        {/* Pre-Auth tab */}
        {tab === 'authorization' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">Pre-Authorizations</h2>
            {loading
              ? <div className="animate-pulse bg-gray-100 rounded-xl h-24" />
              : preAuths.length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">No pre-authorizations yet.</p>
                : preAuths.map(pa => (
                    <div key={pa.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-800">{pa.preAuthNumber}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          pa.status === 'TPAApproved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{pa.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                        <div>Requested: <span className="font-medium text-gray-700">₹{pa.requestedAmount.toLocaleString('en-IN')}</span></div>
                        {pa.approvedAmount != null && (
                          <div>Approved: <span className="font-medium text-green-700">₹{pa.approvedAmount.toLocaleString('en-IN')}</span></div>
                        )}
                        {pa.validFrom && <div>Valid From: {new Date(pa.validFrom).toLocaleDateString('en-IN')}</div>}
                        {pa.validUntil && <div>Valid Until: {new Date(pa.validUntil).toLocaleDateString('en-IN')}</div>}
                        {pa.tpaReferenceNumber && <div>TPA Ref: {pa.tpaReferenceNumber}</div>}
                      </div>
                    </div>
                  ))
            }
          </div>
        )}

        {/* Billing tab */}
        {tab === 'billing' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">Bill Allocation</h2>
            {loading
              ? <div className="animate-pulse bg-gray-100 rounded-xl h-24" />
              : allocation
                ? <div className="bg-white border border-gray-200 rounded-xl p-4"><AllocationBreakdown allocation={allocation} /></div>
                : <p className="text-sm text-gray-400 text-center py-8">No bill allocation recorded yet.</p>
            }
          </div>
        )}

        {/* Claims tab */}
        {tab === 'claims' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">Claims</h2>
            {loading
              ? <div className="animate-pulse bg-gray-100 rounded-xl h-24" />
              : claims.length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">No claims generated yet.</p>
                : claims.map(cl => <ClaimPacketPreview key={cl.id} claim={cl} />)
            }
          </div>
        )}

        {/* Settlement tab */}
        {tab === 'settlement' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">Settlements</h2>
            {loading
              ? <div className="animate-pulse bg-gray-100 rounded-xl h-24" />
              : settlements.length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">No settlements recorded yet.</p>
                : settlements.map(s => <SettlementReceipt key={s.id} settlement={s} />)
            }
          </div>
        )}

        {/* Events tab */}
        {tab === 'events' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">Approval Event Stream</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <ApprovalEventFeed events={events} isLoading={loading} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
