'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, ShieldCheck, Receipt, FileBarChart2,
  Landmark, Zap, AlertTriangle, CheckCircle2, Clock,
  ChevronRight, Info, Plus, MessageSquare,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/auth-interceptors';

import { generatePreAuth, type PreAuthorization, type GeneratePreAuthRequest } from '@/lib/api/ccms/ccms-authorizations.api';
import type { CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { CaseSummaryPanel } from '@/components/ccms/CaseSummaryPanel';
import { PreAuthStatusBadge } from '@/components/ccms/PreAuthStatusBadge';
import { CasePatientInsuranceCard } from '@/components/ccms/CasePatientInsuranceCard';
import { CaseWorkflowStepper } from '@/components/ccms/CaseWorkflowStepper';
import { CaseDocumentsPanel } from '@/components/ccms/CaseDocumentsPanel';
import { ClarificationPanel } from '@/components/ccms/ClarificationPanel';
import { CaseEnhancementPanel } from '@/components/ccms/CaseEnhancementPanel';
import type { TpaResponsePrefill } from '@/lib/ccms/tpa-response-prefill';
import { TabActionButton } from '@/components/ccms/TabActionButton';
import { CaseIntakePanel } from '@/components/ccms/CaseIntakePanel';
import { checkActionPrerequisite } from '@/lib/ccms/ccms-action-prerequisites';
import { hasDbPrimaryVisitPolicy, PRIMARY_VISIT_POLICY_HINT, isPendingPreAuth } from '@/lib/ccms/ccms-visit-policy-prereq';
import { resolveDisplayAmounts } from '@/lib/ccms/build-preauth-prefill';
import { computeTabIndicators, parseTabParam } from '@/lib/ccms/ccms-tab-indicators';
import { getCaseDataLoadFlags, buildWorkspaceSections } from '@/lib/ccms/ccms-tab-loading';
import { getCcmsNextStep } from '@/lib/ccms/ccms-next-step';
import { useCasePatient } from '@/hooks/useCasePatient';
import {
  useHydrateCaseWorkspace,
  useCcmsCaseDetail,
  useCcmsCasePolicies,
  useCcmsCasePreAuths,
  useCcmsCaseWorkflowHistory,
  useCcmsCaseWorkflowActions,
  useCcmsCaseEvents,
  useCcmsCaseBilling,
  useCcmsCaseClaims,
  useCcmsCaseSettlements,
  useCcmsCaseCommunications,
  useCcmsCaseDocuments,
  useCcmsMasterData,
  useCcmsInvalidate,
  type CcmsInvalidateScope,
} from '@/hooks/use-ccms-case';
import { parseCounsellorDraft, displayPatientName } from '@/lib/api/ccms/parse-counsellor-draft';
import type { CcmsCommunicationLog } from '@/lib/api/ccms/ccms-communications.api';
import { CaseNextStepPanel } from '@/components/ccms/CaseNextStepPanel';
import { ProcessStatusBadge } from '@/components/ccms/ProcessStatusBadge';
import { WorkflowAdminPanel } from '@/components/ccms/WorkflowAdminPanel';
import { useCcmsPermissions } from '@/hooks/useCcmsPermissions';
import { usePreAuthPrefill } from '@/hooks/usePreAuthPrefill';

const tabLazyFallback = () => (
  <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
);

const CaseCommunicationsTab = dynamic(
  () => import('@/components/ccms/CaseCommunicationsTab').then(m => ({ default: m.CaseCommunicationsTab })),
  { loading: tabLazyFallback },
);
const AuthorizationForm = dynamic(
  () => import('@/components/ccms/AuthorizationForm').then(m => ({ default: m.AuthorizationForm })),
  { loading: tabLazyFallback },
);
const PreAuthEmailComposer = dynamic(
  () => import('@/components/ccms/PreAuthEmailComposer').then(m => ({ default: m.PreAuthEmailComposer })),
);
const BillingAllocationPanel = dynamic(
  () => import('@/components/ccms/BillingAllocationPanel').then(m => ({ default: m.BillingAllocationPanel })),
  { loading: tabLazyFallback },
);
const ClaimSubmissionForm = dynamic(
  () => import('@/components/ccms/ClaimSubmissionForm').then(m => ({ default: m.ClaimSubmissionForm })),
  { loading: tabLazyFallback },
);
const TpaResponseModal = dynamic(
  () => import('@/components/ccms/modals/TpaResponseModal').then(m => ({ default: m.TpaResponseModal })),
  { ssr: false },
);
const AllocateBillModal = dynamic(
  () => import('@/components/ccms/modals/AllocateBillModal').then(m => ({ default: m.AllocateBillModal })),
  { ssr: false },
);
const GenerateClaimModal = dynamic(
  () => import('@/components/ccms/modals/GenerateClaimModal').then(m => ({ default: m.GenerateClaimModal })),
  { ssr: false },
);
const RecordSettlementModal = dynamic(
  () => import('@/components/ccms/modals/RecordSettlementModal').then(m => ({ default: m.RecordSettlementModal })),
  { ssr: false },
);
const ReconcileCaseModal = dynamic(
  () => import('@/components/ccms/modals/ReconcileCaseModal').then(m => ({ default: m.ReconcileCaseModal })),
  { ssr: false },
);
const CloseCaseModal = dynamic(
  () => import('@/components/ccms/modals/CloseCaseModal').then(m => ({ default: m.CloseCaseModal })),
  { ssr: false },
);
const EligibilityModal = dynamic(
  () => import('@/components/ccms/modals/EligibilityModal').then(m => ({ default: m.EligibilityModal })),
  { ssr: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'authorization' | 'billing' | 'claims' | 'settlement' | 'events' | 'communications';

function queryErrorMessage(error: unknown): string | null {
  if (!error) return null;
  const e = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
  return e.response?.data?.error ?? e.response?.data?.message ?? e.message ?? 'Unknown error';
}

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable atoms
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton({ h = 'h-20' }: { h?: string }) {
  return <div className={`${h} rounded-2xl bg-gray-100 animate-pulse`} />;
}

function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-red-700">Failed to load</p>
        <p className="text-[11px] text-red-500 mt-0.5 truncate">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="text-[11px] font-semibold text-red-600 hover:underline flex-shrink-0">
          Retry
        </button>
      )}
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
        {icon}
      </div>
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      {sub && <p className="text-xs text-gray-400 mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

function SidebarField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className="text-xs font-semibold text-gray-800 text-right truncate">{value}</span>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 shrink-0 mr-4">{label}</span>
      <span className={`text-xs font-semibold text-right ${highlight ? 'text-emerald-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — patient/insurance/financials/actions panel
// ─────────────────────────────────────────────────────────────────────────────

function SidebarFinancialTiles({
  estimatedAmt,
  approvedAmount,
  patientPayableAmount,
  showApproved,
}: {
  estimatedAmt: number | null;
  approvedAmount: number;
  patientPayableAmount?: number | null;
  showApproved: boolean;
}) {
  if (!estimatedAmt && !showApproved && !patientPayableAmount) {
    return (
      <p className="text-xs text-gray-400 italic text-center py-2">
        Financials will appear once the counsellor draft is saved.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2">
      {estimatedAmt != null && (
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
          <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Estimated</p>
          <p className="text-base font-extrabold text-indigo-700">₹{estimatedAmt.toLocaleString('en-IN')}</p>
        </div>
      )}
      {showApproved && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Approved</p>
          <p className="text-base font-extrabold text-emerald-700">₹{approvedAmount.toLocaleString('en-IN')}</p>
        </div>
      )}
      {patientPayableAmount != null && patientPayableAmount > 0 && (
        <div className="flex items-center justify-between bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5">
          <p className="text-xs text-rose-500 font-semibold uppercase tracking-wider">Patient Pays</p>
          <p className="text-base font-extrabold text-rose-600">₹{patientPayableAmount.toLocaleString('en-IN')}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-auth cards
// ─────────────────────────────────────────────────────────────────────────────

function PreAuthCard({ pa, case_, draft, onSend, onResponse }: {
  pa: PreAuthorization;
  case_?: CoverageCase | null;
  draft?: ReturnType<typeof parseCounsellorDraft> | null;
  onSend?: (pa: PreAuthorization) => void;
  onResponse?: (pa: PreAuthorization) => void;
}) {
  const status = pa.status.toUpperCase();
  const approved  = status === 'APPROVED' || status === 'PARTIAL';
  const rejected  = status === 'REJECTED';
  const canSend   = status === 'PENDING';
  const canRespond = status === 'SENT' || status === 'CLARIFICATION';
  const displayRequested = case_
    ? resolveDisplayAmounts(pa, case_, draft ?? undefined).requested
    : pa.requestedAmount;
  const badgeCls  = approved ? 'bg-emerald-100 text-emerald-700'
    : rejected ? 'bg-red-100 text-red-700'
    : status === 'CLARIFICATION' ? 'bg-orange-100 text-orange-700'
    : status === 'SENT' ? 'bg-indigo-100 text-indigo-700'
    : 'bg-amber-100 text-amber-700';
  const statusLabel: Record<string, string> = {
    PENDING: 'Ready to Send', SENT: 'Awaiting TPA', APPROVED: 'Approved',
    PARTIAL: 'Partial Approval', REJECTED: 'Rejected', CLARIFICATION: 'Clarification',
    RECEIVED: 'Response Received',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">
          {pa.preAuthNumber ?? <span className="text-gray-400 font-normal italic">Number pending from TPA</span>}
        </p>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>
            {statusLabel[status] ?? status}
          </span>
          {pa.processStatus && (
            <ProcessStatusBadge processStatus={pa.processStatus} size="xs" />
          )}
          {canSend && onSend && (
            <button onClick={() => onSend(pa)} className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Send to TPA</button>
          )}
          {canRespond && onResponse && (
            <button onClick={() => onResponse(pa)} className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100">Record Response</button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-0">
        <InfoRow label="Requested" value={`₹${displayRequested.toLocaleString('en-IN')}`} />
        {pa.approvedAmount != null && pa.approvedAmount > 0 && (
          <InfoRow label="Approved" value={`₹${pa.approvedAmount.toLocaleString('en-IN')}`} highlight />
        )}
        {pa.validFrom  && <InfoRow label="Valid From"  value={new Date(pa.validFrom).toLocaleDateString('en-IN')} />}
        {pa.validUntil && <InfoRow label="Valid Until" value={new Date(pa.validUntil).toLocaleDateString('en-IN')} />}
        {pa.tpaReferenceNumber && <InfoRow label="TPA Ref" value={pa.tpaReferenceNumber} />}
        {pa.submittedAt && <InfoRow label="Submitted"  value={new Date(pa.submittedAt).toLocaleDateString('en-IN')} />}
      </div>
      {pa.rejectionReason && (
        <p className="text-[11px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{pa.rejectionReason}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab definition
// ─────────────────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview',       label: 'Overview',       icon: <Info          className="w-3.5 h-3.5" /> },
  { key: 'communications', label: 'Comms',          icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: 'authorization',  label: 'Pre-Auth',       icon: <ShieldCheck   className="w-3.5 h-3.5" /> },
  { key: 'billing',        label: 'Billing',        icon: <Receipt       className="w-3.5 h-3.5" /> },
  { key: 'claims',         label: 'Claims',         icon: <FileBarChart2 className="w-3.5 h-3.5" /> },
  { key: 'settlement',     label: 'Settlement',     icon: <Landmark      className="w-3.5 h-3.5" /> },
  { key: 'events',         label: 'Events',         icon: <Zap           className="w-3.5 h-3.5" /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function CcmsCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const searchParams = useSearchParams();
  const perms   = useCcmsPermissions();
  const { invalidateCase, invalidateAllCaseData } = useCcmsInvalidate();

  const [tab, setTab] = useState<TabKey>('overview');

  const bootstrapFlags = useMemo(
    () => getCaseDataLoadFlags(tab, null, perms.isWorkflowAdmin),
    [tab, perms.isWorkflowAdmin],
  );
  const bootstrapWs = useHydrateCaseWorkspace(id, bootstrapFlags);
  const workspaceUnavailable = bootstrapWs.isError;
  const caseDetailQuery = useCcmsCaseDetail(id, workspaceUnavailable);
  const caseStateForFlags =
    caseDetailQuery.data?.currentState ?? bootstrapWs.data?.case?.currentState;

  const loadFlags = useMemo(
    () => getCaseDataLoadFlags(tab, caseStateForFlags, perms.isWorkflowAdmin),
    [tab, caseStateForFlags, perms.isWorkflowAdmin],
  );
  const needsExpandedWs =
    buildWorkspaceSections(loadFlags) !== buildWorkspaceSections(bootstrapFlags);
  const expandedWs = useHydrateCaseWorkspace(id, needsExpandedWs && !workspaceUnavailable ? loadFlags : undefined);

  const workspaceLoading =
    !workspaceUnavailable
    && (bootstrapWs.isLoading || (needsExpandedWs && expandedWs.isLoading));
  const useIndividualFetch = workspaceUnavailable
    || (needsExpandedWs && expandedWs.isError);

  const case_ =
    caseDetailQuery.data
    ?? bootstrapWs.data?.case
    ?? expandedWs.data?.case
    ?? null;

  const caseLoading = !case_ && (
    workspaceLoading
    || (workspaceUnavailable && caseDetailQuery.isLoading)
  );
  const caseError = (() => {
    if (case_ || caseLoading) return null;
    if (workspaceUnavailable) {
      if (caseDetailQuery.isError) {
        const status = (caseDetailQuery.error as { response?: { status?: number } })?.response?.status;
        return status === 404
          ? 'Case not found.'
          : queryErrorMessage(caseDetailQuery.error) ?? 'Could not load case.';
      }
      return queryErrorMessage(bootstrapWs.error) ?? 'Could not load case.';
    }
    const wsStatus = (bootstrapWs.error as { response?: { status?: number } })?.response?.status;
    return wsStatus === 404
      ? 'Case not found.'
      : queryErrorMessage(bootstrapWs.error) ?? 'Could not load case.';
  })();

  const historyQuery = useCcmsCaseWorkflowHistory(
    id, case_?.workflowInstanceId, loadFlags.workflowHistory && useIndividualFetch,
  );
  const actionsQuery = useCcmsCaseWorkflowActions(
    id, case_?.workflowInstanceId, loadFlags.workflowActions && useIndividualFetch,
  );
  const preAuthsQuery = useCcmsCasePreAuths(id, loadFlags.preAuths && useIndividualFetch);
  const eventsQuery = useCcmsCaseEvents(id, loadFlags.events && useIndividualFetch);
  const billingQuery = useCcmsCaseBilling(id, loadFlags.billing && useIndividualFetch);
  const claimsQuery = useCcmsCaseClaims(id, loadFlags.claims && useIndividualFetch);
  const settlementsQuery = useCcmsCaseSettlements(id, loadFlags.settlements && useIndividualFetch);
  const policiesQuery = useCcmsCasePolicies(id, loadFlags.policies && useIndividualFetch);
  const communicationsQuery = useCcmsCaseCommunications(id, loadFlags.communications && useIndividualFetch);
  const documentsQuery = useCcmsCaseDocuments(id, loadFlags.documents && useIndividualFetch);
  const { payers: payerMaster, tpas: tpaMaster } = useCcmsMasterData();

  const sliceLoading = (
    enabled: boolean,
    query: { isLoading: boolean; isFetched: boolean },
  ) => enabled && !query.isFetched && (workspaceLoading || query.isLoading);

  const history = {
    data: historyQuery.data ?? [],
    loading: sliceLoading(loadFlags.workflowHistory, historyQuery),
    error: queryErrorMessage(historyQuery.error),
  };
  const actions = {
    data: actionsQuery.data ?? [],
    loading: sliceLoading(loadFlags.workflowActions, actionsQuery),
    error: queryErrorMessage(actionsQuery.error),
  };
  const preAuths = {
    data: preAuthsQuery.data ?? [],
    loading: sliceLoading(loadFlags.preAuths, preAuthsQuery),
    error: queryErrorMessage(preAuthsQuery.error),
  };
  const events = {
    data: eventsQuery.data ?? [],
    loading: sliceLoading(loadFlags.events, eventsQuery),
    error: queryErrorMessage(eventsQuery.error),
  };
  const billingFull = {
    data: billingQuery.data ?? null,
    loading: sliceLoading(loadFlags.billing, billingQuery),
    error: queryErrorMessage(billingQuery.error),
  };
  const claims = {
    data: claimsQuery.data ?? [],
    loading: sliceLoading(loadFlags.claims, claimsQuery),
    error: queryErrorMessage(claimsQuery.error),
  };
  const settlements = {
    data: settlementsQuery.data ?? [],
    loading: sliceLoading(loadFlags.settlements, settlementsQuery),
    error: queryErrorMessage(settlementsQuery.error),
  };
  const policies = {
    data: policiesQuery.data ?? [],
    loading: sliceLoading(loadFlags.policies, policiesQuery),
    error: queryErrorMessage(policiesQuery.error),
  };
  const communications = {
    data: communicationsQuery.data ?? [],
    loading: sliceLoading(loadFlags.communications, communicationsQuery),
    error: queryErrorMessage(communicationsQuery.error),
  };

  const [generatingPreAuth, setGeneratingPreAuth] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [emailComposerAuth, setEmailComposerAuth] = useState<PreAuthorization | null>(null);
  const [sendPreAuthTarget,  setSendPreAuthTarget]  = useState<PreAuthorization | null>(null);
  const [tpaResponseTarget,  setTpaResponseTarget]  = useState<PreAuthorization | null>(null);
  const [tpaResponsePrefill, setTpaResponsePrefill] = useState<TpaResponsePrefill | null>(null);
  const [showAllocateModal,  setShowAllocateModal]  = useState(false);
  const [showGenerateClaim,  setShowGenerateClaim]  = useState(false);
  const [showRecordSettlement, setShowRecordSettlement] = useState(false);
  const [showReconcile,      setShowReconcile]      = useState(false);
  const [showCloseCase,      setShowCloseCase]      = useState(false);
  const [showEligibility,    setShowEligibility]    = useState(false);

  /** Invalidate only affected slices after a domain action; optionally jump tabs. */
  const refreshAfterAction = useCallback(async (
    goToTab?: TabKey,
    scopes: CcmsInvalidateScope[] = ['case'],
  ) => {
    if (!id) return;
    await invalidateCase(id, scopes, { workflowInstanceId: case_?.workflowInstanceId });
    if (goToTab) {
      setTab(goToTab);
    } else if (case_) {
      const step = getCcmsNextStep(case_.currentState);
      if (step && step.tab !== 'overview' && step.tab !== 'events' && step.tab !== 'communications') {
        setTab(step.tab as TabKey);
      }
    }
  }, [id, invalidateCase, case_]);

  const loadCase = useCallback(async () => {
    if (!id) return;
    await invalidateAllCaseData(id);
  }, [id, invalidateAllCaseData]);

  const handleTransitionDone = useCallback(() => {
    if (!id) return;
    void invalidateCase(id, ['case', 'workflow', 'preAuths', 'events'], {
      workflowInstanceId: case_?.workflowInstanceId,
    });
  }, [id, invalidateCase, case_?.workflowInstanceId]);

  const awaitingPreAuth = useMemo(
    () => preAuths.data.find(p => p.submittedAt || p.status.toUpperCase() === 'SENT'),
    [preAuths.data],
  );

  const handleApplyInboundToPreAuth = useCallback((comm: CcmsCommunicationLog, prefill: TpaResponsePrefill) => {
    if (!perms.canRecordTpaResponse) {
      toast.error('You do not have permission to record TPA responses');
      return;
    }
    const auth = awaitingPreAuth ?? preAuths.data[0];
    if (!auth) {
      toast.error('No pre-authorization on this case to apply the response to');
      return;
    }
    setTpaResponsePrefill({ ...prefill, communicationLogId: comm.id });
    setTpaResponseTarget(auth);
    setTab('authorization');
  }, [awaitingPreAuth, preAuths.data, perms.canRecordTpaResponse]);

  const { prefill: preAuthPrefill, loading: preAuthPrefillLoading } = usePreAuthPrefill({
    case_,
    policies: policies.data,
    enabled: showAuthForm && !!case_,
  });

  useEffect(() => {
    const fromUrl = parseTabParam(searchParams.get('tab'));
    if (fromUrl) setTab(fromUrl);
  }, [searchParams]);

  const prereqCtx = useMemo(() => ({
    case_,
    policies: policies.data,
    preAuths: preAuths.data,
    billing: billingFull.data,
    claims: claims.data,
    settlements: settlements.data,
  }), [case_, policies.data, preAuths.data, billingFull.data, claims.data, settlements.data]);

  const preAuthPrereq       = checkActionPrerequisite('generatePreAuth', prereqCtx);
  const allocateBillPrereq  = checkActionPrerequisite('allocateBill', prereqCtx);
  const generateClaimPrereq = checkActionPrerequisite('generateClaim', prereqCtx);
  const recordSettlementPrereq = checkActionPrerequisite('recordSettlement', prereqCtx);
  const reconcilePrereq     = checkActionPrerequisite('reconcile', prereqCtx);
  const closeCasePrereq     = checkActionPrerequisite('closeCase', prereqCtx);

  const tabIndicators = useMemo(
    () => computeTabIndicators(prereqCtx, preAuths.data, claims.data, settlements.data),
    [prereqCtx, preAuths.data, claims.data, settlements.data],
  );

  const { mrn: patientMrn } = useCasePatient(case_?.patientId);
  const draftSnapshot = parseCounsellorDraft(case_?.counsellorDraftJson);
  const needsVisitPolicyImport = Boolean(
    draftSnapshot?.policyNumber?.trim()
    && !hasDbPrimaryVisitPolicy(policies.data)
    && !policies.loading,
  );
  const primaryPolicy = policies.data.find(p => p.isPrimary) ?? policies.data[0];
  const sidebarPolicyNo = draftSnapshot?.policyNumber ?? primaryPolicy?.policyNumber;
  const sidebarMembership = draftSnapshot?.membershipNumber ?? primaryPolicy?.membershipNumber;

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (caseLoading) {
    return (
      <div className="flex h-full">
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-100">
            <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex-1 p-6 space-y-4">
            <Skeleton h="h-28" />
            <Skeleton h="h-32" />
            <Skeleton h="h-64" />
          </div>
        </div>
        <div className="w-72 border-l border-gray-100 p-4 space-y-3">
          <Skeleton h="h-40" />
          <Skeleton h="h-24" />
          <Skeleton h="h-20" />
        </div>
      </div>
    );
  }

  if (caseError) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-sm shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-sm font-bold text-gray-800 mb-1">Could not load case</p>
          <p className="text-xs text-gray-500 mb-5">{caseError}</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => router.back()} className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">Go Back</button>
            <button onClick={loadCase}            className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Derive shared values ───────────────────────────────────────────────────

  const draft = parseCounsellorDraft(case_?.counsellorDraftJson);
  const patientDisplayName = displayPatientName(case_!, draft);
  const initials = patientDisplayName !== '—'
    ? patientDisplayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const approvedStates = new Set(['APPROVED', 'PARTIAL_APPROVAL', 'FULL_SETTLEMENT', 'RECONCILED', 'CLOSED']);
  const showApproved   = approvedStates.has(case_!.currentState) && case_!.approvedAmount > 0;

  let draftEstimate: number | null = null;
  try {
    const d = case_?.counsellorDraftJson ? JSON.parse(case_.counsellorDraftJson) : {};
    draftEstimate = d.estimatedAmount ? Number(d.estimatedAmount) : null;
  } catch { /* ignore */ }
  const estimatedAmt = case_?.estimatedAmount ?? draftEstimate;

  const serviceTaxApplicable = case_?.serviceTaxApplicable
    ?? (() => {
      try {
        const d = case_?.counsellorDraftJson ? JSON.parse(case_.counsellorDraftJson) : {};
        return d.serviceTaxApplicable ?? false;
      } catch { return false; }
    })();
  const serviceTaxPercent = case_?.serviceTaxPercent
    ?? (() => {
      try {
        const d = case_?.counsellorDraftJson ? JSON.parse(case_.counsellorDraftJson) : {};
        return Number(d.serviceTaxPercent ?? 0);
      } catch { return 0; }
    })();

  const primaryPolicyForPrefill = policies.data.find(p => p.isPrimary) ?? policies.data[0] ?? null;
  const caseDocuments = documentsQuery.data;
  const caseDocumentsLoading = sliceLoading(loadFlags.documents, documentsQuery);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden bg-gray-50">

      {/* ── LEFT: main scrollable area ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Compact 2-row header */}
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          {/* Row 1 */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <h1 className="text-lg font-extrabold text-gray-900 font-mono tracking-tight flex-shrink-0">
                {case_?.caseNumber ?? '—'}
              </h1>
              {case_ && <PreAuthStatusBadge state={case_.currentState} size="md" />}
            </div>
            <button onClick={loadCase} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 flex-shrink-0" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {/* Tab bar */}
          <div className="flex items-center bg-white px-3 overflow-x-auto gap-0.5">
            {TABS.map(t => {
              const ind = tabIndicators[t.key];
              return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                  tab === t.key
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                    : ind?.isNext
                      ? 'border-transparent text-indigo-600 bg-indigo-50/30'
                      : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t.icon}
                {t.label}
                {ind?.pending && (
                  <span className={`w-1.5 h-1.5 rounded-full ${ind.isNext ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                )}
              </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
          {tab === 'overview' && case_ && (
            <div className="space-y-5">
              {/* Workflow stepper */}
              <CaseWorkflowStepper currentState={case_.currentState} />

              {/* Intake — eligibility, policies, capture (Phase 3) */}
              <CaseIntakePanel
                case_={case_}
                onRefresh={() => void invalidateCase(case_.id, ['case', 'policies', 'eligibility'])}
                onVerifyEligibility={() => setShowEligibility(true)}
              />

              {/* Patient + Insurance card — full-width 2-col in main area */}
              <CasePatientInsuranceCard case_={case_} twoColumn={true} />

              {/* Primary policy + service tax (post-intake states only) */}
              {(() => {
                const intakeVisible = ['DRAFT', 'ELIGIBILITY_PENDING', 'ELIGIBILITY_VERIFIED', 'POLICY_CAPTURED', 'AUTHORIZATION_REQUIRED'].includes(case_.currentState);
                if (intakeVisible) return null;
                const primary = policies.data.find(p => p.isPrimary) ?? policies.data[0];
                if (!primary && !policies.loading) return null;
                if (policies.loading) return <Skeleton h="h-20" />;
                if (!primary) return null;

                let stApplicable = false, stPct = 0, stAmt = 0, totalWithTax = 0;
                try {
                  const d = case_.counsellorDraftJson ? JSON.parse(case_.counsellorDraftJson) : {};
                  stApplicable = d.serviceTaxApplicable ?? false;
                  stPct = Number(d.serviceTaxPercent ?? 0);
                  const est = Number(d.estimatedAmount ?? 0);
                  stAmt = stApplicable ? Math.round(est * stPct / 100 * 100) / 100 : 0;
                  totalWithTax = est + stAmt;
                } catch { /* ignore */ }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-indigo-100 rounded-2xl p-4 space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Primary Policy</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                        <InfoRow label="Policy No."  value={primary.policyNumber ?? '—'} />
                        <InfoRow label="Insured"     value={primary.insuredName  ?? '—'} />
                        {primary.membershipNumber && <InfoRow label="Card No."     value={primary.membershipNumber} />}
                        {primary.relationship     && <InfoRow label="Relationship" value={primary.relationship} />}
                        {primary.accommodationClass && <InfoRow label="Room Class" value={primary.accommodationClass} />}
                      </div>
                    </div>

                    {stApplicable && totalWithTax > 0 && (
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2">Service Tax</p>
                        <InfoRow label="Estimate (ex-tax)"     value={`₹${(totalWithTax - stAmt).toLocaleString('en-IN')}`} />
                        <InfoRow label={`Tax (${stPct}%)`}     value={`₹${stAmt.toLocaleString('en-IN')}`} />
                        <div className="border-t border-amber-200 pt-1">
                          <InfoRow label="Total for Pre-Auth"  value={`₹${totalWithTax.toLocaleString('en-IN')}`} highlight />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Documents */}
              <CaseDocumentsPanel
                caseId={case_.id}
                patientId={case_.patientId}
                insuranceProviderId={case_.insuranceProviderId}
                tpaProviderId={case_.tpaProviderId}
                governmentSchemeId={case_.governmentSchemeId}
                documents={caseDocuments}
                documentsLoading={caseDocumentsLoading}
              />

              {/* Summary panel */}
              <CaseSummaryPanel case_={case_} isLoading={false} />

              {/* Recent Activity */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-700 uppercase tracking-wider">Recent Activity</p>
                  <button onClick={() => setTab('communications')} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {history.loading || communications.loading ? (
                  <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-9 rounded-lg bg-gray-100 animate-pulse" />)}</div>
                ) : (() => {
                  const recent = [
                    ...history.data.map((h, i) => ({ at: h.performedAt, key: `wf-${i}`, label: `${h.fromState} → ${h.toState}`, sub: h.actionCode })),
                    ...communications.data.map(c => ({ at: c.sentAt ?? c.createdAt ?? '', key: `cm-${c.id}`, label: `${c.communicationType?.toUpperCase()} to ${c.recipientType}`, sub: c.subject ?? c.recipientAddress ?? '' })),
                  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 4);
                  return recent.length === 0 ? (
                    <div className="text-center py-5">
                      <Clock className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                      <p className="text-xs text-gray-400">No activity yet</p>
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {recent.map(item => (
                        <li key={item.key} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-gray-50">
                          <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-700 truncate">{item.label}</p>
                            {item.sub && <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>}
                          </div>
                          <p className="text-[11px] text-gray-400 flex-shrink-0">
                            {item.at ? new Date(item.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── COMMUNICATIONS ────────────────────────────────────────────── */}
          {tab === 'communications' && case_ && (
            <CaseCommunicationsTab
              caseId={case_.id}
              case_={case_}
              currentState={case_.currentState}
              workflowHistory={history.data}
              approvalEvents={events.data}
              historyLoading={history.loading}
              draft={parseCounsellorDraft(case_.counsellorDraftJson)}
              initialComms={communications.loading ? undefined : communications.data}
              skipInitialFetch
              canRecordTpaResponse={perms.canRecordTpaResponse}
              onApplyInboundToPreAuth={handleApplyInboundToPreAuth}
            />
          )}

          {/* ── PRE-AUTH ──────────────────────────────────────────────────── */}
          {tab === 'authorization' && (
            <div className="space-y-4">
              {case_ && (
                <CaseEnhancementPanel
                  caseId={case_.id}
                  caseApprovedAmount={Number(case_.approvedAmount ?? 0)}
                  eligibleAmountHint={Number(
                    case_.estimatedAmount
                    ?? case_.approvedAmount
                    ?? 0,
                  )}
                  canWrite={perms.canCreateAuth || perms.canRecordTpaResponse}
                />
              )}
              {needsVisitPolicyImport && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-900">Primary visit policy required</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Policy <span className="font-mono">{draftSnapshot!.policyNumber}</span> is in the counsellor draft only.
                      Import it on Overview before generating pre-auth.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('overview')}
                    className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                  >
                    Go to Overview
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-gray-800">Pre-Authorizations</p>
                <div className="flex items-center gap-2">
                  {case_?.preAuthNumber && (
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg font-mono">
                      Auth # {case_.preAuthNumber}
                    </span>
                  )}
                  {case_ && !showAuthForm && perms.canCreateAuth && (
                    <TabActionButton
                      onClick={() => setShowAuthForm(true)}
                      disabledReason={!preAuthPrereq.allowed ? preAuthPrereq.reason : undefined}
                    >
                      <Plus className="w-3 h-3" /> Generate Pre-Auth
                    </TabActionButton>
                  )}
                </div>
              </div>
              {showAuthForm && case_ && (
                <div className="bg-white border border-indigo-200 rounded-2xl p-5">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-4">New Pre-Authorization Request</p>
                  <AuthorizationForm
                    caseId={case_.id}
                    serviceTaxApplicable={serviceTaxApplicable}
                    serviceTaxPercent={serviceTaxPercent}
                    prefill={preAuthPrefill}
                    prefillLoading={preAuthPrefillLoading}
                    onSubmit={async (req: GeneratePreAuthRequest) => {
                      if (!hasDbPrimaryVisitPolicy(policies.data)) {
                        toast.error(PRIMARY_VISIT_POLICY_HINT);
                        return;
                      }
                      setGeneratingPreAuth(true);
                      try {
                        const created = await generatePreAuth(case_.id, req);
                        setShowAuthForm(false);
                        setEmailComposerAuth(created);
                        toast.success('Pre-auth generated — review email below');
                        await refreshAfterAction('authorization', ['case', 'preAuths', 'workflow']);
                      } catch (err) {
                        toast.error(getApiErrorMessage(err, 'Failed to generate pre-auth'));
                      } finally {
                        setGeneratingPreAuth(false);
                      }
                    }}
                    onCancel={() => setShowAuthForm(false)}
                    loading={generatingPreAuth}
                  />
                </div>
              )}
              {emailComposerAuth && case_ && !showAuthForm && (
                <PreAuthEmailComposer
                  case_={case_}
                  auth={emailComposerAuth}
                  draft={draft}
                  comms={communications.data}
                  primaryPolicy={primaryPolicyForPrefill}
                  payers={payerMaster}
                  tpas={tpaMaster}
                  intakeDocuments={caseDocuments}
                  intakeDocumentsLoading={caseDocumentsLoading}
                  onClose={() => setEmailComposerAuth(null)}
                  onSent={async () => {
                    setEmailComposerAuth(null);
                    await refreshAfterAction('authorization', ['case', 'preAuths', 'communications', 'workflow']);
                  }}
                />
              )}
              {preAuths.loading ? <><Skeleton h="h-28" /><Skeleton h="h-28" /></>
                : preAuths.error ? <SectionError message={preAuths.error} onRetry={() => id && void invalidateCase(id, ['preAuths'])} />
                : preAuths.data.length === 0 && !showAuthForm && !emailComposerAuth ? (
                  <EmptyState icon={<ShieldCheck className="w-5 h-5" />} title="No pre-authorization yet" sub="Click Generate Pre-Auth to submit to TPA." />
                ) : (
                  <>
                    {case_.currentState === 'CLARIFICATION_REQUIRED' && preAuths.data[0] && (
                      <ClarificationPanel
                        auth={preAuths.data[0]}
                        onGoToComms={() => setTab('communications')}
                      />
                    )}
                    {preAuths.data.map(pa => (
                      <PreAuthCard key={pa.id} pa={pa} case_={case_} draft={draftSnapshot}
                        onSend={perms.canSubmitAuth ? setSendPreAuthTarget : undefined}
                        onResponse={perms.canRecordTpaResponse ? (p) => {
                          setTpaResponsePrefill(null);
                          setTpaResponseTarget(p);
                        } : undefined} />
                    ))}
                  </>
                )}
            </div>
          )}

          {/* ── BILLING ───────────────────────────────────────────────────── */}
          {tab === 'billing' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-gray-800">Bill Allocation</p>
                {case_ && perms.canAllocateBill && (
                  <TabActionButton onClick={() => setShowAllocateModal(true)}
                    disabledReason={!allocateBillPrereq.allowed ? allocateBillPrereq.reason : undefined}>
                    <Receipt className="w-3 h-3" /> {billingFull.data ? 'Re-Allocate' : 'Allocate Bill'}
                  </TabActionButton>
                )}
              </div>
              {billingFull.loading ? <Skeleton h="h-40" />
                : billingFull.error ? <SectionError message={billingFull.error} onRetry={() => id && void invalidateCase(id, ['billing'])} />
                : !billingFull.data ? <EmptyState icon={<Receipt className="w-5 h-5" />} title="No bill allocation yet" sub="Click Allocate Bill to compute insurance vs. patient share." />
                : <div className="bg-white border border-gray-200 rounded-2xl p-5"><BillingAllocationPanel data={billingFull.data} /></div>}
            </div>
          )}

          {/* ── CLAIMS ────────────────────────────────────────────────────── */}
          {tab === 'claims' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-gray-800">Claims</p>
                {case_ && perms.canCreateClaim && claims.data.length === 0 && !claims.loading && (
                  <TabActionButton onClick={() => setShowGenerateClaim(true)}
                    disabledReason={!generateClaimPrereq.allowed ? generateClaimPrereq.reason : undefined}>
                    <Plus className="w-3 h-3" /> Generate Claim
                  </TabActionButton>
                )}
              </div>
              {claims.loading ? <><Skeleton h="h-28" /><Skeleton h="h-28" /></>
                : claims.error ? <SectionError message={claims.error} onRetry={() => id && void invalidateCase(id, ['claims'])} />
                : case_ ? (
                  <ClaimSubmissionForm
                    caseId={case_.id}
                    claim={claims.data[0] ?? null}
                    onUpdate={() => refreshAfterAction('claims', ['case', 'claims', 'workflow'])}
                    canSubmit={perms.canSubmitClaim}
                    canAcknowledge={perms.canAcknowledgeClaim}
                    loading={claims.loading}
                  />
                ) : null}
            </div>
          )}

          {/* ── SETTLEMENT ────────────────────────────────────────────────── */}
          {tab === 'settlement' && (() => {
            const totalClaimed = claims.data[0]?.claimedAmount ?? 0;
            const totalSettled = settlements.data.reduce((s, x) => s + x.settledAmount, 0);
            const outstanding  = Math.max(totalClaimed - totalSettled, 0);
            const isReconciled = case_?.currentState === 'RECONCILED';
            const isClosed     = case_?.currentState === 'CLOSED';
            const recordDisabledReason = !recordSettlementPrereq.allowed
              ? recordSettlementPrereq.reason
              : outstanding <= 0
                ? 'No outstanding amount to record.'
                : undefined;
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold text-gray-800">Settlements</p>
                  <div className="flex items-center gap-2">
                    {case_ && perms.canRecordSettlement && !isReconciled && !isClosed && (
                      <TabActionButton onClick={() => setShowRecordSettlement(true)}
                        disabledReason={recordDisabledReason}>
                        <Landmark className="w-3 h-3" /> Record Payment
                      </TabActionButton>
                    )}
                    {case_ && perms.canReconcile && !isReconciled && !isClosed && (
                      <TabActionButton variant="success" onClick={() => setShowReconcile(true)}
                        disabledReason={!reconcilePrereq.allowed ? reconcilePrereq.reason : undefined}>
                        <CheckCircle2 className="w-3 h-3" /> Reconcile
                      </TabActionButton>
                    )}
                    {case_ && perms.canReconcile && isReconciled && !isClosed && (
                      <TabActionButton onClick={() => setShowCloseCase(true)}
                        disabledReason={!closeCasePrereq.allowed ? closeCasePrereq.reason : undefined}
                        className="!bg-gray-800 hover:!bg-gray-900">
                        <CheckCircle2 className="w-3 h-3" /> Close Case
                      </TabActionButton>
                    )}
                  </div>
                </div>
                {(totalClaimed > 0 || totalSettled > 0) && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex gap-4">
                    {[
                      { label: 'Claimed',     val: totalClaimed, cls: 'text-gray-700' },
                      { label: 'Settled',     val: totalSettled, cls: 'text-emerald-700 font-bold' },
                      { label: 'Outstanding', val: outstanding,  cls: outstanding > 0 ? 'text-red-600 font-bold' : 'text-emerald-600 font-semibold' },
                    ].map(({ label, val, cls }) => (
                      <div key={label} className="text-center flex-1">
                        <p className="text-[10px] uppercase tracking-widest text-gray-400">{label}</p>
                        <p className={`text-sm font-bold ${cls}`}>₹{val.toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                )}
                {settlements.loading ? <Skeleton h="h-32" />
                  : settlements.error ? <SectionError message={settlements.error} onRetry={() => id && void invalidateCase(id, ['settlements'])} />
                  : settlements.data.length === 0 ? <EmptyState icon={<Landmark className="w-5 h-5" />} title="No settlements recorded" sub="Click Record Payment once the insurer releases payment." />
                  : settlements.data.map(s => (
                    <div key={s.id} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-800">{s.settlementNumber}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.reconciliationStatus === 'Reconciled' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {s.reconciliationStatus ?? s.settlementType}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6">
                        <InfoRow label="Settled"   value={`₹${s.settledAmount.toLocaleString('en-IN')}`} highlight />
                        {s.claimAmount > 0     && <InfoRow label="Claimed"   value={`₹${s.claimAmount.toLocaleString('en-IN')}`} />}
                        {s.outstandingAmount > 0 && <InfoRow label="Outstanding" value={`₹${s.outstandingAmount.toLocaleString('en-IN')}`} />}
                        {s.paymentMode         && <InfoRow label="Mode"      value={s.paymentMode} />}
                        {s.paymentReference    && <InfoRow label="UTR #"     value={s.paymentReference} />}
                        {s.paymentDate         && <InfoRow label="Date"      value={new Date(s.paymentDate).toLocaleDateString('en-IN')} />}
                      </div>
                    </div>
                  ))}
              </div>
            );
          })()}

          {/* ── EVENTS ────────────────────────────────────────────────────── */}
          {tab === 'events' && (
            <div className="space-y-4">
              <p className="text-base font-bold text-gray-800">Approval Event Stream</p>
              {events.loading ? <><Skeleton h="h-20" /><Skeleton h="h-20" /></>
                : events.error ? <SectionError message={events.error} onRetry={() => id && void invalidateCase(id, ['events'])} />
                : events.data.length === 0 ? (
                  <EmptyState icon={<Zap className="w-5 h-5" />} title="No approval events yet" sub="Events are recorded when TPA decisions arrive." />
                ) : (
                  <div className="space-y-2">
                    {events.data.map(ev => (
                      <div key={ev.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <Zap className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-gray-800">{ev.eventType}</p>
                            {ev.approvalStatus && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ev.approvalStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : ev.approvalStatus === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                {ev.approvalStatus}
                              </span>
                            )}
                          </div>
                          {ev.approvedAmount > 0 && <p className="text-[11px] font-semibold text-emerald-600">₹{ev.approvedAmount.toLocaleString('en-IN')} approved</p>}
                          {ev.recordedBy && <p className="text-[11px] text-gray-500">By {ev.recordedBy}</p>}
                          {ev.rejectionReason && <p className="text-[11px] italic text-red-500 mt-0.5">{ev.rejectionReason}</p>}
                        </div>
                        <p className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                          {new Date(ev.recordedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: sticky sidebar ────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-y-auto">
        {case_ && (
          <>
            {/* Patient / insurer identity strip */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-base flex-shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold leading-tight truncate">
                    {patientDisplayName !== '—' ? patientDisplayName : 'Patient'}
                  </p>
                  <p className="text-xs text-indigo-200 mt-1 truncate">
                    {case_.insurerName ?? case_.payerType ?? 'No insurer'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 p-4 space-y-5 overflow-y-auto">
              {/* Financial tiles */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Financials</p>
                <SidebarFinancialTiles
                  estimatedAmt={estimatedAmt ?? null}
                  approvedAmount={case_.approvedAmount}
                  patientPayableAmount={case_.patientPayableAmount}
                  showApproved={showApproved}
                />
              </div>

              {/* Next step guidance + admin workflow */}
              <div className="space-y-3">
                <CaseNextStepPanel
                  currentState={case_.currentState}
                  sessionId={case_.sessionId}
                  activeTab={tab}
                  onGoToTab={(t) => setTab(t as TabKey)}
                  isWorkflowAdmin={perms.isWorkflowAdmin}
                />
                {perms.isWorkflowAdmin && (
                  <WorkflowAdminPanel
                    actions={actions.loading ? [] : actions.data}
                    caseId={id}
                    onDone={handleTransitionDone}
                    isWorkflowAdmin={perms.isWorkflowAdmin}
                    pendingPreAuthCount={preAuths.data.filter(isPendingPreAuth).length}
                  />
                )}
              </div>

              {/* Compact patient + insurance summary — single column, no truncation issues */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-white">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Patient &amp; Insurance</p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <SidebarField label="MRN / UHID"    value={patientMrn ?? undefined} />
                  <SidebarField label="Policy No."    value={sidebarPolicyNo ?? (case_ as { policyNumber?: string }).policyNumber} />
                  <SidebarField label="Membership"    value={sidebarMembership ?? (case_ as { membershipNumber?: string }).membershipNumber} />
                  <SidebarField label="Payer Type"    value={case_.payerType} />
                  <SidebarField label="Urgency"       value={case_.urgencyLevel} />
                  {case_.surgeryDate && (
                    <SidebarField label="Surgery"     value={new Date(case_.surgeryDate as string).toLocaleDateString('en-IN')} />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {sendPreAuthTarget && case_ && (
        <PreAuthEmailComposer
          case_={case_}
          auth={sendPreAuthTarget}
          draft={draftSnapshot}
          comms={communications.data}
          primaryPolicy={primaryPolicyForPrefill}
          payers={payerMaster}
          tpas={tpaMaster}
          intakeDocuments={caseDocuments}
          intakeDocumentsLoading={caseDocumentsLoading}
          modal
          open={!!sendPreAuthTarget}
          onClose={() => setSendPreAuthTarget(null)}
          onSent={() => { setSendPreAuthTarget(null); void refreshAfterAction('authorization', ['case', 'preAuths', 'communications', 'workflow']); }}
        />
      )}
      {tpaResponseTarget && (
        <TpaResponseModal
          auth={tpaResponseTarget}
          case_={case_}
          draft={draftSnapshot}
          prefill={tpaResponsePrefill}
          open={!!tpaResponseTarget}
          onClose={() => { setTpaResponseTarget(null); setTpaResponsePrefill(null); }}
          onSaved={() => {
            setTpaResponseTarget(null);
            setTpaResponsePrefill(null);
            void refreshAfterAction('billing', ['case', 'preAuths', 'billing', 'workflow']);
          }}
        />
      )}
      {showAllocateModal && case_ && (
        <AllocateBillModal caseId={case_.id}
          approvedAmount={preAuths.data.find(p => p.approvedAmount > 0)?.approvedAmount ?? preAuths.data[0]?.requestedAmount ?? 0}
          open={showAllocateModal} onClose={() => setShowAllocateModal(false)}
          onAllocated={() => { setShowAllocateModal(false); void refreshAfterAction('claims', ['case', 'billing', 'claims', 'workflow']); }} />
      )}
      {showGenerateClaim && case_ && (
        <GenerateClaimModal caseId={case_.id} billedAmount={billingFull.data?.summary?.totalBillAmount ?? 0}
          approvedAmount={preAuths.data.find(p => p.approvedAmount > 0)?.approvedAmount ?? 0}
          open={showGenerateClaim} onClose={() => setShowGenerateClaim(false)}
          onUpdated={() => { setShowGenerateClaim(false); void refreshAfterAction('claims', ['case', 'claims', 'workflow']); }} />
      )}
      {showRecordSettlement && case_ && (
        <RecordSettlementModal caseId={case_.id} claimAmount={claims.data[0]?.claimedAmount ?? 0}
          alreadySettled={settlements.data.reduce((s, x) => s + x.settledAmount, 0)} claimPacketId={claims.data[0]?.id}
          open={showRecordSettlement} onClose={() => setShowRecordSettlement(false)}
          onRecorded={() => { setShowRecordSettlement(false); void refreshAfterAction('settlement', ['case', 'settlements', 'workflow']); }} />
      )}
      {showReconcile && case_ && (
        <ReconcileCaseModal caseId={case_.id} caseNumber={case_.caseNumber ?? case_.id}
          totalClaimed={claims.data[0]?.claimedAmount ?? 0} totalSettled={settlements.data.reduce((s, x) => s + x.settledAmount, 0)}
          open={showReconcile} onClose={() => setShowReconcile(false)}
          onReconciled={() => { setShowReconcile(false); void refreshAfterAction('settlement', ['case', 'settlements', 'workflow']); }} />
      )}
      {showCloseCase && case_ && (
        <CloseCaseModal caseId={case_.id} caseNumber={case_.caseNumber ?? case_.id}
          open={showCloseCase} onClose={() => setShowCloseCase(false)}
          onClosed={() => { setShowCloseCase(false); void refreshAfterAction(undefined, ['case', 'workflow']); }} />
      )}
      {showEligibility && case_ && (
        <EligibilityModal
          caseId={case_.id}
          policyNumber={draftSnapshot?.policyNumber ?? policies.data.find(p => p.isPrimary)?.policyNumber}
          open={showEligibility}
          onClose={() => setShowEligibility(false)}
          onVerified={() => { setShowEligibility(false); void refreshAfterAction('overview', ['case', 'eligibility', 'policies', 'workflow']); }}
        />
      )}
    </div>
  );
}
