'use client';

import React, { useState } from 'react';
import {
  X, ShieldCheck, Send, MessageSquare, ChevronRight,
  RefreshCw, FileText, Building2, User, Calendar,
  IndianRupee, Info, AlertCircle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PreAuthorization } from '@/lib/api/ccms/ccms-authorizations.api';
import type { VisitPolicy } from '@/lib/api/ccms/visit-policies.api';
import type { PreAuthQueueItem } from '@/lib/api/ccms/ccms-operations.api';
import { getCoverageCaseWorkspace } from '@/lib/api/ccms/ccms-workspace.api';
import { ccmsKeys } from '@/lib/ccms/ccms-query-keys';
import { hydrateCaseQueryCache } from '@/lib/ccms/hydrate-ccms-case-cache';
import { SendPreAuthModal } from '@/components/ccms/modals/SendPreAuthModal';
import { TpaResponseModal } from '@/components/ccms/modals/TpaResponseModal';

const WORKSPACE_SECTIONS = 'policies,preauths';

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-1">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between py-1">
      <span className="text-[11px] text-gray-500 flex-shrink-0 mr-3">{label}</span>
      <span className={`text-[11px] font-semibold text-right ${highlight ? 'text-green-700' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    PREAUTH_GENERATED:        { cls: 'bg-indigo-50 text-indigo-700', label: 'Ready to send' },
    PREAUTH_SENT:           { cls: 'bg-blue-50 text-blue-700',   label: 'Sent to TPA' },
    WAITING_APPROVAL:       { cls: 'bg-amber-50 text-amber-700', label: 'Waiting for approval' },
    CLARIFICATION_REQUIRED: { cls: 'bg-red-50 text-red-700',     label: 'Query from TPA' },
    RESUBMITTED:            { cls: 'bg-blue-50 text-blue-700',   label: 'Resubmitted' },
    PARTIAL_APPROVAL:       { cls: 'bg-purple-50 text-purple-700', label: 'Partial Approval' },
    APPROVED:               { cls: 'bg-green-50 text-green-700', label: 'Approved' },
    REJECTED:               { cls: 'bg-red-100 text-red-800',    label: 'Rejected' },
    PENDING:                { cls: 'bg-gray-100 text-gray-600',  label: 'Pending' },
  };
  const cfg = map[status] ?? { cls: 'bg-gray-100 text-gray-600', label: status.replace(/_/g, ' ') };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function Skel({ h = 'h-8' }: { h?: string }) {
  return <div className={`${h} rounded-xl bg-gray-100 animate-pulse`} />;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  item: PreAuthQueueItem;
  onClose: () => void;
  onUpdated: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PreAuthWorkspace({ item, onClose, onUpdated }: Props) {
  const queryClient = useQueryClient();
  const caseId = item.caseCaseId;

  const workspaceQuery = useQuery({
    queryKey: ccmsKeys.workspace(caseId, WORKSPACE_SECTIONS),
    queryFn: async () => {
      const workspace = await getCoverageCaseWorkspace(caseId, WORKSPACE_SECTIONS);
      hydrateCaseQueryCache(queryClient, caseId, workspace);
      return workspace;
    },
    staleTime: 2 * 60 * 1000,
  });

  const auths = (queryClient.getQueryData<PreAuthorization[]>(ccmsKeys.preAuths(caseId))
    ?? workspaceQuery.data?.preAuths
    ?? []) as PreAuthorization[];
  const policies = (queryClient.getQueryData<VisitPolicy[]>(ccmsKeys.policies(caseId))
    ?? workspaceQuery.data?.policies
    ?? []) as VisitPolicy[];
  const loading = workspaceQuery.isLoading;
  const error = workspaceQuery.isError
    ? ((workspaceQuery.error as Error)?.message ?? 'Failed to load workspace')
    : null;

  const [sendTarget, setSendTarget] = useState<PreAuthorization | null>(null);
  const [responseTarget, setRespTarget] = useState<PreAuthorization | null>(null);

  const reload = () => {
    void workspaceQuery.refetch();
    onUpdated();
  };

  const primaryPolicy = policies.find(p => p.isPrimary) ?? policies[0];
  const latestAuth = auths.find(a => a.id === item.authId) ?? auths[0];

  const canSend = latestAuth && (latestAuth.status === 'PENDING' || latestAuth.status === 'PREAUTH_GENERATED');
  const canRespond = latestAuth && (
    latestAuth.status === 'SENT'
    || latestAuth.status === 'PREAUTH_SENT'
    || latestAuth.status === 'WAITING_APPROVAL'
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/25"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-[520px] max-w-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <div>
              <p className="text-sm font-extrabold text-gray-900">{item.caseNumber ?? 'Case'}</p>
              <p className="text-[11px] text-gray-400">{item.patientName ?? '—'} · {item.insurerName ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/dashboard/ccms/cases/${item.caseCaseId}?tab=authorization`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50"
            >
              Open case <ChevronRight className="w-3 h-3" />
            </a>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-shrink-0">
          {loading ? (
            <div className="h-8 w-48 bg-gray-200 rounded-xl animate-pulse" />
          ) : (
            <>
              {canSend && (
                <button
                  type="button"
                  onClick={() => latestAuth && setSendTarget(latestAuth)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                >
                  <Send className="w-3 h-3" />
                  Send to TPA
                </button>
              )}
              {canRespond && (
                <button
                  type="button"
                  onClick={() => latestAuth && setRespTarget(latestAuth)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
                >
                  <MessageSquare className="w-3 h-3" />
                  Record TPA Response
                </button>
              )}
              {!canSend && !canRespond && latestAuth && (
                <button
                  type="button"
                  onClick={() => setRespTarget(latestAuth)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  Update Response
                </button>
              )}
              <button
                type="button"
                onClick={reload}
                className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white"
                title="Reload"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
              <button type="button" onClick={reload} className="ml-auto font-semibold hover:underline">Retry</button>
            </div>
          )}

          <Section title="Queue Summary">
            <div className="bg-indigo-50 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">Current state</span>
                <StatusChip status={item.caseState || item.status} />
              </div>
              {item.processStatus && (
                <Row label="Process Status" value={item.processStatus.replace(/_/g, ' ')} />
              )}
              <Row
                label="Waiting"
                value={
                  <span className={item.daysWaiting >= 7 ? 'text-red-600 font-bold' : ''}>
                    {item.daysWaiting} day{item.daysWaiting !== 1 ? 's' : ''}
                  </span>
                }
              />
              {item.submittedAt && (
                <Row
                  label="Sent on"
                  value={new Date(item.submittedAt).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                />
              )}
            </div>
          </Section>

          <Section title="Primary Policy">
            {loading ? (
              <><Skel /><Skel /></>
            ) : !primaryPolicy ? (
              <p className="text-xs text-gray-400 italic">No policy on record.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs font-bold text-gray-800">
                    {primaryPolicy.insuranceProviderName ?? 'Insurer not set'}
                  </span>
                  {primaryPolicy.tpaProviderName && (
                    <span className="text-[10px] text-gray-400">via {primaryPolicy.tpaProviderName}</span>
                  )}
                </div>
                <Row label="Policy No." value={primaryPolicy.policyNumber ?? '—'} />
                {primaryPolicy.membershipNumber && (
                  <Row label="Card / Member No." value={primaryPolicy.membershipNumber} />
                )}
                {primaryPolicy.insuredName && (
                  <Row
                    label="Insured"
                    value={
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />{primaryPolicy.insuredName}
                      </span>
                    }
                  />
                )}
                {primaryPolicy.accommodationClass && (
                  <Row label="Room Class" value={primaryPolicy.accommodationClass} />
                )}
                {primaryPolicy.tpaCoordinatorName && (
                  <Row label="TPA Coordinator" value={primaryPolicy.tpaCoordinatorName} />
                )}
              </div>
            )}
          </Section>

          <Section title="Authorization">
            {loading ? (
              <Skel h="h-32" />
            ) : !latestAuth ? (
              <p className="text-xs text-gray-400 italic">No authorization generated yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-700">
                      {latestAuth.preAuthNumber ?? (
                        <span className="font-normal italic text-gray-400">Number pending</span>
                      )}
                    </span>
                    <StatusChip status={latestAuth.status} />
                  </div>
                  <Row
                    label="Requested"
                    value={
                      <span className="flex items-center gap-0.5">
                        <IndianRupee className="w-3 h-3" />
                        {latestAuth.requestedAmount.toLocaleString('en-IN')}
                      </span>
                    }
                  />
                  {latestAuth.approvedAmount > 0 && (
                    <Row
                      label="Approved"
                      value={
                        <span className="flex items-center gap-0.5 text-green-700">
                          <IndianRupee className="w-3 h-3" />
                          {latestAuth.approvedAmount.toLocaleString('en-IN')}
                        </span>
                      }
                      highlight
                    />
                  )}
                  {latestAuth.tpaReferenceNumber && (
                    <Row label="TPA Ref #" value={latestAuth.tpaReferenceNumber} />
                  )}
                </div>

                {latestAuth.clinicalSummary && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Clinical Summary
                    </p>
                    <p className="text-[11px] text-gray-600 whitespace-pre-wrap">{latestAuth.clinicalSummary}</p>
                  </div>
                )}

                {latestAuth.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1 flex items-center gap-1">
                      <Info className="w-3 h-3" /> Rejection Reason
                    </p>
                    <p className="text-xs text-red-700">{latestAuth.rejectionReason}</p>
                  </div>
                )}
              </div>
            )}
          </Section>

          {!loading && auths.length > 1 && (
            <Section title={`All Authorizations (${auths.length})`}>
              <div className="space-y-2">
                {auths.slice(1).map(a => (
                  <div key={a.id} className="bg-white border border-gray-100 rounded-xl px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-gray-700">{a.preAuthNumber ?? 'No pre-auth #'}</p>
                      <p className="text-[10px] text-gray-400">₹{a.requestedAmount.toLocaleString('en-IN')} requested</p>
                    </div>
                    <StatusChip status={a.status} />
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {sendTarget && (
        <SendPreAuthModal
          auth={sendTarget}
          open={!!sendTarget}
          onClose={() => setSendTarget(null)}
          onSent={() => {
            setSendTarget(null);
            reload();
          }}
        />
      )}

      {responseTarget && (
        <TpaResponseModal
          auth={responseTarget}
          open={!!responseTarget}
          onClose={() => setRespTarget(null)}
          onSaved={() => {
            setRespTarget(null);
            reload();
          }}
        />
      )}
    </>
  );
}
