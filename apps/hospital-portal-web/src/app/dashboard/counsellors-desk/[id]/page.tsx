'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, ChevronDown, ChevronUp, User, Search, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi, mapDecision } from '@/lib/api/counselling-azure.api';
import { serviceCatalogApi, priceSuffix, flattenCatalog } from '@/lib/api/service-catalog.api';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import type { FullCatalogResponse, IolMasterDto, FlatVariantDto } from '@/lib/api/service-catalog.api';
import { useAuthStore } from '@/lib/auth-store';
import { useConfirmation } from '@/components/common/ConfirmationDialog';
import { useMasterValues } from '@/hooks/use-master-values';
import {
  useCounsellorsMasterCatalogQuery,
  useServiceCatalogQuery,
  useStaffDirectoryQuery,
  useCounsellingSessionQuery,
  useInvalidateCounsellorsDesk,
} from '@/hooks/use-counsellors-desk-queries';
import { SessionPageHeader } from '@/components/counsellors-desk/session/SessionPageHeader';
import {
  INSURANCE_COMPANY_FALLBACK,
  PACKAGE_OPTIONS,
  INSURANCE_PAYMENT_TYPES,
  COVERAGE_PAYMENT_TYPES,
  derivePaymentType,
  formatTime,
} from '@/lib/counsellors-desk/session-utils';
import type { CounsellingSession, ScheduleData, WaitingListStatus, SessionAuditEntry, DecisionType, MasterCatalogItem, InvestigationItem, CombinedPaymentType } from '@/types/counsellors-desk';
import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';

type MasterCatalogShape = {
  imaging: MasterCatalogItem[];
  scan: MasterCatalogItem[];
  lab: MasterCatalogItem[];
};

const EMPTY_MASTER_CATALOG: MasterCatalogShape = { imaging: [], scan: [], lab: [] };
const EMPTY_STAFF_LIST: Array<{ id: string; firstName: string; lastName: string; email?: string; phoneNumber?: string }> = [];

interface NotesPanel {
  counsellor: boolean;
  patient: boolean;
  doctor: boolean;
}

const ScheduleSurgeryModal = dynamic(
  () => import('@/components/counsellors-desk/ScheduleSurgeryModal').then(m => ({ default: m.ScheduleSurgeryModal })),
  { ssr: false },
);
const SessionHistoryModal = dynamic(
  () => import('@/components/counsellors-desk/SessionHistoryModal').then(m => ({ default: m.SessionHistoryModal })),
  { ssr: false },
);
const CoveragePreauthPanel = dynamic(
  () => import('@/components/counsellors-desk/coverage/CoveragePreauthPanel').then(m => ({ default: m.CoveragePreauthPanel })),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center py-16 text-sm text-gray-400">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3" />
      Loading coverage panel…
    </div>
  ) },
);
const CounsellingTabPanel = dynamic(
  () => import('@/components/counsellors-desk/session/CounsellingTabPanel').then((m) => ({ default: m.CounsellingTabPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3" />
        Loading counselling panel…
      </div>
    ),
  },
);

export default function CounsellingSessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const { showConfirmation, ConfirmationComponent } = useConfirmation();
  const { invalidateWaitingList, invalidateSession } = useInvalidateCounsellorsDesk();

  // Insurance providers from master data (falls back to hardcoded list if API unavailable)
  const { options: insuranceProviderOptions } = useMasterValues('insurance.provider', INSURANCE_COMPANY_FALLBACK);

  const [session, setSession] = useState<CounsellingSession | null>(null);
  const sessionQuery = useCounsellingSessionQuery(sessionId);
  const sessionAppliedRef = useRef<string | null>(null);
  const investigationsHydratedRef = useRef<string | null>(null);
  const isLoading = !session && !sessionQuery.isError;

  // Deep-link support: ?tab=coverage&subtab=preauth (e.g. from waiting-list "Start Pre-Auth" button)
  const tabParam = searchParams.get('tab') as 'counselling' | 'coverage' | null;
  const subtabParam = searchParams.get('subtab') as 'eligibility' | 'preauth' | 'estimate' | 'status' | null;
  const [activeMainTab, setActiveMainTab] = useState<'counselling' | 'coverage'>(tabParam ?? 'counselling');
  const [coverageTabMounted, setCoverageTabMounted] = useState(tabParam === 'coverage');

  // Form state (mirrors CounsellingSession fields)
  const [selectedSurgeryId, setSelectedSurgeryId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedEye, setSelectedEye] = useState<'RE' | 'LE' | 'BE'>('RE');
  const [paymentType, setPaymentType] = useState<CombinedPaymentType | ''>('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [freeSurgeryReason, setFreeSurgeryReason] = useState('');
  const [packageName, setPackageName] = useState('');
  const [packageRate, setPackageRate] = useState<number | ''>('');
  const [showPackageEdit, setShowPackageEdit] = useState(false);
  const savedSnapshotRef = useRef<Record<string, string>>({});
  const [decision, setDecision] = useState<DecisionType | ''>('');
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [counsellorNotes, setCounsellorNotes] = useState('');
  const [patientRemarks, setPatientRemarks] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [wantToSeeDoctor, setWantToSeeDoctor] = useState(false);
  const [interestedToUpgrade, setInterestedToUpgrade] = useState(false);
  const [notRequiredPreAuth, setNotRequiredPreAuth] = useState(false);

  // Investigations state
  const [selectedInvestigations, setSelectedInvestigations] = useState<Map<string, InvestigationItem>>(new Map());
  const [invTab, setInvTab] = useState<'imaging_orders' | 'required_investigations'>('imaging_orders');
  const [invExpanded, setInvExpanded] = useState(false);
  const [procExpanded, setProcExpanded] = useState(true);

  // Procedure Counseling state
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedIolId, setSelectedIolId] = useState<string | null>(null);
  const [iolOptions, setIolOptions] = useState<IolMasterDto[]>([]);
  // Sub-option for the selected variant (staff-only, required when sub-options exist)
  const [variantSubOption, setVariantSubOption] = useState<string | null>(null);

  // Price override state
  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [overridePrice, setOverridePrice] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideRemarks, setOverrideRemarks] = useState('');
  const [overrideRequesterType, setOverrideRequesterType] = useState<'SELF' | 'STAFF'>('SELF');
  const [overrideStaffName, setOverrideStaffName] = useState('');
  const [overrideStaffContact, setOverrideStaffContact] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState('');
  const [savedOverrides, setSavedOverrides] = useState<PriceOverrideRecord[]>([]);
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null);

  // Required Investigations urgency mode
  const [urgencyMode, setUrgencyMode] = useState<'Routine' | 'Urgent' | 'STAT'>('Routine');

  // Search filters for procedures / imaging / investigations
  const [procSearch, setProcSearch] = useState('');
  const [imagingSearch, setImagingSearch] = useState('');
  const [labSearch, setLabSearch] = useState('');

  const [openNotes, setOpenNotes] = useState<NotesPanel>({ counsellor: false, patient: false, doctor: false });
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [coverageRefreshKey, setCoverageRefreshKey] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  // GAP 1 & 2: status visibility + lock
  const [queueStatus, setQueueStatus] = useState<WaitingListStatus>('Pending');
  // GAP 3: follow-up tracking
  const [followUpReason, setFollowUpReason] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  // GAP 5: package change detection
  const [originalPackageName, setOriginalPackageName] = useState<string | null>(null);
  // GAP 7: history modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<SessionAuditEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const historyBtnRef = useRef<HTMLButtonElement>(null);
  // Tracks whether this session had surgery done — used to skip lock/unlock and enforce read-only
  const isSurgeryDoneRef = useRef(false);
  // OT record for this session — fetched at load when Done, needed to call editOtScheduleSlot on re-save
  const [existingOtScheduleId, setExistingOtScheduleId] = useState<string | null>(null);

  const masterCatalogQuery = useCounsellorsMasterCatalogQuery(!!session);
  const masterCatalog = masterCatalogQuery.data ?? EMPTY_MASTER_CATALOG;

  const serviceCatalogQuery = useServiceCatalogQuery(!!session && activeMainTab === 'counselling');
  const catalog = serviceCatalogQuery.data ?? null;
  const catalogLoading = serviceCatalogQuery.isLoading;
  const catalogError = serviceCatalogQuery.isError;
  const refetchCatalog = serviceCatalogQuery.refetch;
  const loadCatalog = useCallback(() => { void refetchCatalog(); }, [refetchCatalog]);

  const staffQuery = useStaffDirectoryQuery(showOverridePanel);
  const staffList = staffQuery.data ?? EMPTY_STAFF_LIST;

  const markDirty = useCallback(() => setIsDirty(true), []);

  // Computed grand total: variant price (or override) + IOL + imaging + lab.
  // Used as fallback for packageAmount when package_amount was never persisted to DB.
  const computedGrandTotal = useMemo(() => {
    const summaryVariant = catalog ? flattenCatalog(catalog).find(v => v.id === selectedVariantId) : null;
    const displayPrice = summaryVariant
      ? (savedOverrides.length > 0 ? savedOverrides[0].overriddenPrice : summaryVariant.price)
      : 0;
    const iolPrice = iolOptions.find(i => i.id === selectedIolId)?.price ?? 0;
    const allInv = Array.from(selectedInvestigations.values());
    const imagingTotal = allInv.filter(i => i.testType === 'Imaging' || i.testType === 'Scan').reduce((s, i) => s + i.price, 0);
    const labTotal    = allInv.filter(i => i.testType !== 'Imaging' && i.testType !== 'Scan').reduce((s, i) => s + i.price, 0);
    return displayPrice + iolPrice + imagingTotal + labTotal;
  }, [catalog, selectedVariantId, savedOverrides, iolOptions, selectedIolId, selectedInvestigations]);

  useEffect(() => {
    sessionAppliedRef.current = null;
    investigationsHydratedRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    if (activeMainTab === 'coverage') setCoverageTabMounted(true);
  }, [activeMainTab]);

  useEffect(() => {
    let cancelled = false;

    const applySessionData = (data: CounsellingSession) => {
      setSession(data);
      setSelectedSurgeryId(data.selectedSurgeryId ?? null);
      if (data.selectedSurgeryId?.startsWith('type-')) {
        const withoutPrefix = data.selectedSurgeryId.slice(5);
        const eyeMatch = withoutPrefix.match(/-(RE|LE|BE)$/);
        if (eyeMatch) {
          const variantId = withoutPrefix.slice(0, -eyeMatch[0].length);
          setSelectedVariantId(variantId);
          setSelectedEye(eyeMatch[1] as 'RE' | 'LE' | 'BE');
        }
      } else if (data.restoredEye && data.restoredEye !== 'RE') {
        setSelectedEye(data.restoredEye as 'RE' | 'LE' | 'BE');
      }
      const derivedPT = derivePaymentType(data.paymentMode ?? '', data.patientType ?? '');
      setPaymentType(derivedPT);
      setInsuranceCompany(
        data.insuranceCompany ?? (INSURANCE_PAYMENT_TYPES.includes(derivedPT as CombinedPaymentType)
          ? (data.company ?? '') : '')
      );
      setFreeSurgeryReason(data.freeSurgeryReason);
      setVariantSubOption(data.variantSubOption ?? null);
      setPackageName(data.packageName);
      setPackageRate(data.packageRate);
      setDecision(data.decision);
      setSchedule(data.schedule);
      setCounsellorNotes(data.counsellorNotes);
      setPatientRemarks(data.patientRemarks);
      setDoctorNotes(data.doctorNotes);
      setWantToSeeDoctor(data.wantToSeeDoctor);
      setInterestedToUpgrade(data.interestedToUpgrade);
      setNotRequiredPreAuth(data.notRequiredPreAuth);
      setQueueStatus((data.status as WaitingListStatus) || 'Pending');
      setFollowUpReason(data.followUpReason ?? '');
      setFollowUpDate(data.followUpDate ?? '');
      setOriginalPackageName(data.packageName || null);
      savedSnapshotRef.current = {
        paymentType: derivedPT,
        insuranceCompany: data.insuranceCompany ?? (INSURANCE_PAYMENT_TYPES.includes(derivedPT as CombinedPaymentType) ? (data.company ?? '') : ''),
        decision: data.decision ?? '',
        followUpReason: data.followUpReason ?? '',
        followUpDate: data.followUpDate ?? '',
        counsellorNotes: data.counsellorNotes ?? '',
        patientRemarks: data.patientRemarks ?? '',
        doctorNotes: data.doctorNotes ?? '',
        wantToSeeDoctor: String(data.wantToSeeDoctor ?? false),
        interestedToUpgrade: String(data.interestedToUpgrade ?? false),
        notRequiredPreAuth: String(data.notRequiredPreAuth ?? false),
        selectedSurgeryId: data.selectedSurgeryId ?? '',
        selectedEye: 'RE',
        packageName: data.packageName ?? '',
        packageRate: String(data.packageRate ?? ''),
        schedule: data.schedule?.selectedDate ?? '',
      };
    };

    const enrichSession = async (data: CounsellingSession) => {
      if ((data.status as string) === 'Done') {
        counsellorsDeskApi.getFinalizeList({ uhid: data.uhid })
          .then(otRecs => {
            if (cancelled) return;
            const hit = otRecs.find(r => r.counsellingSessionId === sessionId);
            if (hit) setExistingOtScheduleId(hit.id);
          })
          .catch(() => { /* non-critical */ });
      }

      try {
        const azureRecord = await counsellingAzureApi.getRecord(sessionId);
        if (cancelled || !azureRecord) return;
        if (!data.decision && azureRecord.decisionType) {
          const uiDecision: DecisionType =
            azureRecord.decisionType === 'NotInterested' ? 'NotInterested'
            : azureRecord.decisionType === 'NeedsTime' ? 'NeedsTime'
            : 'DateForSurgery';
          setDecision(uiDecision);
        }
        if (!data.schedule && azureRecord.scheduledDate) {
          setSchedule({ selectedDate: azureRecord.scheduledDate.split('T')[0], operationTheatre: '', doctor: '', surgeryStartTime: '', avoidTimeFrom: '', avoidTimeTo: '' });
        }
        if (azureRecord.packageDetails) {
          try {
            const pkg = JSON.parse(azureRecord.packageDetails);
            if (pkg.name && !data.packageName) setPackageName(pkg.name);
            if (pkg.rate && !data.packageRate) setPackageRate(Number(pkg.rate) || '');
            if (pkg.paymentType && !data.paymentMode) setPaymentType(pkg.paymentType as CombinedPaymentType);
            if (pkg.insuranceCompany && !data.insuranceCompany) setInsuranceCompany(pkg.insuranceCompany);
            if (pkg.variantId && !data.selectedSurgeryId) {
              const eye = (pkg.eye ?? 'RE') as 'RE' | 'LE' | 'BE';
              setSelectedVariantId(pkg.variantId);
              setSelectedEye(eye);
              setSelectedSurgeryId(`type-${pkg.variantId}-${eye}`);
            }
          } catch { /* ignore invalid packageDetails JSON */ }
        }
        if (azureRecord.paymentType && !data.paymentMode) setPaymentType(azureRecord.paymentType as CombinedPaymentType);
        if (azureRecord.insuranceCompany && !data.insuranceCompany) setInsuranceCompany(azureRecord.insuranceCompany);
        if (azureRecord.followUpDate && !data.followUpDate) setFollowUpDate(azureRecord.followUpDate);
        if (azureRecord.followUpReason && !data.followUpReason) setFollowUpReason(azureRecord.followUpReason);
      } catch { /* non-critical — Azure may be offline */ }

      try {
        const overrides = await counsellingAzureApi.getPriceOverrides(sessionId);
        if (!cancelled) setSavedOverrides(overrides);
      } catch { /* non-critical */ }

      if (data.status === 'Pending') {
        counsellorsDeskApi.startSession(sessionId);
      }
      if ((data.status as string) !== 'SurgeryDone') {
        isSurgeryDoneRef.current = false;
        counsellingAzureApi.lock(sessionId);
      } else {
        isSurgeryDoneRef.current = true;
      }
    };

    const load = () => {
      if (!sessionQuery.data) return;
      if (sessionAppliedRef.current === sessionId) return;
      sessionAppliedRef.current = sessionId;
      applySessionData(sessionQuery.data);
      void enrichSession(sessionQuery.data);
    };

    if (sessionQuery.isError) {
      toast.error('Failed to load session');
      return;
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId, sessionQuery.data, sessionQuery.isError]);

  // Remove a saved price override (soft-delete)
  const handleRemoveOverride = async (overrideId: string) => {
    try {
      await counsellingAzureApi.removePriceOverride(sessionId, overrideId);
      setSavedOverrides(prev => prev.filter(o => o.id !== overrideId));
    } catch {
      toast.error('Failed to remove override');
    }
  };

  // Pre-fill the override form for editing an existing record
  const handleEditOverride = (ov: PriceOverrideRecord) => {
    setEditingOverrideId(ov.id);
    setOverridePrice(String(ov.overriddenPrice));
    setOverrideReason(ov.reason);
    setOverrideRemarks(ov.remarks ?? '');
    setShowOverridePanel(true);
    setOverrideError('');
  };

  // Load IOL options when a variant with IOL options is selected
  useEffect(() => {
    if (!selectedVariantId || !catalog) { setIolOptions([]); return; }
    const variant = flattenCatalog(catalog).find((v) => v.id === selectedVariantId);
    if (!variant?.hasIolOptions) { setIolOptions([]); setSelectedIolId(null); return; }
    serviceCatalogApi.getVariantIolOptions(selectedVariantId).then(setIolOptions).catch(() => setIolOptions([]));
    setSelectedIolId(null);
  }, [selectedVariantId, catalog]);

  // Pre-populate investigations from session when it loads (once per session + catalog when needed)
  useEffect(() => {
    if (!session) return;
    if (investigationsHydratedRef.current === session.id) return;

    const hasSavedInvestigations = (session.investigations?.length ?? 0) > 0;
    const hasSuggestedTests = (session.suggestedPreOpTests?.length ?? 0) > 0;
    if (!hasSavedInvestigations && !hasSuggestedTests) {
      investigationsHydratedRef.current = session.id;
      return;
    }

    const needsCatalogLookup =
      session.investigations?.some(inv => !inv.catalogId) ?? false;
    if (needsCatalogLookup && !masterCatalogQuery.data) return;

    const catalogForLookup = masterCatalogQuery.data ?? EMPTY_MASTER_CATALOG;
    const map = new Map<string, InvestigationItem>();

    if (hasSavedInvestigations) {
      const allCatalogItems = [
        ...catalogForLookup.imaging,
        ...catalogForLookup.scan,
        ...catalogForLookup.lab,
      ];
      const nameToId = new Map<string, string>(
        allCatalogItems.map(c => [c.name.toLowerCase().trim(), c.id]),
      );
      session.investigations!.forEach((inv) => {
        const resolvedCatalogId = inv.catalogId
          ?? nameToId.get(inv.testName?.toLowerCase().trim() ?? '')
          ?? inv.id;
        if (resolvedCatalogId) {
          map.set(resolvedCatalogId, { ...inv, catalogId: inv.catalogId ?? resolvedCatalogId });
        }
      });
      setSelectedInvestigations(map);
      setInvExpanded(true);
    } else if (hasSuggestedTests) {
      session.suggestedPreOpTests!.forEach((item) => {
        map.set(item.id, {
          catalogId: item.id,
          testName: item.name,
          testCode: item.code,
          testType: item.testType,
          price: item.price,
          urgency: 'Routine',
          source: 'doctor',
        });
      });
      setSelectedInvestigations(map);
      setInvExpanded(true);
    }

    investigationsHydratedRef.current = session.id;
  }, [session, masterCatalogQuery.data]);

  // Unsaved changes guard
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  }, [isDirty]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);

  // GAP 2: release lock on unmount — skip for SurgeryDone (no lock was acquired)
  useEffect(() => {
    return () => { if (!isSurgeryDoneRef.current) counsellingAzureApi.unlock(sessionId); };
  }, [sessionId]);

  const handleBack = () => {
    if (isDirty) {
      showConfirmation({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to leave?',
        variant: 'warning',
        confirmText: 'Leave',
        cancelText: 'Stay',
        onConfirm: () => router.back(),
      });
      return;
    }
    router.back();
  };

  // Done → Processed: re-opens the session so the counsellor can change the procedure
  const handleReEvaluate = () => {
    showConfirmation({
      title: 'Re-evaluate Session',
      message: 'Changing the procedure will restart the counselling process (Done → In Progress). Continue?',
      variant: 'warning',
      confirmText: 'Continue',
      onConfirm: async () => {
        try {
          await counsellingAzureApi.reEvaluate(sessionId);
          setQueueStatus('Processed');
          toast.success('Session reopened for re-evaluation');
        } catch {
          toast.error('Failed to re-open session');
        }
      },
    });
  };

  // RepeatCounselling → Processed: counsellor explicitly starts a fresh counselling round.
  // Calls startSession which transitions the queue item Completed → InProgress so the
  // waiting list shows "Processed" while the counsellor is actively working.
  const handleStartRepeatSession = async () => {
    try {
      await counsellorsDeskApi.startSession(sessionId);
      setQueueStatus('Processed');
      toast.success('Repeat counselling session started');
    } catch {
      toast.error('Failed to start repeat session');
    }
  };


  const toggleInvestigation = (item: MasterCatalogItem) => {
    setSelectedInvestigations((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        // Lab items inherit the currently active urgency mode
        const urgency = item.testType === 'Lab' ? urgencyMode : 'Routine';
        next.set(item.id, {
          catalogId: item.id,
          testName: item.name,
          testCode: item.code,
          testType: item.testType,
          price: item.price,
          urgency,
          source: 'counsellor',
          // Capture the active eye selection for Imaging/Scan items
          ...(item.testType !== 'Lab' ? { eye: selectedEye } : {}),
        });
      }
      return next;
    });
    markDirty();
  };

  const handleSave = async () => {
    // Warn (not block) if no procedure selected — allows saving decision/notes for repeat sessions
    if (!selectedSurgeryId) {
      toast('No procedure selected — saving decision and notes only', { icon: '⚠️' });
    }
    // If the selected variant has sub-options, one must be chosen before saving
    if (selectedVariantId && catalog) {
      const selVariant = flattenCatalog(catalog).find(v => v.id === selectedVariantId);
      if (selVariant?.subOptions?.length && !selVariant.hasIolOptions && !variantSubOption) {
        toast.error('Please select a sub-type for the selected procedure');
        return;
      }
    }
    if (!decision) {
      toast.error('Please select a decision (Date for Surgery / Interested / Not Interested)');
      return;
    }
    setIsSaving(true);
    // Compute field-level diff for audit trail before entering try block
    const currentSnapshot: Record<string, string> = {
      paymentType: paymentType ?? '',
      insuranceCompany: insuranceCompany ?? '',
      decision: decision ?? '',
      followUpReason: followUpReason ?? '',
      followUpDate: followUpDate ?? '',
      counsellorNotes: counsellorNotes ?? '',
      patientRemarks: patientRemarks ?? '',
      doctorNotes: doctorNotes ?? '',
      wantToSeeDoctor: String(wantToSeeDoctor),
      interestedToUpgrade: String(interestedToUpgrade),
      notRequiredPreAuth: String(notRequiredPreAuth),
      selectedSurgeryId: selectedSurgeryId ?? '',
      selectedEye: selectedEye ?? '',
      packageName: packageName ?? '',
      packageRate: String(packageRate ?? ''),
      schedule: schedule?.selectedDate ?? '',
    };
    const fieldChanges = Object.entries(currentSnapshot)
      .filter(([key, val]) => savedSnapshotRef.current[key] !== undefined && savedSnapshotRef.current[key] !== val)
      .map(([fieldName, newValue]) => ({ fieldName, oldValue: savedSnapshotRef.current[fieldName] ?? '', newValue }));

    try {
      // Compute agreed flag before save so patientAgreedToSurgery is written in the same request.
      // This is keyed by the waiting list to show Done (true) or RepeatCounselling (false).
      const agreedToSurgery = decision === 'DateForSurgery' || decision === 'Interested';

      // Detect package upgrade on a Done session → triggers AddOnSurgery workflow.
      const isPackageUpgrade = isDoneState && (
        packageName !== savedSnapshotRef.current.packageName ||
        String(packageRate) !== savedSnapshotRef.current.packageRate
      );

      const prevPackageName   = savedSnapshotRef.current.packageName || undefined;
      const prevPackageAmount = savedSnapshotRef.current.packageRate
        ? Number(savedSnapshotRef.current.packageRate)
        : undefined;

      await counsellorsDeskApi.saveSession(sessionId, {
        // ── Counsellor JSON blob ──────────────────────────────────────────────────
        // PackageAddonsJson is repurposed as a free-form store for counsellor-side data
        // (selectedSurgeryId, packageName, decision, paymentType, schedule, etc.).
        // getSession() reads this back on every load to restore the form.
        packageAddonsJson: JSON.stringify({
          selectedSurgeryId,
          packageName,
          variantId: selectedVariantId,
          eye: selectedEye,
          decision,
          paymentType,
          insuranceCompany,
          rate: typeof packageRate === 'number' ? packageRate : undefined,
          ...(followUpDate && { followUpDate }),
          // Store the full schedule object so OT room, doctor and time survive a page reload
          ...(schedule && { schedule }),
          // Notes — no dedicated DB columns; stored in the blob and restored by getSession()
          ...(patientRemarks && { patientRemarks }),
          ...(doctorNotes    && { doctorNotes }),
          // Additional-option checkboxes
          wantToSeeDoctor,
          interestedToUpgrade,
          notRequiredPreAuth,
          // AddOnSurgery upgrade tracking — populated so the waiting list can show diff
          ...(isPackageUpgrade && prevPackageName  && { previousPackageName:   prevPackageName  }),
          ...(isPackageUpgrade && prevPackageAmount && { previousPackageAmount: prevPackageAmount }),
        }),
        // ── Decision booleans — drive Done vs RepeatCounselling in the waiting list ─
        patientAgreedToSurgery: agreedToSurgery,
        pendingDecision: decision === 'NeedsTime',
        // ── Follow-up details ─────────────────────────────────────────────────────
        reasonsForDelay: followUpReason || undefined,
        decisionDate: followUpDate || undefined,
        // ── Tentative surgery date + time + eye ──────────────────────────────────────
        surgeryTentativeDate: schedule?.selectedDate || undefined,
        surgeryTentativeTimeSlot: schedule?.surgeryStartTime || undefined,
        surgeryTentativeEye: selectedEye || undefined,
        // ── Package financials ────────────────────────────────────────────────────
        // Prefer the explicitly-set packageRate; fall back to the live grand total
        // (variant price + IOL + investigations) so newly-created or legacy sessions
        // without a persisted package_amount always record the quoted amount.
        packageAmount: (typeof packageRate === 'number' && packageRate > 0)
          ? packageRate
          : (computedGrandTotal > 0 ? computedGrandTotal : undefined),
        // ── Session notes ─────────────────────────────────────────────────────────
        additionalNotes: counsellorNotes || undefined,
        // ── PatientType — only send values the backend accepts ────────────────────
        patientType: (['Cash', 'Insurance', 'CoPay', 'ESH', 'CGHS', 'Arograshree', 'SGHS', 'Camp'] as string[]).includes(paymentType ?? '')
          ? (paymentType as string) : undefined,
        // ── Misc ──────────────────────────────────────────────────────────────────
        freeSurgeryReason,
        variantSubOption,
        company: insuranceCompany,
        isFollowUpRequired: decision === 'NotInterested' || decision === 'NeedsTime',
        fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined,
      } as unknown as CounsellingSession);

      // Save investigation orders
      if (selectedInvestigations.size > 0) {
        await counsellorsDeskApi.saveInvestigations(sessionId, Array.from(selectedInvestigations.values()));
      }

      // Transition queue status based on session outcome:
      // • AddOnSurgery (package upgrade on Done):  queue → AddOnSurgery
      // • Normal save:                              queue → Completed (waiting list derives Done/RepeatCounselling)
      if (isPackageUpgrade) {
        counsellorsDeskApi.markAddOnSurgery(sessionId);
      } else {
        counsellorsDeskApi.completeSession(sessionId);
      }

      // ── Azure Functions state machine (non-blocking) ──────────────────────
      // Record the patient decision. From Done state, NotInterested/NeedsTime → RepeatCounselling.
      if (decision) {
        // Pass followUpDate/Reason for NotInterested and NeedsTime decisions
        const mappedDecision = mapDecision(decision);
        if (decision === 'NeedsTime') {
          counsellingAzureApi.decision(sessionId, 'NeedsTime', undefined, followUpDate || undefined, followUpReason || undefined);
        } else {
          counsellingAzureApi.decision(sessionId, mappedDecision, undefined, followUpDate || undefined, followUpReason || undefined);
        }
      }
      // Persist scheduled surgery date
      if (schedule?.selectedDate) {
        counsellingAzureApi.schedule(sessionId, schedule.selectedDate);
      }
      // Fire AddOnSurgery state transition in the Azure counselling service
      if (isPackageUpgrade) {
        counsellingAzureApi.addOnSurgery(sessionId, 'Package upgraded');
      }
      // Snapshot the selected package + payment details to Azure
      // variantId and eye are packed inside the JSON blob so we can restore them on load
      counsellingAzureApi.save(sessionId, {
        packageDetails: JSON.stringify({
          name: packageName,
          rate: (typeof packageRate === 'number' && packageRate > 0) ? packageRate : (computedGrandTotal || undefined),
          paymentType, insuranceCompany, variantId: selectedVariantId, eye: selectedEye,
        }),
        paymentType: paymentType || undefined,
        insuranceCompany: insuranceCompany || undefined,
      });
      // ─────────────────────────────────────────────────────────────────────

      // ── OT finalize trigger ────────────────────────────────────────────────────
      // Non-blocking: OT upsert/edit failure must not roll back the counselling save.
      if (!isPackageUpgrade && schedule?.selectedDate &&
          (decision === 'DateForSurgery' || decision === 'Interested')) {
        try {
          const startTimeIso = schedule.surgeryStartTime
            ? `${schedule.selectedDate}T${schedule.surgeryStartTime}:00`
            : schedule.selectedDate;
          if (isDoneState && existingOtScheduleId) {
            // Session already Done — edit the existing slot so OT status reverts to NotConfirmed + version++
            await counsellorsDeskApi.editOtScheduleSlot(existingOtScheduleId, {
              doctorName: schedule.doctor || '',
              theatreName: schedule.operationTheatre || '',
              startTime: startTimeIso,
            });
          } else {
            // First save (session transitioning to Done) — create/upsert the OT record
            await counsellorsDeskApi.upsertOtSchedule({
              patientId: session.patientId,
              uhid: session.uhid,
              patientName: session.patientName,
              surgeryName: session?.surgeries?.find(s => s.id === selectedSurgeryId)?.surgeryName
                || session?.surgeries?.find(s => s.isRecommended)?.surgeryName
                || packageName || '',
              eyes: selectedEye,
              patientType: paymentType || '',
              paymentMode: paymentType || '',
              surgeon: schedule.doctor || '',
              startTime: startTimeIso,
              theaterName: schedule.operationTheatre || '',
              packageName: packageName || '',
              packageRate: typeof packageRate === 'number' ? packageRate : undefined,
              counsellingSessionId: sessionId,
            });
          }
        } catch {
          // Non-fatal — OT entry will be created on next save if needed
        }
      }

      savedSnapshotRef.current = currentSnapshot;
      setIsDirty(false);
      // Update local status so header reflects the new state immediately
      const nextStatus: WaitingListStatus = isPackageUpgrade
        ? 'AddOnSurgery'
        : (decision === 'NotInterested' || decision === 'NeedsTime')
          ? 'RepeatCounselling'
          : 'Done';
      setQueueStatus(nextStatus);

      toast.success('Session saved successfully');
      invalidateWaitingList();
      invalidateSession(sessionId);

      // For insurance/TPA payments: bump the refresh key so CoveragePreauthPanel re-fetches
      if (COVERAGE_PAYMENT_TYPES.includes(paymentType as typeof COVERAGE_PAYMENT_TYPES[number]) && !notRequiredPreAuth) {
        setCoverageRefreshKey(k => k + 1);
        setActiveMainTab('coverage');
      }
    } catch (err: unknown) {
      // Surface the actual backend error message so the user knows what went wrong
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ? `Save failed: ${msg}` : 'Failed to save session — check network tab for details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleScheduleSubmit = (data: ScheduleData) => {
    setSchedule(data);
    markDirty();
    toast.success('Schedule set successfully');
  };

  const handleOpenHistory = async () => {
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      // Fetch all 3 sources in parallel — never block one on another
      const [azureResult, authResult, overridesResult] = await Promise.allSettled([
        counsellingAzureApi.getHistory(sessionId),
        counsellorsDeskApi.getSessionHistory(sessionId),
        counsellingAzureApi.getPriceOverrides(sessionId),
      ]);

      const azureEntries = azureResult.status === 'fulfilled' ? azureResult.value : [];
      const authEntries  = authResult.status  === 'fulfilled' ? authResult.value  : [];
      const priceOverrides: PriceOverrideRecord[] = overridesResult.status === 'fulfilled' ? overridesResult.value : [];

      // Filter noisy Lock/Unlock events from Azure
      const filtered = azureEntries.filter(e => e.changeType !== 'Lock' && e.changeType !== 'Unlock');

      // Deduplicate: drop auth-service FieldChanged entries that duplicate Azure FieldChanged
      // (same fieldName + changedBy within 5 seconds)
      const azureFieldChangedSet = new Set(
        filtered
          .filter(e => e.changeType === 'FieldChanged')
          .map(e => `${e.fieldName}|${e.changedBy}|${Math.floor(new Date(e.changedAt).getTime() / 5000)}`)
      );
      const dedupedAuth = authEntries.filter(e => {
        if (e.changeType !== 'FieldChanged') return true;
        const key = `${e.fieldName}|${e.changedBy}|${Math.floor(new Date(e.changedAt).getTime() / 5000)}`;
        return !azureFieldChangedSet.has(key);
      });

      // Merge and sort oldest-first for grouping logic
      const merged = [...filtered, ...dedupedAuth].sort(
        (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
      );

      // Enrich PriceOverride entries with ₹ amounts from the overrides list
      for (const entry of merged) {
        if (entry.changeType !== 'PriceOverride') continue;
        const entryTime = new Date(entry.changedAt).getTime();
        const match = priceOverrides.find(o => {
          const diff = Math.abs(new Date(o.createdAt).getTime() - entryTime);
          return diff <= 10_000;
        });
        if (match) {
          entry.priceBaseAmount       = match.basePrice;
          entry.priceOverriddenAmount = match.overriddenPrice;
          entry.priceVariantName      = match.variantName;
          entry.priceReason           = match.reason;
          entry.priceRequesterName    = match.requestedByName ?? null;
        }
      }

      // Group FieldChanged entries under their SaveCounselling parent
      const consumed = new Set<string>();
      for (const entry of merged) {
        if (entry.changeType !== 'SaveCounselling') continue;
        const saveTime = new Date(entry.changedAt).getTime();
        const children = merged.filter(e =>
          e.changeType === 'FieldChanged' &&
          e.changedBy === entry.changedBy &&
          Math.abs(new Date(e.changedAt).getTime() - saveTime) <= 5_000 &&
          !consumed.has(e.id)
        );
        if (children.length > 0) {
          entry.children = children;
          children.forEach(c => consumed.add(c.id));
        }
      }

      // Final list: remove consumed FieldChanged, show newest first
      const finalEntries = merged
        .filter(e => !consumed.has(e.id))
        .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());

      setHistoryEntries(finalEntries);
    } catch {
      // silent — modal shows empty state
    } finally {
      setIsHistoryLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading session…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Session not found</p>
      </div>
    );
  }

  // GAP 11: Done state is now editable with branching — procedure change triggers re-evaluate,
  // price override triggers add-on surgery, decision change works via updated state machine.
  const isDoneState = queueStatus === 'Done';
  const isRepeatState = queueStatus === 'RepeatCounselling';
  const isSurgeryDoneState = queueStatus === 'SurgeryDone';
  // Read-only while in RepeatCounselling state — counsellor must click "Start Session" first
  // Also read-only when surgery is done — session is permanently closed
  const isReadOnly = isRepeatState || isSurgeryDoneState;

  const counsellingTabProps = {
    isSurgeryDoneState, isDoneState, isRepeatState, isReadOnly, queueStatus,
    handleReEvaluate, handleStartRepeatSession, procExpanded, setProcExpanded,
    categoryFilter, setCategoryFilter, procSearch, setProcSearch, catalog, catalogLoading,
    catalogError, loadCatalog, selectedVariantId, selectedSurgeryId, selectedEye, setSelectedEye,
    setSelectedVariantId, setSelectedSurgeryId, variantSubOption, setVariantSubOption,
    iolOptions, selectedIolId, setSelectedIolId, selectedInvestigations, setSelectedInvestigations,
    toggleInvestigation, invTab, setInvTab, invExpanded, setInvExpanded, imagingSearch, setImagingSearch,
    labSearch, setLabSearch, masterCatalog, urgencyMode, savedOverrides, showOverridePanel,
    setShowOverridePanel, overridePrice, setOverridePrice, overrideReason, setOverrideReason,
    overrideRemarks, setOverrideRemarks, overrideRequesterType, setOverrideRequesterType,
    overrideStaffName, setOverrideStaffName, overrideStaffContact, setOverrideStaffContact,
    overrideSaving, overrideError, setOverrideError, setOverrideSaving, staffList,
    handleEditOverride, handleRemoveOverride, editingOverrideId, setEditingOverrideId,
    markDirty, session, paymentType, setPaymentType, insuranceCompany, setInsuranceCompany,
    insuranceProviderOptions, freeSurgeryReason, setFreeSurgeryReason, packageName, setPackageName,
    packageRate, setPackageRate, showPackageEdit, setShowPackageEdit, decision, setDecision,
    followUpReason, setFollowUpReason, followUpDate, setFollowUpDate, schedule,
    setIsScheduleModalOpen, counsellorNotes, setCounsellorNotes, patientRemarks, setPatientRemarks,
    doctorNotes, setDoctorNotes, openNotes, setOpenNotes, wantToSeeDoctor, setWantToSeeDoctor,
    interestedToUpgrade, setInterestedToUpgrade, notRequiredPreAuth, setNotRequiredPreAuth,
    sessionId, setQueueStatus, setSavedOverrides,
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <ConfirmationComponent />
      <SessionPageHeader
        session={session}
        queueStatus={queueStatus}
        isDirty={isDirty}
        historyBtnRef={historyBtnRef}
        onBack={handleBack}
        onOpenHistory={handleOpenHistory}
      />

      {/* Main Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-4 pt-3 gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveMainTab('counselling')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeMainTab === 'counselling'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            Counselling
          </button>
          {(['Insurance', 'TPA', 'CoPay', 'CGHS', 'SGHS', 'GovernmentScheme'] as string[]).includes(paymentType as string) && (
            <button
              type="button"
              onClick={() => setActiveMainTab('coverage')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
                activeMainTab === 'coverage'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Coverage &amp; Pre-Auth
              {activeMainTab !== 'coverage' && (
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" title="Pre-auth required" />
              )}
            </button>
          )}
        </div>

        {/* Coverage & Pre-Auth Tab Panel */}
        {coverageTabMounted && (
          <div className={activeMainTab !== 'coverage' ? 'hidden' : 'flex-1 min-h-0 p-5 flex flex-col overflow-hidden'}>
            <CoveragePreauthPanel
              sessionId={sessionId}
              paymentType={paymentType as string}
              insuranceCompany={insuranceCompany}
              patientId={session?.patientId}
              notRequiredPreAuth={notRequiredPreAuth}
              refreshKey={coverageRefreshKey}
              initialSubtab={subtabParam}
              cachedCaseNumber={session?.ccmsCaseNumber}
              cachedCaseState={session?.ccmsCurrentState}
              // ── Session data for pre-population ────────────────────────
              sessionSurgery={packageName || undefined}
              sessionSurgeryDate={schedule?.selectedDate || undefined}
              sessionPackageRate={packageRate ? Number(packageRate) : undefined}
              sessionDoctor={schedule?.doctor || undefined}
              sessionTheatre={schedule?.operationTheatre || undefined}
              sessionEye={selectedEye || undefined}
              sessionInvestigations={selectedInvestigations.size > 0
                ? Array.from(selectedInvestigations.values())
                : undefined}
              // ── Fallback insurer list when CCMS is offline ──────────
              fallbackPayers={INSURANCE_COMPANY_FALLBACK.map(p => ({
                id:     p.value,
                name:   p.label,
                status: 'active',
              }))}
            />
          </div>
        )}

        {/* Counselling Tab Panel — unmount when on Coverage to avoid rendering ~1500 DOM nodes */}
        {activeMainTab === 'counselling' && (
          <CounsellingTabPanel {...counsellingTabProps} />
        )}

      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 mt-4 bg-white border-t border-gray-200 rounded-xl shadow-lg px-6 py-3 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !decision || isReadOnly}
          className="flex items-center gap-2 px-8 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isSaving && (
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          Save Session
        </button>
      </div>

      {isScheduleModalOpen && (
        <ScheduleSurgeryModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSubmit={handleScheduleSubmit}
          existingSchedule={schedule}
        />
      )}

      {isHistoryOpen && (
        <SessionHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          entries={historyEntries}
          isLoading={isHistoryLoading}
          anchorRef={historyBtnRef}
        />
      )}
    </div>
  );
}
