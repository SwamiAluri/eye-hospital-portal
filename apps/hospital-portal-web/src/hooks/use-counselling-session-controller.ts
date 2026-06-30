'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi } from '@/lib/api/counselling-azure.api';
import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import { resolveProcedureOverridePrice } from '@/lib/counsellors-desk/package-preview';
import { useAuthStore } from '@/lib/auth-store';
import { useConfirmation } from '@/components/common/ConfirmationDialog';
import { useMasterValues } from '@/hooks/use-master-values';
import {
  useClinicalIolWithPricing,
  useCounsellorProcedureVariants,
} from '@/hooks/use-clinical-catalog-master';
import {
  buildCounsellorIolDtos,
  findCounsellorVariant,
} from '@/lib/master-data/clinical-catalog-master';
import {
  useCounsellorsMasterCatalogQuery,
  useStaffDirectoryQuery,
  useCounsellingSessionQuery,
  useInvalidateCounsellorsDesk,
} from '@/hooks/use-counsellors-desk-queries';
import {
  derivePaymentType,
  requiresInsuranceCompany,
} from '@/lib/counsellors-desk/session-utils';
import type {
  CounsellingSession,
  ScheduleData,
  WaitingListStatus,
  DecisionType,
  MasterCatalogItem,
  InvestigationItem,
  CombinedPaymentType,
} from '@/types/counsellors-desk';
import { defaultSessionTypeCode } from '@/lib/counsellors-desk/counsellor-master-maps';
import {
  EMPTY_COUNSELLING_ESTIMATE,
  type CounsellingEstimateState,
} from '@/types/counselling-estimate';
import {
  useCounsellingPackageTemplates,
  useCounsellingSettings,
} from '@/hooks/use-counselling-packages';
import { useCounsellingEstimate } from '@/hooks/use-counselling-estimate';
import type { PackageApplyPatch } from '@/lib/counsellors-desk/estimate-engine';
import {
  buildCounsellingEstimatePdfData,
  canPrintCounsellingEstimate,
} from '@/lib/counsellors-desk/counselling-estimate-pdf-content';
import { useCounsellingOverrides } from '@/hooks/use-counselling-overrides';
import { buildCounsellingFieldSnapshot } from '@/lib/counsellors-desk/counselling-field-snapshot';
import { saveCounsellingSession } from '@/lib/counsellors-desk/save-counselling-session';
import { saveCounsellingDraft } from '@/lib/counsellors-desk/save-counselling-draft';
import type {
  CoverageDraftSaveOptions,
  CoveragePreauthPanelHandle,
} from '@/components/counsellors-desk/coverage/coverage-preauth-panel-handle';
import type { OutpatientChecklistHandle } from '@/components/counsellors-desk/outpatient-checklist-handle';
import type { CounsellingWorkspaceSyncPatch } from '@/lib/counsellors-desk/counselling-coverage-workspace-sync';
import { patientApi, type Patient } from '@/lib/api/patients.api';
import {
  type CounsellingPhase,
  COUNSELLING_PHASE_ORDER,
  computePhaseCompletion,
  inferVisitedPhases,
  isCoveragePaymentType,
  nextPhase,
  prevPhase,
  validatePhase,
  type CounsellingPhaseInput,
} from '@/lib/counsellors-desk/counselling-progress';

type MasterCatalogShape = {
  imaging: MasterCatalogItem[];
  scan: MasterCatalogItem[];
  lab: MasterCatalogItem[];
};

const EMPTY_MASTER_CATALOG: MasterCatalogShape = { imaging: [], scan: [], lab: [] };
const EMPTY_STAFF_LIST: Array<{
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
}> = [];

interface NotesPanel {
  counsellor: boolean;
  patient: boolean;
  doctor: boolean;
}

export interface UseCounsellingSessionControllerParams {
  sessionId: string;
  initialTab?: 'counselling' | 'coverage' | 'outpatient' | null;
  initialSubtab?: 'eligibility' | 'preauth' | 'estimate' | 'status' | null;
}

export function useCounsellingSessionController({
  sessionId,
  initialTab,
  initialSubtab,
}: UseCounsellingSessionControllerParams) {
  const router = useRouter();
  const { showConfirmation, ConfirmationComponent } = useConfirmation();
  const { invalidateWaitingList, invalidateSession } = useInvalidateCounsellorsDesk();
  const { options: insuranceProviderOptions } = useMasterValues('insurance.provider');
  const authUser = useAuthStore((s) => s.user);

  const [session, setSession] = useState<CounsellingSession | null>(null);
  const sessionQuery = useCounsellingSessionQuery(sessionId);
  const sessionAppliedRef = useRef<string | null>(null);
  const investigationsHydratedRef = useRef<string | null>(null);
  const packageRestoredRef = useRef<string | null>(null);
  const isLoading = !session && !sessionQuery.isError;

  const [activeMainTab, setActiveMainTab] = useState<'counselling' | 'coverage' | 'outpatient'>(
    initialTab ?? 'counselling',
  );
  const [coverageTabMounted, setCoverageTabMounted] = useState(initialTab === 'coverage');
  const [coverageRefreshKey, setCoverageRefreshKey] = useState(0);

  const [selectedSurgeryId, setSelectedSurgeryId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedEye, setSelectedEye] = useState<'RE' | 'LE' | 'BE'>('RE');
  const [paymentType, setPaymentType] = useState<CombinedPaymentType | ''>('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const insuranceProviderId = useMemo(() => {
    if (!insuranceCompany) return undefined;
    const match = insuranceProviderOptions.find(
      (o) => o.label === insuranceCompany || o.value === insuranceCompany,
    );
    return match?.value;
  }, [insuranceCompany, insuranceProviderOptions]);
  const [freeSurgeryReason, setFreeSurgeryReason] = useState('');
  const [packageName, setPackageName] = useState('');
  const [packageRate, setPackageRate] = useState<number | ''>('');
  const [estimateState, setEstimateState] = useState<CounsellingEstimateState>(
    EMPTY_COUNSELLING_ESTIMATE,
  );
  const savedSnapshotRef = useRef<Record<string, string>>({});
  const [decision, setDecision] = useState<DecisionType | ''>('');
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [counsellorNotes, setCounsellorNotes] = useState('');
  const [patientRemarks, setPatientRemarks] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [wantToSeeDoctor, setWantToSeeDoctor] = useState(false);
  const [interestedToUpgrade, setInterestedToUpgrade] = useState(false);
  const [notRequiredPreAuth, setNotRequiredPreAuth] = useState(false);
  const [selectedInvestigations, setSelectedInvestigations] = useState<
    Map<string, InvestigationItem>
  >(new Map());
  const [selectedIolId, setSelectedIolId] = useState<string | null>(null);
  const [variantSubOption, setVariantSubOption] = useState<string | null>(null);
  const [savedOverrides, setSavedOverrides] = useState<PriceOverrideRecord[]>([]);
  const [openNotes, setOpenNotes] = useState<NotesPanel>({
    counsellor: false,
    patient: false,
    doctor: false,
  });
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const coveragePanelRef = useRef<CoveragePreauthPanelHandle>(null);
  const outpatientChecklistRef = useRef<OutpatientChecklistHandle>(null);

  const saveCoveragePanelDraft = useCallback(
    async (options?: CoverageDraftSaveOptions): Promise<boolean> => {
      const panel = coveragePanelRef.current;
      if (!panel?.saveDraft) {
        toast.error('Coverage panel is not ready — wait for it to load and try again');
        return false;
      }
      return panel.saveDraft(options);
    },
    [],
  );
  const counsellingSyncSkipRef = useRef(false);
  const [workspaceCcmsCaseNumber, setWorkspaceCcmsCaseNumber] = useState<string | undefined>();
  const [workspaceCcmsState, setWorkspaceCcmsState] = useState<string | undefined>();
  const [patientDetails, setPatientDetails] = useState<Patient | null>(null);
  const [patientDetailsLoading, setPatientDetailsLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState<WaitingListStatus>('Pending');
  const [repeatSessionTypeCode, setRepeatSessionTypeCode] = useState(
    defaultSessionTypeCode('repeat'),
  );
  const [followUpReason, setFollowUpReason] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const isSurgeryDoneRef = useRef(false);
  const [existingOtScheduleId, setExistingOtScheduleId] = useState<string | null>(null);
  const [estimatePrintOpen, setEstimatePrintOpen] = useState(false);
  const [activePhase, setActivePhase] = useState<CounsellingPhase>('estimate');
  const [visitedPhases, setVisitedPhases] = useState<CounsellingPhase[]>(['estimate']);
  const phasesInitializedRef = useRef(false);

  const overrides = useCounsellingOverrides({ sessionId, setSavedOverrides });

  const masterCatalogQuery = useCounsellorsMasterCatalogQuery(!!session);
  const masterCatalog = masterCatalogQuery.data ?? EMPTY_MASTER_CATALOG;
  const masterCatalogLoading = masterCatalogQuery.isLoading;
  const masterCatalogError = masterCatalogQuery.isError;
  const loadMasterCatalog = useCallback(() => {
    void masterCatalogQuery.refetch();
  }, [masterCatalogQuery]);

  const procedureQuery = useCounsellorProcedureVariants(
    !!session && activeMainTab === 'counselling',
  );
  const procedureVariants = procedureQuery.variants;
  const procedureLoading = procedureQuery.loading;
  const procedureError = procedureQuery.error;
  const loadProcedures = procedureQuery.refetch;

  const selectedProcedureVariant = findCounsellorVariant(procedureVariants, selectedVariantId);
  const iolPricing = useClinicalIolWithPricing(
    selectedProcedureVariant?.hasIolOptions ? (selectedVariantId ?? undefined) : undefined,
  );
  const iolOptions = useMemo(
    () => buildCounsellorIolDtos(iolPricing.items),
    [iolPricing.items],
  );

  const staffQuery = useStaffDirectoryQuery(!!session);
  const staffList = staffQuery.data ?? EMPTY_STAFF_LIST;

  const markDirty = useCallback(() => setIsDirty(true), []);
  const { data: counsellingSettings } = useCounsellingSettings();
  const { data: packageTemplates = [] } = useCounsellingPackageTemplates();

  const applyingPackageRef = useRef(false);
  const prevVariantIdRef = useRef<string | null>(null);

  const procedureOverridePrice = useMemo(
    () => resolveProcedureOverridePrice(savedOverrides, selectedVariantId),
    [savedOverrides, selectedVariantId],
  );

  const counsellingEstimate = useCounsellingEstimate({
    estimate: estimateState,
    onEstimateChange: useCallback((patch: Partial<CounsellingEstimateState>) => {
      setEstimateState((prev) => ({ ...prev, ...patch }));
      markDirty();
    }, [markDirty]),
    procedureVariants,
    selectedVariantId,
    selectedSurgeryId,
    selectedIolId,
    selectedEye,
    variantSubOption,
    selectedInvestigations,
    iolOptions,
    procedureOverridePrice,
    packageTemplates,
    settings: counsellingSettings ?? { maxDiscountPercent: 50, maxDiscountFlat: null },
    masterCatalog,
    onPackageApply: useCallback((patch: PackageApplyPatch) => {
      applyingPackageRef.current = true;
      setSelectedVariantId(patch.selectedVariantId);
      setSelectedEye(patch.selectedEye);
      setSelectedSurgeryId(patch.selectedSurgeryId);
      setSelectedIolId(patch.selectedIolId);
      setVariantSubOption(patch.variantSubOption);
      setSelectedInvestigations(patch.investigations);
      setPackageName(patch.packageName);
      setPackageRate(patch.packageRate);
      prevVariantIdRef.current = patch.selectedVariantId;
      applyingPackageRef.current = false;
      markDirty();
    }, [markDirty]),
    onPackageClear: useCallback(() => {
      setPackageName('');
      setPackageRate('');
      markDirty();
      toast('Package cleared — switched to custom estimate', { icon: 'ℹ️' });
    }, [markDirty]),
  });

  const mergedEstimate = counsellingEstimate.mergedEstimate;

  const applyCoverageWorkspaceSync = useCallback(
    (patch: CounsellingWorkspaceSyncPatch) => {
      let changed = false;
      counsellingSyncSkipRef.current = true;

      if (patch.insuranceProviderId !== undefined) {
        const match = insuranceProviderOptions.find((o) => o.value === patch.insuranceProviderId);
        const label = match?.label?.trim();
        if (label && label !== insuranceCompany) {
          setInsuranceCompany(label);
          changed = true;
        }
      } else if (
        patch.insuranceCompany !== undefined &&
        patch.insuranceCompany !== insuranceCompany
      ) {
        setInsuranceCompany(patch.insuranceCompany);
        changed = true;
      }

      if (
        patch.estimatedAmount !== undefined &&
        patch.estimatedAmount !== estimateState.finalPayableAmount
      ) {
        setEstimateState((prev) => ({
          ...prev,
          finalPayableAmount: patch.estimatedAmount!,
        }));
        setPackageRate(patch.estimatedAmount);
        changed = true;
      }

      if (patch.surgeryDate !== undefined) {
        const currentDate = schedule?.selectedDate ?? '';
        if (patch.surgeryDate !== currentDate) {
          setSchedule((prev) => ({
            selectedDate: patch.surgeryDate!,
            operationTheatre: prev?.operationTheatre ?? '',
            doctor: prev?.doctor ?? '',
            surgeryStartTime: prev?.surgeryStartTime ?? '',
            avoidTimeFrom: prev?.avoidTimeFrom ?? '',
            avoidTimeTo: prev?.avoidTimeTo ?? '',
          }));
          changed = true;
        }
      }

      if (
        patch.paymentType !== undefined &&
        patch.paymentType !== paymentType
      ) {
        setPaymentType(patch.paymentType as CombinedPaymentType);
        changed = true;
      }

      if (changed) markDirty();
    },
    [
      insuranceCompany,
      insuranceProviderOptions,
      estimateState.finalPayableAmount,
      schedule?.selectedDate,
      paymentType,
      markDirty,
    ],
  );

  const handleCaseWorkspaceChange = useCallback(
    (snapshot: { ccmsCaseNumber?: string; ccmsCurrentState?: string }) => {
      setWorkspaceCcmsCaseNumber(snapshot.ccmsCaseNumber);
      setWorkspaceCcmsState(snapshot.ccmsCurrentState);
    },
    [],
  );

  const workspaceIntegrationContext = useMemo(
    () => ({
      patientId: session?.patientId,
      paymentType: paymentType || session?.paymentType,
      notRequiredPreAuth: notRequiredPreAuth ?? session?.notRequiredPreAuth,
      ccmsCurrentState: workspaceCcmsState ?? session?.ccmsCurrentState,
      packageRate: packageRate !== '' ? packageRate : session?.packageRate,
    }),
    [
      session,
      paymentType,
      notRequiredPreAuth,
      workspaceCcmsState,
      packageRate,
    ],
  );

  const canPrintEstimate = useMemo(
    () =>
      canPrintCounsellingEstimate({
        selectedVariantId,
        packageTemplateId: mergedEstimate.packageTemplateId,
        lineCount: counsellingEstimate.lines.length,
      }),
    [selectedVariantId, mergedEstimate.packageTemplateId, counsellingEstimate.lines.length],
  );

  const estimatePdfData = useMemo(() => {
    if (!session || !canPrintEstimate) return null;
    const pdfVariant = findCounsellorVariant(procedureVariants, selectedVariantId);
    return buildCounsellingEstimatePdfData({
      sessionId,
      session,
      selectedEye,
      selectedVariantId,
      selectedInvestigations,
      estimateLines: counsellingEstimate.lines,
      itemizedSubtotal: counsellingEstimate.itemizedSubtotal,
      bundleSavings: counsellingEstimate.bundleSavings,
      baseBeforeDiscount: counsellingEstimate.baseBeforeDiscount,
      discountAmount: counsellingEstimate.discountAmount,
      discountType: mergedEstimate.discountType,
      discountValue: mergedEstimate.discountValue,
      finalPayable: counsellingEstimate.finalPayableAmount,
      isPackageMode: counsellingEstimate.isPackageMode,
      activeTemplate: counsellingEstimate.activeTemplate,
      procedureOverridePrice,
      procedureCatalogPrice: pdfVariant?.price ?? null,
      paymentType: paymentType || undefined,
      counsellorName: authUser
        ? `${authUser.firstName} ${authUser.lastName}`.trim()
        : undefined,
    });
  }, [
    session,
    sessionId,
    canPrintEstimate,
    selectedEye,
    selectedVariantId,
    selectedInvestigations,
    counsellingEstimate,
    mergedEstimate.discountType,
    mergedEstimate.discountValue,
    procedureOverridePrice,
    procedureVariants,
    paymentType,
    authUser,
  ]);

  const phaseInput = useMemo(
    (): CounsellingPhaseInput => ({
      selectedVariantId,
      hasActiveTemplate: !!counsellingEstimate.activeTemplate,
      selectedIolId,
      variantSubOption,
      iolOptionCount: iolOptions.length,
      paymentType,
      decision,
      schedule,
      counsellorNotes,
      patientRemarks,
      wantToSeeDoctor,
      interestedToUpgrade,
      notRequiredPreAuth,
    }),
    [
      selectedVariantId,
      counsellingEstimate.activeTemplate,
      selectedIolId,
      variantSubOption,
      iolOptions.length,
      paymentType,
      decision,
      schedule,
      counsellorNotes,
      patientRemarks,
      wantToSeeDoctor,
      interestedToUpgrade,
      notRequiredPreAuth,
    ],
  );

  const phaseCompletion = useMemo(
    () => computePhaseCompletion(phaseInput),
    [phaseInput],
  );

  const phaseValidationContext = useMemo(
    () => ({ ...phaseInput, procedureVariants }),
    [phaseInput, procedureVariants],
  );

  const phaseAdvanceError = useMemo(
    () => validatePhase(activePhase, phaseValidationContext),
    [activePhase, phaseValidationContext],
  );

  const canAdvancePhase = !phaseAdvanceError;

  useEffect(() => {
    if (!session || phasesInitializedRef.current) return;
    if (sessionAppliedRef.current !== sessionId) return;

    const inferred = inferVisitedPhases(phaseInput);
    setVisitedPhases(Array.from(inferred));
    setActivePhase('estimate');
    phasesInitializedRef.current = true;
  }, [session, sessionId, phaseInput]);

  const markPhaseVisited = useCallback((phase: CounsellingPhase) => {
    setVisitedPhases((prev) => (prev.includes(phase) ? prev : [...prev, phase]));
  }, []);

  const goToPhase = useCallback(
    (phase: CounsellingPhase) => {
      const phaseIdx = COUNSELLING_PHASE_ORDER.indexOf(phase);
      const maxVisitedIdx = Math.max(
        ...visitedPhases.map((p) => COUNSELLING_PHASE_ORDER.indexOf(p)),
        0,
      );
      if (phaseIdx <= maxVisitedIdx + 1) {
        setActivePhase(phase);
        markPhaseVisited(phase);
      }
    },
    [visitedPhases, markPhaseVisited],
  );

  const goNext = useCallback(() => {
    const error = validatePhase(activePhase, phaseValidationContext);
    if (error) {
      toast.error(error);
      return false;
    }
    markPhaseVisited(activePhase);
    const nxt = nextPhase(activePhase);
    if (nxt) {
      setActivePhase(nxt);
      markPhaseVisited(nxt);
    }
    return true;
  }, [activePhase, phaseValidationContext, markPhaseVisited]);

  const goToPreviousPhase = useCallback(() => {
    const prev = prevPhase(activePhase);
    if (prev) setActivePhase(prev);
  }, [activePhase]);

  const canGoToPhase = useCallback(
    (phase: CounsellingPhase) => {
      const phaseIdx = COUNSELLING_PHASE_ORDER.indexOf(phase);
      const maxVisitedIdx = Math.max(
        ...visitedPhases.map((p) => COUNSELLING_PHASE_ORDER.indexOf(p)),
        0,
      );
      return phaseIdx <= maxVisitedIdx + 1;
    },
    [visitedPhases],
  );

  const isDoneState = queueStatus === 'Done';
  const isRepeatState = queueStatus === 'RepeatCounselling';
  const isSurgeryDoneState = queueStatus === 'SurgeryDone';
  const isReadOnly = isRepeatState || isSurgeryDoneState;

  const saveDisabledReason = useMemo((): string | null => {
    if (isSurgeryDoneState) return 'Session is read-only';
    if (isSaving || isSavingDraft) return 'Saving session…';
    if (!decision) return 'Select a patient decision before saving';
    return null;
  }, [isSurgeryDoneState, isSaving, isSavingDraft, decision]);

  const saveDraftDisabledReason = useMemo((): string | null => {
    if (isSurgeryDoneState) return 'Session is read-only';
    if (isSaving || isSavingDraft) return 'Saving…';
    if (isRepeatState) return 'Start repeat session to continue';
    return null;
  }, [isSurgeryDoneState, isSaving, isSavingDraft, isRepeatState]);

  const printDisabledReason = useMemo((): string | null => {
    if (isRepeatState) return 'Start repeat session to continue';
    if (canPrintEstimate) return null;
    return 'Select a procedure or package to print an estimate';
  }, [canPrintEstimate, isRepeatState]);

  const showCoverageWorkflow = useMemo(
    () => isCoveragePaymentType(paymentType as string) && !notRequiredPreAuth,
    [paymentType, notRequiredPreAuth],
  );

  useEffect(() => {
    const patientId = session?.patientId;
    if (!patientId) {
      setPatientDetails(null);
      return;
    }

    let cancelled = false;
    setPatientDetailsLoading(true);
    void patientApi
      .getById(patientId)
      .then((patient) => {
        if (!cancelled) setPatientDetails(patient);
      })
      .catch(() => {
        if (!cancelled) setPatientDetails(null);
      })
      .finally(() => {
        if (!cancelled) setPatientDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.patientId]);

  const validateCounsellingForSave = useCallback((): boolean => {
    if (selectedVariantId) {
      const selVariant = findCounsellorVariant(procedureVariants, selectedVariantId);
      if (selVariant?.subOptions?.length && !selVariant.hasIolOptions && !variantSubOption) {
        toast.error('Please select a sub-type for the selected procedure');
        return false;
      }
      if (selVariant?.hasIolOptions && iolOptions.length > 0 && !selectedIolId) {
        toast.error('Please select an IOL for the selected procedure');
        return false;
      }
    }
    if (
      mergedEstimate.discountType &&
      mergedEstimate.discountValue > 0 &&
      !mergedEstimate.discountReason?.trim()
    ) {
      toast.error('Please enter a discount reason');
      return false;
    }
    return true;
  }, [
    selectedVariantId,
    procedureVariants,
    variantSubOption,
    iolOptions.length,
    selectedIolId,
    mergedEstimate.discountType,
    mergedEstimate.discountValue,
    mergedEstimate.discountReason,
  ]);

  // ── Session load / enrich ───────────────────────────────────────────────────
  useEffect(() => {
    sessionAppliedRef.current = null;
    investigationsHydratedRef.current = null;
    packageRestoredRef.current = null;
    phasesInitializedRef.current = false;
    setActivePhase('estimate');
    setVisitedPhases(['estimate']);
    setWorkspaceCcmsCaseNumber(undefined);
    setWorkspaceCcmsState(undefined);
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    setWorkspaceCcmsCaseNumber(session.ccmsCaseNumber);
    setWorkspaceCcmsState(session.ccmsCurrentState);
  }, [session?.id, session?.ccmsCaseNumber, session?.ccmsCurrentState]);

  const prevMainTabRef = useRef(activeMainTab);
  useEffect(() => {
    if (
      activeMainTab === 'coverage' ||
      showCoverageWorkflow ||
      !!workspaceCcmsCaseNumber ||
      !!session?.ccmsCaseNumber
    ) {
      setCoverageTabMounted(true);
    }
    if (activeMainTab === 'coverage') {
      if (prevMainTabRef.current !== 'coverage' && !isDirty) {
        setCoverageRefreshKey((k) => k + 1);
      }
    }
    prevMainTabRef.current = activeMainTab;
  }, [
    activeMainTab,
    isDirty,
    showCoverageWorkflow,
    workspaceCcmsCaseNumber,
    session?.ccmsCaseNumber,
  ]);

  useEffect(() => {
    let cancelled = false;

    const applySessionData = (data: CounsellingSession) => {
      setSession(data);
      setSelectedSurgeryId(data.selectedSurgeryId ?? null);

      let restoredVariantId: string | null = null;
      if (data.selectedSurgeryId?.startsWith('type-')) {
        const withoutPrefix = data.selectedSurgeryId.slice(5);
        const eyeMatch = withoutPrefix.match(/-(RE|LE|BE)$/);
        if (eyeMatch) {
          restoredVariantId = withoutPrefix.slice(0, -eyeMatch[0].length);
          setSelectedEye(eyeMatch[1] as 'RE' | 'LE' | 'BE');
        }
      } else if (data.restoredEye && data.restoredEye !== 'RE') {
        setSelectedEye(data.restoredEye as 'RE' | 'LE' | 'BE');
      }

      if (!restoredVariantId && data.selectedSurgeryId && data.surgeries?.length) {
        const matched = data.surgeries.find((s) => s.id === data.selectedSurgeryId);
        if (matched?.variantId) restoredVariantId = matched.variantId;
      }

      setSelectedVariantId(restoredVariantId);
      const derivedPT = derivePaymentType(data.paymentMode ?? '', data.patientType ?? '');
      setPaymentType(derivedPT);
      setInsuranceCompany(
        data.insuranceCompany ??
          (requiresInsuranceCompany(derivedPT as CombinedPaymentType) ? data.company ?? '' : ''),
      );
      setFreeSurgeryReason(data.freeSurgeryReason);
      setVariantSubOption(data.variantSubOption ?? null);
      setPackageName(data.packageName);
      setPackageRate(data.packageRate);
      setEstimateState({
        estimateMode: data.estimateMode ?? 'custom',
        packageTemplateId: data.packageTemplateId ?? null,
        discountType: data.discountType ?? null,
        discountValue: data.discountValue ?? 0,
        discountReason: data.discountReason ?? '',
        discountAmount: data.discountAmount ?? 0,
        itemizedSubtotal: data.itemizedSubtotal ?? 0,
        bundleSavings: data.bundleSavings ?? 0,
        finalPayableAmount: data.finalPayableAmount ?? 0,
      });
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
      savedSnapshotRef.current = buildCounsellingFieldSnapshot({
        paymentType: derivedPT,
        insuranceCompany:
          data.insuranceCompany ??
          (requiresInsuranceCompany(derivedPT as CombinedPaymentType) ? data.company ?? '' : ''),
        decision: data.decision ?? '',
        followUpReason: data.followUpReason ?? '',
        followUpDate: data.followUpDate ?? '',
        counsellorNotes: data.counsellorNotes ?? '',
        patientRemarks: data.patientRemarks ?? '',
        doctorNotes: data.doctorNotes ?? '',
        wantToSeeDoctor: data.wantToSeeDoctor ?? false,
        interestedToUpgrade: data.interestedToUpgrade ?? false,
        notRequiredPreAuth: data.notRequiredPreAuth ?? false,
        selectedSurgeryId: data.selectedSurgeryId ?? '',
        selectedEye: (data as CounsellingSession & { restoredEye?: string }).restoredEye ?? 'RE',
        packageName: data.packageName ?? '',
        packageRate: data.packageRate ?? '',
        scheduleDate: data.schedule?.selectedDate ?? '',
        mergedEstimate: {
          estimateMode: data.estimateMode ?? 'custom',
          packageTemplateId: data.packageTemplateId ?? null,
          discountType: data.discountType ?? null,
          discountValue: data.discountValue ?? 0,
          discountReason: data.discountReason ?? '',
          discountAmount: data.discountAmount ?? 0,
          itemizedSubtotal: data.itemizedSubtotal ?? 0,
          bundleSavings: data.bundleSavings ?? 0,
          finalPayableAmount: data.finalPayableAmount ?? 0,
        },
      });
    };

    const enrichSession = async (data: CounsellingSession) => {
      if ((data.status as string) === 'Done') {
        counsellorsDeskApi
          .getFinalizeList({ uhid: data.uhid })
          .then((otRecs) => {
            if (cancelled) return;
            const hit = otRecs.find((r) => r.counsellingSessionId === sessionId);
            if (hit) setExistingOtScheduleId(hit.id);
          })
          .catch(() => {});
      }

      try {
        const azureRecord = await counsellingAzureApi.getRecord(sessionId);
        if (cancelled || !azureRecord) return;
        if (!data.decision && azureRecord.decisionType) {
          const uiDecision: DecisionType =
            azureRecord.decisionType === 'NotInterested'
              ? 'NotInterested'
              : azureRecord.decisionType === 'NeedsTime'
                ? 'NeedsTime'
                : 'DateForSurgery';
          setDecision(uiDecision);
        }
        if (!data.schedule && azureRecord.scheduledDate) {
          setSchedule({
            selectedDate: azureRecord.scheduledDate.split('T')[0],
            operationTheatre: '',
            doctor: '',
            surgeryStartTime: '',
            avoidTimeFrom: '',
            avoidTimeTo: '',
          });
        }
        if (azureRecord.packageDetails) {
          try {
            const pkg = JSON.parse(azureRecord.packageDetails);
            if (pkg.name && !data.packageName) setPackageName(pkg.name);
            if (pkg.rate && !data.packageRate) setPackageRate(Number(pkg.rate) || '');
            if (pkg.paymentType && !data.paymentMode)
              setPaymentType(pkg.paymentType as CombinedPaymentType);
            if (pkg.insuranceCompany && !data.insuranceCompany)
              setInsuranceCompany(pkg.insuranceCompany);
            if (pkg.variantId && !data.selectedSurgeryId) {
              const eye = (pkg.eye ?? 'RE') as 'RE' | 'LE' | 'BE';
              setSelectedVariantId(pkg.variantId);
              setSelectedEye(eye);
              setSelectedSurgeryId(`type-${pkg.variantId}-${eye}`);
            }
          } catch {
            /* ignore */
          }
        }
        if (azureRecord.paymentType && !data.paymentMode)
          setPaymentType(azureRecord.paymentType as CombinedPaymentType);
        if (azureRecord.insuranceCompany && !data.insuranceCompany)
          setInsuranceCompany(azureRecord.insuranceCompany);
        if (azureRecord.followUpDate && !data.followUpDate)
          setFollowUpDate(azureRecord.followUpDate);
        if (azureRecord.followUpReason && !data.followUpReason)
          setFollowUpReason(azureRecord.followUpReason);
      } catch {
        /* Azure offline */
      }

      try {
        const overrideList = await counsellingAzureApi.getPriceOverrides(sessionId);
        if (!cancelled) setSavedOverrides(overrideList);
      } catch {
        /* non-critical */
      }

      if (data.status === 'Pending') counsellorsDeskApi.startSession(sessionId);
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
    return () => {
      cancelled = true;
    };
  }, [sessionId, sessionQuery.data, sessionQuery.isError]);

  useEffect(() => {
    if (applyingPackageRef.current) {
      prevVariantIdRef.current = selectedVariantId;
      return;
    }
    if (prevVariantIdRef.current !== null && prevVariantIdRef.current !== selectedVariantId) {
      setSelectedIolId(null);
    }
    prevVariantIdRef.current = selectedVariantId;
  }, [selectedVariantId]);

  useEffect(() => {
    if (!session) return;
    if (investigationsHydratedRef.current === session.id) return;

    const hasSavedInvestigations = (session.investigations?.length ?? 0) > 0;
    const hasSuggestedTests = (session.suggestedPreOpTests?.length ?? 0) > 0;
    if (!hasSavedInvestigations && !hasSuggestedTests) {
      investigationsHydratedRef.current = session.id;
      return;
    }

    const needsCatalogLookup = session.investigations?.some((inv) => !inv.catalogId) ?? false;
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
        allCatalogItems.map((c) => [c.name.toLowerCase().trim(), c.id]),
      );
      session.investigations!.forEach((inv) => {
        const resolvedCatalogId =
          inv.catalogId ??
          nameToId.get(inv.testName?.toLowerCase().trim() ?? '') ??
          inv.id;
        if (resolvedCatalogId) {
          map.set(resolvedCatalogId, { ...inv, catalogId: inv.catalogId ?? resolvedCatalogId });
        }
      });
      setSelectedInvestigations(map);
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
    }

    investigationsHydratedRef.current = session.id;
  }, [session, masterCatalogQuery.data]);

  useEffect(() => {
    if (!session) return;
    if (packageRestoredRef.current === session.id) return;
    if (estimateState.estimateMode !== 'package' || !estimateState.packageTemplateId) return;
    if (packageTemplates.length === 0) return;
    if (!masterCatalogQuery.data) return;

    const hasSavedInvestigations = (session.investigations?.length ?? 0) > 0;
    const investigationsPending =
      hasSavedInvestigations && investigationsHydratedRef.current !== session.id;
    if (investigationsPending) return;

    const restored = counsellingEstimate.restorePackage(estimateState.packageTemplateId);
    if (restored) packageRestoredRef.current = session.id;
  }, [
    session,
    estimateState.estimateMode,
    estimateState.packageTemplateId,
    packageTemplates,
    masterCatalogQuery.data,
    counsellingEstimate.restorePackage,
  ]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    return () => {
      if (!isSurgeryDoneRef.current) counsellingAzureApi.unlock(sessionId);
    };
  }, [sessionId]);

  const handleBack = useCallback(() => {
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
  }, [isDirty, showConfirmation, router]);

  const handleReEvaluate = useCallback(() => {
    showConfirmation({
      title: 'Re-evaluate Session',
      message:
        'Changing the procedure will restart the counselling process (Done → In Progress). Continue?',
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
  }, [sessionId, showConfirmation]);

  const handleStartRepeatSession = useCallback(async () => {
    try {
      await counsellorsDeskApi.startSession(sessionId, repeatSessionTypeCode);
      setSession((prev) => (prev ? { ...prev, sessionTypeCode: repeatSessionTypeCode } : prev));
      setQueueStatus('Processed');
      toast.success('Repeat counselling session started');
    } catch {
      toast.error('Failed to start repeat session');
    }
  }, [sessionId, repeatSessionTypeCode]);

  const handleSelectVariantId = useCallback(
    (id: string | null) => {
      setSelectedVariantId(id);
      if (!applyingPackageRef.current) counsellingEstimate.notifySelectionChange('procedure');
      markDirty();
    },
    [counsellingEstimate, markDirty],
  );

  const handleSelectSurgeryId = useCallback(
    (id: string | null) => {
      setSelectedSurgeryId(id);
      markDirty();
    },
    [markDirty],
  );

  const handleSelectEye = useCallback(
    (eye: 'RE' | 'LE' | 'BE') => {
      setSelectedEye(eye);
      counsellingEstimate.notifySelectionChange('eye');
      markDirty();
    },
    [counsellingEstimate, markDirty],
  );

  const handleSelectIolId = useCallback(
    (id: string | null) => {
      setSelectedIolId(id);
      counsellingEstimate.notifySelectionChange('iol');
      markDirty();
    },
    [counsellingEstimate, markDirty],
  );

  const handleVariantSubOption = useCallback(
    (opt: string | null) => {
      setVariantSubOption(opt);
      counsellingEstimate.notifySelectionChange('subOption');
      markDirty();
    },
    [counsellingEstimate, markDirty],
  );

  const toggleInvestigation = useCallback(
    (item: MasterCatalogItem) => {
      setSelectedInvestigations((prev) => {
        const next = new Map(prev);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.set(item.id, {
            catalogId: item.id,
            testName: item.name,
            testCode: item.code,
            testType: item.testType,
            price: item.price,
            urgency: 'Routine',
            source: 'counsellor',
            ...(item.testType !== 'Lab' ? { eye: selectedEye } : {}),
          });
        }
        return next;
      });
      counsellingEstimate.notifySelectionChange('investigation');
      markDirty();
    },
    [counsellingEstimate, markDirty, selectedEye],
  );

  const handleSaveDraft = useCallback(async () => {
    if (!session || saveDraftDisabledReason) return;

    if (activeMainTab === 'coverage') {
      if (!showCoverageWorkflow) return;
      setIsSavingDraft(true);
      try {
        const saved = await saveCoveragePanelDraft({ force: true });
        if (saved) {
          toast.success('Draft saved');
        }
      } finally {
        setIsSavingDraft(false);
      }
      return;
    }

    if (activeMainTab === 'outpatient') {
      setIsSavingDraft(true);
      try {
        await outpatientChecklistRef.current?.flushDraft({ silent: true });
      } finally {
        setIsSavingDraft(false);
      }
      return;
    }

    if (!validateCounsellingForSave()) return;

    setIsSavingDraft(true);
    try {
      await saveCounsellingDraft({
        sessionId,
        session,
        selectedSurgeryId,
        selectedVariantId,
        selectedEye,
        selectedIolId,
        variantSubOption,
        packageName,
        packageRate,
        paymentType,
        insuranceCompany,
        insuranceProviderId,
        freeSurgeryReason,
        decision,
        followUpReason,
        followUpDate,
        counsellorNotes,
        patientRemarks,
        doctorNotes,
        wantToSeeDoctor,
        interestedToUpgrade,
        notRequiredPreAuth,
        schedule,
        selectedInvestigations,
        mergedEstimate,
        savedSnapshot: savedSnapshotRef.current,
        isDoneState,
        onSuccess: (snapshot) => {
          savedSnapshotRef.current = snapshot;
          setIsDirty(false);
        },
        invalidateSession,
      });
      toast.success('Draft saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : getApiErrorMessage(err);
      toast.error(msg ? `Save failed: ${msg}` : 'Failed to save draft — check network tab');
    } finally {
      setIsSavingDraft(false);
    }
  }, [
    session,
    saveDraftDisabledReason,
    activeMainTab,
    showCoverageWorkflow,
    saveCoveragePanelDraft,
    validateCounsellingForSave,
    sessionId,
    selectedSurgeryId,
    selectedVariantId,
    selectedEye,
    selectedIolId,
    variantSubOption,
    packageName,
    packageRate,
    paymentType,
    insuranceCompany,
    insuranceProviderId,
    freeSurgeryReason,
    decision,
    followUpReason,
    followUpDate,
    counsellorNotes,
    patientRemarks,
    doctorNotes,
    wantToSeeDoctor,
    interestedToUpgrade,
    notRequiredPreAuth,
    schedule,
    selectedInvestigations,
    mergedEstimate,
    isDoneState,
    invalidateSession,
  ]);

  const handleSave = useCallback(async () => {
    if (!session) return;
    if (!selectedSurgeryId) {
      toast('No procedure selected — saving decision and notes only', { icon: '⚠️' });
    }
    if (!validateCounsellingForSave()) return;
    if (!decision) {
      toast.error('Please select a decision');
      return;
    }

    setIsSaving(true);
    try {
      if (showCoverageWorkflow && coveragePanelRef.current?.isDirty()) {
        await saveCoveragePanelDraft({ force: true });
      }
      await outpatientChecklistRef.current?.flushDraft({ silent: true });

      await saveCounsellingSession({
        sessionId,
        session,
        selectedSurgeryId,
        selectedVariantId,
        selectedEye,
        selectedIolId,
        variantSubOption,
        packageName,
        packageRate,
        paymentType,
        insuranceCompany,
        insuranceProviderId,
        freeSurgeryReason,
        decision,
        followUpReason,
        followUpDate,
        counsellorNotes,
        patientRemarks,
        doctorNotes,
        wantToSeeDoctor,
        interestedToUpgrade,
        notRequiredPreAuth,
        schedule,
        selectedInvestigations,
        mergedEstimate,
        savedSnapshot: savedSnapshotRef.current,
        isDoneState,
        existingOtScheduleId,
        onSuccess: ({ snapshot, queueStatus: nextStatus, openCoverageTab }) => {
          savedSnapshotRef.current = snapshot;
          setIsDirty(false);
          setQueueStatus(nextStatus);
          if (openCoverageTab) {
            setCoverageRefreshKey((k) => k + 1);
            setActiveMainTab('coverage');
          }
        },
        invalidateWaitingList,
        invalidateSession,
      });

      if (showCoverageWorkflow) {
        await saveCoveragePanelDraft({ force: true });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(msg ? `Save failed: ${msg}` : 'Failed to save session — check network tab');
    } finally {
      setIsSaving(false);
    }
  }, [
    session,
    selectedSurgeryId,
    validateCounsellingForSave,
    decision,
    sessionId,
    selectedVariantId,
    selectedEye,
    selectedIolId,
    variantSubOption,
    packageName,
    packageRate,
    paymentType,
    insuranceCompany,
    insuranceProviderId,
    freeSurgeryReason,
    followUpReason,
    followUpDate,
    counsellorNotes,
    patientRemarks,
    doctorNotes,
    wantToSeeDoctor,
    interestedToUpgrade,
    notRequiredPreAuth,
    schedule,
    selectedInvestigations,
    mergedEstimate,
    isDoneState,
    existingOtScheduleId,
    showCoverageWorkflow,
    saveCoveragePanelDraft,
    invalidateWaitingList,
    invalidateSession,
  ]);

  const handleScheduleSubmit = useCallback(
    (data: ScheduleData) => {
      setSchedule(data);
      markDirty();
      toast.success('Schedule set successfully');
    },
    [markDirty],
  );

  return {
    sessionId,
    session,
    isLoading,
    ConfirmationComponent,
    handleBack,
    queueStatus,
    isDirty,
    isDoneState,
    isRepeatState,
    isSurgeryDoneState,
    isReadOnly,
    isSaving,
    isSavingDraft,
    coveragePanelRef,
    outpatientChecklistRef,
    counsellingSyncSkipRef,
    applyCoverageWorkspaceSync,
    handleCaseWorkspaceChange,
    workspaceCcmsCaseNumber,
    workspaceCcmsState,
    patientDetails,
    patientDetailsLoading,
    workspaceIntegrationContext,
    showCoverageWorkflow,
    saveDraftDisabledReason,
    handleSaveDraft,
    activeMainTab,
    setActiveMainTab,
    coverageTabMounted,
    coverageRefreshKey,
    initialSubtab,
    paymentType,
    insuranceCompany,
    notRequiredPreAuth,
    packageName,
    packageRate,
    schedule,
    selectedEye,
    selectedInvestigations,
    counsellingEstimate,
    mergedEstimate,
    canPrintEstimate,
    printDisabledReason,
    estimatePdfData,
    estimatePrintOpen,
    setEstimatePrintOpen,
    handleSave,
    handleReEvaluate,
    handleStartRepeatSession,
    repeatSessionTypeCode,
    setRepeatSessionTypeCode,
    procedureVariants,
    procedureLoading,
    procedureError,
    loadProcedures,
    selectedVariantId,
    selectedSurgeryId,
    setSelectedEye: handleSelectEye,
    setSelectedVariantId: handleSelectVariantId,
    setSelectedSurgeryId: handleSelectSurgeryId,
    variantSubOption,
    setVariantSubOption: handleVariantSubOption,
    iolOptions,
    selectedIolId,
    setSelectedIolId: handleSelectIolId,
    setSelectedInvestigations,
    toggleInvestigation,
    masterCatalog,
    masterCatalogLoading,
    masterCatalogError,
    loadMasterCatalog,
    savedOverrides,
    setSavedOverrides,
    staffList,
    markDirty,
    insuranceProviderOptions,
    freeSurgeryReason,
    setFreeSurgeryReason,
    decision,
    setDecision,
    followUpReason,
    setFollowUpReason,
    followUpDate,
    setFollowUpDate,
    setIsScheduleModalOpen,
    counsellorNotes,
    setCounsellorNotes,
    patientRemarks,
    setPatientRemarks,
    doctorNotes,
    setDoctorNotes,
    openNotes,
    setOpenNotes,
    wantToSeeDoctor,
    setWantToSeeDoctor,
    interestedToUpgrade,
    setInterestedToUpgrade,
    setNotRequiredPreAuth,
    setPaymentType,
    setInsuranceCompany,
    setQueueStatus,
    packageTemplates,
    isScheduleModalOpen,
    handleScheduleSubmit,
    activePhase,
    visitedPhases,
    phaseCompletion,
    canAdvancePhase,
    phaseAdvanceError,
    saveDisabledReason,
    goToPhase,
    goNext,
    goToPreviousPhase,
    canGoToPhase,
    ...overrides,
  };
}

export type CounsellingSessionController = ReturnType<typeof useCounsellingSessionController>;
