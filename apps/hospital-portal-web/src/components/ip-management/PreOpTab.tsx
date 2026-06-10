'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Activity,
  Send,
  MessageSquare,
  CheckCheck,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  ipManagementApi,
  PreOpClearanceDetailDto,
  PreOpCompletionDto,
  PreOpSectionClearanceDto,
  RespondToSectionRequest,
  WardDto,
  PutSectionOnHoldRequest,
  RejectSectionRequest,
  RequestMoreInfoRequest,
  EscalateSectionRequest,
  UploadPreOpDocumentRequest,
} from '@/lib/api/ip-management.api';
import { useAuthStore } from '@/lib/auth-store';
import { useMasterValues } from '@/hooks/use-master-values';
import { useMasterListOptions } from '@/hooks/use-master-list-options';

const FALLBACK_ADMISSION_TYPES = ['DayCare', 'IPD', 'Emergency'];

// ─── Category display labels ──────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  Compliance:            'Pre-Op Compliance',
  Vitals:                'Pre-Op Vitals',
  'Lab Tests':           'Lab Tests',
  'Diagnostic Imaging':  'Diagnostic Imaging',
  Evaluation:            'Clinical Evaluation',
  Anaesthesia:           'Anaesthesia Clearance',
  Consent:               'Consent Forms',
  'Pharmacy Preparation':'Pharmacy Preparation',
  Financial:             'Financial Clearance',
  'OT Preparation':      'OT Preparation',
  Documents:             'Required Documents',
  // Legacy alias kept for existing DB rows
  Investigations:        'Investigations & Lab Tests',
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

// ─── Props ────────────────────────────────────────────────────────────────────

interface PreOpTabProps {
  journeyId: string;
  clinicalState: string;
  paymentMode?: string;
  branchId?: string;
  isLocked?: boolean;
  /** Current user's department code — used to show dept-specific action buttons */
  currentUserDeptCode?: string;
  /** When provided an "Admit Patient" button appears at the bottom. */
  onAdmitSuccess?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PreOpTab({
  journeyId,
  clinicalState,
  paymentMode,
  branchId: branchIdProp,
  isLocked,
  currentUserDeptCode,
  onAdmitSuccess,
}: PreOpTabProps) {
  const { user } = useAuthStore();
  const { options: admissionTypeOptions } = useMasterValues('ward.admission_type');
  const admissionTypes = admissionTypeOptions.length > 0
    ? admissionTypeOptions.map((o) => o.label)
    : FALLBACK_ADMISSION_TYPES;
  const branchId = branchIdProp ?? user?.branchId;
  const isReadOnly =
    (isLocked ?? false) || clinicalState === 'Discharged';

  const [detail, setDetail] = useState<PreOpClearanceDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null); // itemId or "bypass-{itemId}"

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(CATEGORY_ORDER),
  );

  // Dept section clearance actions
  const [sectionActing, setSectionActing] = useState<string | null>(null); // category being acted on
  const [respondModal, setRespondModal] = useState<{ category: string; isExternal?: boolean } | null>(null);
  const [confirmModal, setConfirmModal] = useState<string | null>(null); // category
  const [holdModal, setHoldModal]       = useState<string | null>(null); // category
  const [rejectModal, setRejectModal]   = useState<string | null>(null); // category
  const [needsInfoModal, setNeedsInfoModal] = useState<string | null>(null); // category
  const [escalateModal, setEscalateModal]   = useState<string | null>(null); // category

  // Bypass reason modal
  const [bypassModal, setBypassModal] = useState<{ completion: PreOpCompletionDto } | null>(null);

  // Document upload
  const [docUploadItem, setDocUploadItem] = useState<{ completion: PreOpCompletionDto } | null>(null);

  // Admit form
  const [wards, setWards] = useState<WardDto[]>([]);
  const [showAdmitForm, setShowAdmitForm] = useState(false);
  const [admitForm, setAdmitForm] = useState({
    wardId: '',
    admissionType: 'IPD',
    bedNumber: '',
    clearanceNotes: '',
    isEmergency: false,
    emergencyReason: '',
  });
  const [admitting, setAdmitting] = useState(false);
  const [admitError, setAdmitError] = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadClearance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const init = await ipManagementApi.initPreOpClearance(journeyId, {
        paymentModeSnapshot: paymentMode,
      });
      const initError = (init as any)?.error as string | undefined;
      if (!init || initError) {
        setError(initError ?? 'Could not initialise pre-op clearance. Check the IP Management service is running.');
        return;
      }
      const data = await ipManagementApi.getPreOpClearance(journeyId);
      const dataError = (data as any)?.error as string | undefined;
      if (!data || dataError) {
        setError(dataError ?? 'Could not load pre-op clearance. Check the IP Management service is running.');
        return;
      }
      setDetail(data);
    } catch {
      setError('Failed to load pre-op checklist. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [journeyId, paymentMode]);

  useEffect(() => {
    loadClearance();
  }, [loadClearance]);

  useEffect(() => {
    if (onAdmitSuccess && branchId) {
      ipManagementApi.listWards({ branchId }).then(w => setWards(w));
    }
  }, [onAdmitSuccess, branchId]);

  // ── Item toggles ──────────────────────────────────────────────────────────

  async function handleToggleCompleted(completion: PreOpCompletionDto) {
    if (isReadOnly || saving) return;
    setSaving(completion.itemId);
    try {
      await ipManagementApi.savePreOpCompletion(journeyId, completion.itemId, {
        itemId: completion.itemId,
        isCompleted: !completion.isCompleted,
        isBypassed: false,
        notes: completion.notes ?? undefined,
      });
      const updated = await ipManagementApi.getPreOpClearance(journeyId);
      setDetail(updated);
    } finally {
      setSaving(null);
    }
  }

  async function handleToggleBypassed(completion: PreOpCompletionDto) {
    if (isReadOnly || saving) return;
    if (completion.isBypassed) {
      // Removing bypass — no reason needed
      setSaving(`bypass-${completion.itemId}`);
      try {
        await ipManagementApi.savePreOpCompletion(journeyId, completion.itemId, {
          itemId: completion.itemId,
          isCompleted: completion.isCompleted,
          isBypassed: false,
          notes: completion.notes ?? undefined,
        });
        const updated = await ipManagementApi.getPreOpClearance(journeyId);
        setDetail(updated);
      } finally {
        setSaving(null);
      }
    } else {
      // Setting bypass — require documented reason
      setBypassModal({ completion });
    }
  }

  async function handleBypassWithReason(completion: PreOpCompletionDto, reason: string) {
    setBypassModal(null);
    setSaving(`bypass-${completion.itemId}`);
    try {
      await ipManagementApi.savePreOpCompletion(journeyId, completion.itemId, {
        itemId: completion.itemId,
        isCompleted: completion.isCompleted,
        isBypassed: true,
        bypassReason: reason,
        notes: completion.notes ?? undefined,
      });
      const updated = await ipManagementApi.getPreOpClearance(journeyId);
      setDetail(updated);
    } finally {
      setSaving(null);
    }
  }

  // ── Document upload ───────────────────────────────────────────────────────

  function categoryToDocType(category: string): UploadPreOpDocumentRequest['documentType'] {
    switch (category) {
      case 'Consent':            return 'ConsentForm';
      case 'Lab Tests':          return 'LabReport';
      case 'Investigations':     return 'LabReport';
      case 'Diagnostic Imaging': return 'ImagingReport';
      case 'Financial':          return 'InsuranceDoc';
      default:                   return 'Other';
    }
  }

  async function handleDocUpload(file: File) {
    if (!docUploadItem) return;
    const completion = docUploadItem.completion;
    setDocUploadItem(null);
    setSaving(`doc-${completion.itemId}`);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await ipManagementApi.uploadPreOpDocument(journeyId, {
        documentType: categoryToDocType(completion.category),
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileData: base64,
      });
      const updated = await ipManagementApi.getPreOpClearance(journeyId);
      setDetail(updated);
    } finally {
      setSaving(null);
    }
  }

  // ── Admit ─────────────────────────────────────────────────────────────────

  async function handleAdmit() {
    if (!admitForm.wardId) {
      setAdmitError('Please select a ward.');
      return;
    }
    if (admitForm.isEmergency && !admitForm.emergencyReason.trim()) {
      setAdmitError('Emergency reason is required when bypassing pre-op.');
      return;
    }
    setAdmitError('');
    setAdmitting(true);
    try {
      await ipManagementApi.approvePreOpClearance(journeyId, {
        wardId: admitForm.wardId,
        admissionType: admitForm.admissionType,
        bedNumber: admitForm.bedNumber || undefined,
        clearanceNotes: admitForm.clearanceNotes || undefined,
        isEmergency: admitForm.isEmergency,
        emergencyReason: admitForm.isEmergency ? admitForm.emergencyReason : undefined,
      });
      onAdmitSuccess?.();
    } catch {
      setAdmitError(
        'Admission failed. Check that all required items are complete and try again.',
      );
    } finally {
      setAdmitting(false);
    }
  }

  // ── Section clearance helpers ─────────────────────────────────────────────

  function getSectionClearance(category: string): PreOpSectionClearanceDto | undefined {
    return (detail?.sectionClearances ?? []).find(s => s.sectionCategory === category);
  }

  async function handleRequestSection(category: string) {
    setSectionActing(category);
    try {
      const updated = await ipManagementApi.requestSection(journeyId, category);
      if (updated) {
        setDetail(prev => prev ? {
          ...prev,
          sectionClearances: [
            ...(prev.sectionClearances ?? []).filter(s => s.sectionCategory !== category),
            updated,
          ],
        } : prev);
      }
    } finally {
      setSectionActing(null);
    }
  }

  async function handleConfirmSection(category: string, notes: string) {
    setSectionActing(category);
    try {
      const updated = await ipManagementApi.confirmSection(journeyId, category, { confirmationNotes: notes || undefined });
      if (updated) {
        setDetail(prev => prev ? {
          ...prev,
          sectionClearances: [
            ...(prev.sectionClearances ?? []).filter(s => s.sectionCategory !== category),
            updated,
          ],
        } : prev);
      }
    } finally {
      setSectionActing(null);
      setConfirmModal(null);
    }
  }

  async function handleHoldSection(category: string, req: PutSectionOnHoldRequest) {
    setSectionActing(category);
    try {
      const updated = await ipManagementApi.putSectionOnHold(journeyId, category, req);
      if (updated) {
        setDetail(prev => prev ? {
          ...prev,
          sectionClearances: [
            ...(prev.sectionClearances ?? []).filter(s => s.sectionCategory !== category),
            updated,
          ],
        } : prev);
      }
    } finally {
      setSectionActing(null);
      setHoldModal(null);
    }
  }

  async function handleRejectSection(category: string, req: RejectSectionRequest) {
    setSectionActing(category);
    try {
      const updated = await ipManagementApi.rejectSection(journeyId, category, req);
      if (updated) {
        setDetail(prev => prev ? {
          ...prev,
          sectionClearances: [
            ...(prev.sectionClearances ?? []).filter(s => s.sectionCategory !== category),
            updated,
          ],
        } : prev);
      }
    } finally {
      setSectionActing(null);
      setRejectModal(null);
    }
  }

  async function handleNeedsInfoSection(category: string, req: RequestMoreInfoRequest) {
    setSectionActing(category);
    try {
      const updated = await ipManagementApi.requestMoreInfo(journeyId, category, req);
      if (updated) {
        setDetail(prev => prev ? {
          ...prev,
          sectionClearances: [
            ...(prev.sectionClearances ?? []).filter(s => s.sectionCategory !== category),
            updated,
          ],
        } : prev);
      }
    } finally {
      setSectionActing(null);
      setNeedsInfoModal(null);
    }
  }

  async function handleEscalateSection(category: string, req: EscalateSectionRequest) {
    setSectionActing(category);
    try {
      const updated = await ipManagementApi.escalateSection(journeyId, category, req);
      if (updated) {
        setDetail(prev => prev ? {
          ...prev,
          sectionClearances: [
            ...(prev.sectionClearances ?? []).filter(s => s.sectionCategory !== category),
            updated,
          ],
        } : prev);
      }
    } finally {
      setSectionActing(null);
      setEscalateModal(null);
    }
  }

  async function handleRespondSection(
    category: string,
    req: RespondToSectionRequest,
  ) {
    setSectionActing(category);
    try {
      const updated = await ipManagementApi.respondToSection(journeyId, category, req);
      if (updated) {
        setDetail(prev => prev ? {
          ...prev,
          sectionClearances: [
            ...(prev.sectionClearances ?? []).filter(s => s.sectionCategory !== category),
            updated,
          ],
        } : prev);
      }
    } finally {
      setSectionActing(null);
      setRespondModal(null);
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-500">Loading Pre-Op Checklist…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={loadClearance}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="h-8 w-8 text-amber-400" />
        <p className="text-sm text-gray-500">No checklist data available.</p>
        <button
          onClick={loadClearance}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Group completions by category ─────────────────────────────────────────

  const grouped = (detail.completions ?? []).reduce<Record<string, PreOpCompletionDto[]>>(
    (acc, c) => {
      if (!acc[c.category]) acc[c.category] = [];
      acc[c.category].push(c);
      return acc;
    },
    {},
  );

  const categories = Object.keys(grouped).sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
  );

  const pct =
    detail.totalItems > 0
      ? Math.round((detail.completedItems / detail.totalItems) * 100)
      : 0;

  // Section status badge helpers
  const SECTION_STATUS_COLORS: Record<string, string> = {
    NotRequested:      'bg-gray-100 text-gray-500',
    Requested:         'bg-yellow-100 text-yellow-700',
    RespondedClear:    'bg-green-100 text-green-700',
    RespondedConcerns: 'bg-red-100 text-red-700',
    WardConfirmed:     'bg-emerald-100 text-emerald-700',
    OnHold:            'bg-amber-100 text-amber-700',
    Rejected:          'bg-red-200 text-red-800',
    NeedsInfo:         'bg-purple-100 text-purple-700',
    Escalated:         'bg-orange-100 text-orange-700',
  };
  const SECTION_STATUS_LABELS: Record<string, string> = {
    NotRequested:      'Not Requested',
    Requested:         'Awaiting Response',
    RespondedClear:    'Cleared',
    RespondedConcerns: 'Concerns Raised',
    WardConfirmed:     'Confirmed',
    OnHold:            'On Hold',
    Rejected:          'Rejected',
    NeedsInfo:         'Needs Info',
    Escalated:         'Escalated',
  };

  function SectionDeptActions({ category }: { category: string }) {
    const sc = getSectionClearance(category);
    const status = sc?.status ?? 'NotRequested';
    const isAnaesthesia = category === 'Anaesthesia';
    const isActing = sectionActing === category;
    const userIsDeptResponder = !!(currentUserDeptCode && sc?.responsibleDepartmentCode === currentUserDeptCode);

    if (isReadOnly) {
      return (
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${SECTION_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}>
          {SECTION_STATUS_LABELS[status] ?? status}
        </span>
      );
    }

    return (
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SECTION_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}>
          {SECTION_STATUS_LABELS[status] ?? status}
        </span>

        {/* Ward staff: Request → (NotRequested, or re-request after Rejected/NeedsInfo) */}
        {(status === 'NotRequested' || status === 'Rejected' || status === 'NeedsInfo') && (
          <button
            type="button"
            disabled={isActing}
            onClick={() => handleRequestSection(category)}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-full hover:bg-blue-100 disabled:opacity-50"
          >
            {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            {status === 'NeedsInfo' ? 'Re-Request' : status === 'Rejected' ? 'Appeal' : 'Request'}
          </button>
        )}

        {/* Dept user: action buttons for active states */}
        {userIsDeptResponder && status === 'Requested' && (
          <>
            <button type="button" onClick={() => setRespondModal({ category })}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-200 rounded-full hover:bg-orange-100">
              <MessageSquare className="h-3 w-3" /> Respond
            </button>
            <button type="button" onClick={() => setHoldModal(category)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full hover:bg-amber-100">
              On Hold
            </button>
            <button type="button" onClick={() => setRejectModal(category)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 rounded-full hover:bg-red-100">
              Reject
            </button>
            <button type="button" onClick={() => setNeedsInfoModal(category)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-full hover:bg-purple-100">
              Needs Info
            </button>
          </>
        )}

        {/* Dept user or ward: escalate from OnHold/Requested */}
        {(status === 'OnHold' || (userIsDeptResponder && status === 'Escalated')) && (
          <>
            {userIsDeptResponder && (
              <button type="button" onClick={() => setRespondModal({ category })}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-200 rounded-full hover:bg-orange-100">
                <MessageSquare className="h-3 w-3" /> Respond
              </button>
            )}
            <button type="button" onClick={() => setEscalateModal(category)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-200 rounded-full hover:bg-orange-100">
              Escalate
            </button>
          </>
        )}

        {/* Anaesthesia external logging */}
        {isAnaesthesia && (status === 'Requested' || status === 'NotRequested') && (
          <button
            type="button"
            onClick={() => setRespondModal({ category, isExternal: true })}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-full hover:bg-purple-100"
          >
            <UserCheck className="h-3 w-3" />
            Log External
          </button>
        )}

        {/* Ward staff: Confirm after dept responded */}
        {(status === 'RespondedClear' || status === 'RespondedConcerns') && (
          <button
            type="button"
            disabled={isActing}
            onClick={() => setConfirmModal(category)}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full hover:bg-emerald-100 disabled:opacity-50"
          >
            {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
            Confirm
          </button>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Status banner ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Activity className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              {detail.completedItems}/{detail.totalItems} items completed
              {detail.blockingIncomplete > 0 && (
                <span className="ml-2 text-xs font-normal text-red-600">
                  · {detail.blockingIncomplete} required{' '}
                  {detail.blockingIncomplete === 1 ? 'item' : 'items'} remaining
                </span>
              )}
            </p>
            {/* Progress bar */}
            <div className="mt-1.5 h-1.5 w-full max-w-xs bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
            detail.readyToAdmit
              ? 'bg-green-100 text-green-700'
              : detail.clearance?.overallStatus === 'Deferred'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-100 text-blue-700'
          }`}
        >
          {detail.readyToAdmit ? '✓ Ready to Admit' : (detail.clearance?.overallStatus ?? 'In Progress')}
        </span>
      </div>

      {/* ── Read-only notice ─────────────────────────────────────────────── */}
      {isReadOnly && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Pre-op clearance is read-only — patient has already been admitted.
        </div>
      )}

      {/* ── Section accordions ───────────────────────────────────────────── */}
      {categories.map(cat => {
        const items = grouped[cat];
        const label = CATEGORY_LABELS[cat] ?? cat.replace(/_/g, ' ');
        const catCompleted = items.filter(c => c.isCompleted || c.isBypassed).length;
        const catBlocking = items.filter(
          c => c.isBlocking && !c.isCompleted && !c.isBypassed,
        ).length;
        const isExpanded = expandedSections.has(cat);

        return (
          <div
            key={cat}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden"
          >
            {/* Section header */}
            <div className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors gap-2">
              <button
                type="button"
                onClick={() =>
                  setExpandedSections(prev => {
                    const next = new Set(prev);
                    if (next.has(cat)) next.delete(cat);
                    else next.add(cat);
                    return next;
                  })
                }
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                <span className="text-sm font-semibold text-gray-800 truncate">{label}</span>
                {catBlocking > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                    <AlertCircle className="h-3 w-3" /> {catBlocking} required
                  </span>
                )}
              </button>
              {/* Dept coordination actions */}
              <SectionDeptActions category={cat} />
              <div className="flex items-center gap-2 ml-1 shrink-0">
                <span className="text-xs text-gray-500">
                  {catCompleted}/{items.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSections(prev => {
                      const next = new Set(prev);
                      if (next.has(cat)) next.delete(cat);
                      else next.add(cat);
                      return next;
                    })
                  }
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Section items */}
            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {items.map(completion => {
                  const isSavingItem = saving === completion.itemId;
                  const isSavingBypass = saving === `bypass-${completion.itemId}`;
                  const isDone = completion.isCompleted || completion.isBypassed;

                  return (
                    <div
                      key={completion.itemId}
                      className={`px-4 py-3 flex items-start gap-3 transition-colors ${isDone ? 'bg-green-50/40' : ''}`}
                    >
                      {/* Complete checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleCompleted(completion)}
                        disabled={isReadOnly || !!saving}
                        className="mt-0.5 shrink-0 disabled:cursor-default"
                      >
                        {isSavingItem ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        ) : completion.isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-300 hover:text-gray-400" />
                        )}
                      </button>

                      {/* Label + badges */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-medium ${
                              completion.isCompleted
                                ? 'line-through text-gray-400'
                                : 'text-gray-800'
                            }`}
                          >
                            {completion.itemLabel}
                          </span>
                          {completion.isBlocking && (
                            <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded font-semibold">
                              Required
                            </span>
                          )}
                          {completion.requiresDocument && (
                            saving === `doc-${completion.itemId}` ? (
                              <span className="text-[10px] bg-blue-50 text-blue-500 border border-blue-100 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                              </span>
                            ) : completion.documentId ? (
                              <span className="text-[10px] bg-green-50 text-green-600 border border-green-100 px-1.5 py-0.5 rounded font-medium">
                                ✓ Doc uploaded
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={!!saving || isReadOnly}
                                onClick={() => setDocUploadItem({ completion })}
                                className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded font-medium hover:bg-blue-100 disabled:opacity-50"
                              >
                                Upload Doc
                              </button>
                            )
                          )}
                        </div>
                        {completion.notes && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {completion.notes}
                          </p>
                        )}
                        {completion.isBypassed && (
                          <p className="text-xs text-amber-600 mt-0.5 italic">
                            Waived
                            {completion.bypassReason
                              ? `: ${completion.bypassReason}`
                              : ''}
                          </p>
                        )}
                      </div>

                      {/* Bypass toggle */}
                      {!isReadOnly && !completion.isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleToggleBypassed(completion)}
                          disabled={!!saving}
                          title={
                            completion.isBypassed
                              ? 'Remove waiver'
                              : 'Mark as waived / bypassed'
                          }
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors disabled:cursor-not-allowed border ${
                            completion.isBypassed
                              ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                              : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-amber-50 hover:text-amber-500 hover:border-amber-200'
                          }`}
                        >
                          {isSavingBypass ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : completion.isBypassed ? (
                            'Waived'
                          ) : (
                            'Waive'
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Admit panel (only when callback provided and not read-only) ─── */}
      {onAdmitSuccess && !isReadOnly && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          {/* Rejection warning: show if any section was rejected */}
          {(detail?.sectionClearances ?? []).filter(s => s.status === 'Rejected').length > 0 && (
            <div className="flex items-start gap-2 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-3">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-700">Rejected sections require attention</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {(detail?.sectionClearances ?? []).filter(s => s.status === 'Rejected').map(s => CATEGORY_LABELS[s.sectionCategory] ?? s.sectionCategory).join(', ')}
                  {' — re-request or enable emergency admit to proceed.'}
                </p>
              </div>
            </div>
          )}
          {!showAdmitForm ? (
            <button
              type="button"
              onClick={() => setShowAdmitForm(true)}
              disabled={!detail.readyToAdmit && !admitForm.isEmergency}
              className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {detail.readyToAdmit
                ? 'Proceed to Admit Patient →'
                : `${detail.blockingIncomplete} required item(s) still incomplete`}
            </button>
          ) : (
            <>
              <h4 className="text-sm font-semibold text-gray-800">
                Confirm Admission Details
              </h4>

              {admitError && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {admitError}
                </p>
              )}

              {/* Emergency override toggle */}
              <div className={`rounded-xl border px-4 py-3 space-y-2 ${admitForm.isEmergency ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setAdmitForm(f => ({ ...f, isEmergency: !f.isEmergency, emergencyReason: '' }))}
                    className={`relative w-9 h-5 rounded-full transition-colors ${admitForm.isEmergency ? 'bg-red-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${admitForm.isEmergency ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <ShieldAlert className={`h-4 w-4 ${admitForm.isEmergency ? 'text-red-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${admitForm.isEmergency ? 'text-red-700' : 'text-gray-600'}`}>
                    Emergency Admit — Bypass Pre-Op Checklist
                  </span>
                </label>
                {admitForm.isEmergency && (
                  <div>
                    <label className="block text-xs font-medium text-red-700 mb-1">
                      Emergency Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={admitForm.emergencyReason}
                      onChange={e => setAdmitForm(f => ({ ...f, emergencyReason: e.target.value }))}
                      placeholder="Document why pre-op checklist is being bypassed…"
                      className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Ward <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={admitForm.wardId}
                    onChange={e =>
                      setAdmitForm(f => ({ ...f, wardId: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">— Select Ward —</option>
                    {wards.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.wardName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Admission Type
                  </label>
                  <select
                    value={admitForm.admissionType}
                    onChange={e =>
                      setAdmitForm(f => ({ ...f, admissionType: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {admissionTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Room / Bed Number
                  </label>
                  <input
                    type="text"
                    value={admitForm.bedNumber}
                    onChange={e =>
                      setAdmitForm(f => ({ ...f, bedNumber: e.target.value }))
                    }
                    placeholder="e.g. Room 4 – Bed B"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Clearance Notes
                  </label>
                  <input
                    type="text"
                    value={admitForm.clearanceNotes}
                    onChange={e =>
                      setAdmitForm(f => ({ ...f, clearanceNotes: e.target.value }))
                    }
                    placeholder="Optional"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdmitForm(false);
                    setAdmitError('');
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleAdmit}
                  disabled={admitting || !admitForm.wardId}
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${admitForm.isEmergency ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {admitting ? 'Admitting…' : admitForm.isEmergency ? '⚡ Emergency Admit' : '✓ Confirm Admission'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Respond to section modal (inline) ───────────────────────────── */}
      {respondModal && (
        <RespondSectionInlineModal
          category={respondModal.category}
          isExternal={respondModal.isExternal}
          onClose={() => setRespondModal(null)}
          onSubmit={(req) => handleRespondSection(respondModal.category, req)}
          saving={sectionActing === respondModal.category}
        />
      )}

      {/* ── Confirm section modal (inline) ──────────────────────────────── */}
      {confirmModal && (
        <ConfirmSectionInlineModal
          category={confirmModal}
          sectionClearance={getSectionClearance(confirmModal)}
          onClose={() => setConfirmModal(null)}
          onSubmit={(notes) => handleConfirmSection(confirmModal, notes)}
          saving={sectionActing === confirmModal}
        />
      )}

      {/* ── On-Hold modal ────────────────────────────────────────────────── */}
      {holdModal && (
        <SimpleReasonModal
          title={`Put ${CATEGORY_LABELS[holdModal] ?? holdModal} On Hold`}
          label="Reason for hold"
          placeholder="e.g. Equipment unavailable, awaiting results…"
          confirmLabel="Put On Hold"
          confirmClass="bg-amber-600 hover:bg-amber-700"
          onClose={() => setHoldModal(null)}
          onSubmit={(reason) => handleHoldSection(holdModal, { reason })}
          saving={sectionActing === holdModal}
        />
      )}

      {/* ── Reject modal ─────────────────────────────────────────────────── */}
      {rejectModal && (
        <SimpleReasonModal
          title={`Reject ${CATEGORY_LABELS[rejectModal] ?? rejectModal}`}
          label="Rejection reason"
          placeholder="Document the clinical reason for rejection…"
          confirmLabel="Confirm Rejection"
          confirmClass="bg-red-600 hover:bg-red-700"
          onClose={() => setRejectModal(null)}
          onSubmit={(reason) => handleRejectSection(rejectModal, { rejectionReason: reason })}
          saving={sectionActing === rejectModal}
          required
        />
      )}

      {/* ── NeedsInfo modal ──────────────────────────────────────────────── */}
      {needsInfoModal && (
        <SimpleReasonModal
          title={`Request More Info: ${CATEGORY_LABELS[needsInfoModal] ?? needsInfoModal}`}
          label="Information needed"
          placeholder="Specify what information or documents are required from the ward…"
          confirmLabel="Send Request"
          confirmClass="bg-purple-600 hover:bg-purple-700"
          onClose={() => setNeedsInfoModal(null)}
          onSubmit={(info) => handleNeedsInfoSection(needsInfoModal, { infoNeeded: info })}
          saving={sectionActing === needsInfoModal}
          required
        />
      )}

      {/* ── Escalate modal ───────────────────────────────────────────────── */}
      {escalateModal && (
        <SimpleReasonModal
          title={`Escalate ${CATEGORY_LABELS[escalateModal] ?? escalateModal}`}
          label="Escalation reason"
          placeholder="Why is this being escalated? Who is being notified?"
          confirmLabel="Escalate"
          confirmClass="bg-orange-600 hover:bg-orange-700"
          onClose={() => setEscalateModal(null)}
          onSubmit={(reason) => handleEscalateSection(escalateModal, { reason, urgency: 'High' })}
          saving={sectionActing === escalateModal}
          required
        />
      )}

      {/* ── Bypass reason modal ──────────────────────────────────────────── */}
      {bypassModal && (
        <SimpleReasonModal
          title={`Waive / Bypass: ${bypassModal.completion.itemLabel}`}
          label="Reason for bypass (mandatory)"
          placeholder="Document the clinical or operational reason for bypassing this requirement…"
          confirmLabel="Confirm Waiver"
          confirmClass="bg-amber-600 hover:bg-amber-700"
          onClose={() => setBypassModal(null)}
          onSubmit={(reason) => handleBypassWithReason(bypassModal.completion, reason)}
          saving={saving === `bypass-${bypassModal.completion.itemId}`}
          required
        />
      )}

      {/* ── Document upload modal ──────────────────────────────────────── */}
      {docUploadItem && (
        <DocUploadModal
          completion={docUploadItem.completion}
          onClose={() => setDocUploadItem(null)}
          onUpload={handleDocUpload}
        />
      )}
    </div>
  );
}

// ─── Respond Section Inline Modal ────────────────────────────────────────────

const PREOP_CLEARANCE_FALLBACK = [
  'Fit for Local Anesthesia',
  'Fit for General Anesthesia',
  'Conditional Clearance',
  'Deferred - Pending Tests',
  'Not Fit for Surgery',
] as const;

function RespondSectionInlineModal({ category, isExternal, onClose, onSubmit, saving }: {
  category: string;
  isExternal?: boolean;
  onClose: () => void;
  onSubmit: (req: RespondToSectionRequest) => void;
  saving: boolean;
}) {
  const isAnaesthesia = category === 'Anaesthesia';
  const { labels: clearanceLabels } = useMasterListOptions(
    'clinical.preop_clearance',
    PREOP_CLEARANCE_FALLBACK,
  );
  const [status, setStatus] = useState<'RespondedClear' | 'RespondedConcerns'>('RespondedClear');
  const [clearanceType, setClearanceType] = useState('');
  const [notes, setNotes] = useState('');
  const [extName, setExtName] = useState('');
  const [extContact, setExtContact] = useState('');

  const label = CATEGORY_LABELS[category] ?? category;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isExternal ? 'Log External Response' : 'Respond to Section'}: {label}
            </h2>
            {isExternal && (
              <p className="text-xs text-gray-500 mt-0.5">For visiting / external anaesthesiologists</p>
            )}
          </div>
        </div>
        <div className="px-6 py-4 space-y-4">
          {isExternal && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Anaesthesiologist Name <span className="text-red-500">*</span></label>
                <input value={extName} onChange={e => setExtName(e.target.value)} placeholder="Dr. Name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contact / Phone</label>
                <input value={extContact} onChange={e => setExtContact(e.target.value)} placeholder="e.g. +91 98765 43210"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Clearance Status</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStatus('RespondedClear')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${status === 'RespondedClear' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-green-50'}`}>
                ✓ Clear
              </button>
              <button type="button" onClick={() => setStatus('RespondedConcerns')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${status === 'RespondedConcerns' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-red-50'}`}>
                ⚠ Concerns
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder={status === 'RespondedConcerns' ? 'Describe the concerns raised…' : 'Optional notes…'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="button" disabled={saving || (isExternal && !extName.trim())} onClick={() => {
            const clearancePrefix = clearanceType ? `Clearance: ${clearanceType}. ` : '';
            const combinedNotes = `${clearancePrefix}${notes}`.trim() || undefined;
            onSubmit({
              responseStatus: status,
              responseNotes: combinedNotes,
              isExternalResponder: isExternal,
              externalResponderName: isExternal ? extName : undefined,
              externalResponderContact: isExternal ? extContact : undefined,
            });
          }}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${status === 'RespondedConcerns' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
            {saving ? 'Submitting…' : 'Submit Response'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Section Inline Modal ─────────────────────────────────────────────

function ConfirmSectionInlineModal({ category, sectionClearance, onClose, onSubmit, saving }: {
  category: string;
  sectionClearance?: PreOpSectionClearanceDto;
  onClose: () => void;
  onSubmit: (notes: string) => void;
  saving: boolean;
}) {
  const [notes, setNotes] = useState('');
  const label = CATEGORY_LABELS[category] ?? category;
  const isConcerns = sectionClearance?.status === 'RespondedConcerns';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Ward Confirm: {label}</h2>
        </div>
        <div className="px-6 py-4 space-y-3">
          {sectionClearance?.responseNotes && (
            <div className={`rounded-xl p-3 text-sm ${isConcerns ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
              <p className="font-medium text-xs mb-1">{isConcerns ? '⚠ Dept raised concerns:' : '✓ Dept response:'}</p>
              {sectionClearance.responseNotes}
              {sectionClearance.isExternalResponder && sectionClearance.externalResponderName && (
                <p className="text-xs mt-1 opacity-70">Responded by: {sectionClearance.externalResponderName} (External)</p>
              )}
            </div>
          )}
          {isConcerns && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              You are confirming despite concerns raised. Document your clinical decision below.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirmation Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Add any ward-side confirmation notes…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="button" disabled={saving} onClick={() => onSubmit(notes)}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
            {saving ? 'Confirming…' : '✓ Ward Confirmed'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SimpleReasonModal ────────────────────────────────────────────────────────
// Generic single-textarea modal used for hold, reject, needs-info, escalate, bypass.

function SimpleReasonModal({ title, label, placeholder, confirmLabel, confirmClass, onClose, onSubmit, saving, required }: {
  title: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  confirmClass: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
  saving: boolean;
  required?: boolean;
}) {
  const [value, setValue] = useState('');
  const canSubmit = !saving && (!required || value.trim().length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="px-6 py-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            rows={4}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 px-6 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(value.trim())}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${confirmClass}`}
          >
            {saving ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DocUploadModal ───────────────────────────────────────────────────────────

function DocUploadModal({ completion, onClose, onUpload }: {
  completion: PreOpCompletionDto;
  onClose: () => void;
  onUpload: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Upload Document</h2>
          <p className="text-xs text-gray-500 mt-0.5">{completion.itemLabel}</p>
        </div>
        <div className="px-6 py-4 space-y-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Select File <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-xs file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
          />
          {file && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
          <p className="text-xs text-gray-400">Accepted: PDF, JPG, PNG, Word documents. Max 10 MB.</p>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!file}
            onClick={() => file && onUpload(file)}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
