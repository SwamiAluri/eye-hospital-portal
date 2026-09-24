'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { resolveCounsellingSessionCloseHref } from '@/lib/counsellors-desk/counselling-session-origin';
import { resolveCloseNavigation } from '@/lib/counsellors-desk/counselling-session-close';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi } from '@/lib/api/counselling-azure.api';
import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import { resolvePackageOverridePrice, resolveProcedureOverridePrice } from '@/lib/counsellors-desk/package-preview';
import { useAuthStore } from '@/lib/auth-store';
import {
  isCounsellingSessionOwner,
  isOwnershipReadOnly,
  isPendingLifecycleReadOnly,
  resolveCompleteSessionDisabledReason,
  resolveSaveDraftDisabledReason,
} from '@/lib/counsellors-desk/counselling-ownership';
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
import { resolveStaleIolSelection } from '@/lib/counsellors-desk/stale-iol-selection';
import {
  useCounsellorsMasterCatalogQuery,
  useStaffDirectoryQuery,
  useCounsellingSessionQuery,
  useInvalidateCounsellorsDesk,
} from '@/hooks/use-counsellors-desk-queries';
import {
  derivePaymentType,
  requiresInsuranceCompany,
  toCounsellingDateOnly,
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
import { validateDiscountForSave } from '@/lib/counsellors-desk/counselling-discount-contract';
import {
  buildCounsellingEstimatePdfData,
  canPrintCounsellingEstimate,
} from '@/lib/counsellors-desk/counselling-estimate-pdf-content';
import { formatScheduleSummary } from '@/lib/counsellors-desk/decision-workspace-presentation';
import { finishOutcomeHeadline } from '@/lib/counsellors-desk/counselling-finish-outcome';
import {
  buildFinishPatientNextSteps,
  eyeDisplayLabel,
  resolveFinishCoverageLabel,
} from '@/lib/counsellors-desk/counselling-finish-presentation';
import { useCounsellingOverrides } from '@/hooks/use-counselling-overrides';
import { buildCounsellingFieldSnapshot } from '@/lib/counsellors-desk/counselling-field-snapshot';
import { saveCounsellingSession } from '@/lib/counsellors-desk/save-counselling-session';
import {
  formatDecisionLabel,
  type CoverageProgressSnapshot,
} from '@/lib/counsellors-desk/session-status-summary';
import { saveCounsellingDraft } from '@/lib/counsellors-desk/save-counselling-draft';
import { fetchCounsellingSessionVersion } from '@/lib/counsellors-desk/sync-counselling-session-version';
import { planCounsellingDualDraftSave } from '@/lib/counsellors-desk/counselling-dual-draft-save';
import type {
  CoverageDraftSaveOptions,
  CoveragePreauthPanelHandle,
} from '@/components/counsellors-desk/coverage/coverage-preauth-panel-handle';
import type { OutpatientChecklistHandle } from '@/components/counsellors-desk/outpatient-checklist-handle';
import type { CounsellingWorkspaceSyncPatch } from '@/lib/counsellors-desk/counselling-coverage-workspace-sync';
import { patientApi, type Patient } from '@/lib/api/patients.api';
import { unwrapPatientApiResponse } from '@/lib/patients/patient-display-utils';
import {
  type CounsellingPhase,
  canNavigateToCounsellingPhase,
  computePhaseCompletion,
  inferVisitedPhases,
  isCoveragePaymentType,
  nextPhase,
  validatePhase,
  validatePhasesBefore,
  validateSaveSessionDecision,
  type CounsellingPhaseInput,
} from '@/lib/counsellors-desk/counselling-progress';
import { resolveSessionBackTarget } from '@/lib/counsellors-desk/counselling-session-navigation';
import { assertCounsellingStartReachedProcessing } from '@/lib/counsellors-desk/counselling-start-persistence';
import { isCounsellingTerminalOutcome, shouldAutoOpenFinishSummary } from '@/lib/counsellors-desk/counselling-finish-outcome';
import { resolveCounsellingPrintDisabledReason } from '@/lib/counsellors-desk/counselling-print-gate';
import { resolveMutationVersion } from '@/lib/counsellors-desk/session-version-authority';
import {
  composeCounsellorAdditionalNotes,
  parseCounsellorAdditionalNotes,
  type RequeueNoteEvent,
} from '@/lib/counsellors-desk/requeue-notes-presentation';
import {
  getSessionConcurrencyMessage,
  isSessionConcurrencyConflict,
} from '@/lib/counsellors-desk/session-concurrency';

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
  const searchParams = useSearchParams();
  const sessionFrom = searchParams.get('from');
  const sessionCloseHref = resolveCounsellingSessionCloseHref(sessionFrom);
  const { showConfirmation, ConfirmationComponent } = useConfirmation();
  const { invalidateWaitingList, invalidateSession } = useInvalidateCounsellorsDesk();
  const { options: insuranceProviderOptions } = useMasterValues('insurance.provider');
  const authUser = useAuthStore((s) => s.user);
  const lifecycleParam = searchParams.get('lifecycle');
  const lifecycleHandledRef = useRef<string | null>(null);
  /** Waiting List Start Repeat / Re-evaluate / Start Counseling entry. */
  const lifecycleEntry =
    lifecycleParam === 're-evaluate' ||
    lifecycleParam === 'start-repeat' ||
    lifecycleParam === 'start-counseling'
      ? lifecycleParam
      : null;

  const [session, setSession] = useState<CounsellingSession | null>(null);
  /**
   * Sync authoritative Version for mutations. React `session.version` updates are async — after
   * Start / Save Draft, an immediate Complete must not send the pre-mutation Version (false 409).
   */
  const sessionVersionRef = useRef<number | undefined>(undefined);
  /**
   * Phase 3I Slice 7 (PD-S7-01/06) — patch just `version` on local session state after a covered
   * mutation succeeds. Never overwrites other in-progress form fields (unlike a full session reload).
   */
  const updateSessionVersion = useCallback((version?: number) => {
    if (typeof version !== 'number') return;
    sessionVersionRef.current = version;
    setSession((prev) => (prev ? { ...prev, version } : prev));
  }, []);
  /** Refresh Version after CCMS/system writers without discarding dirty form fields. */
  const syncSessionVersionFromServer = useCallback(async () => {
    try {
      const version = await fetchCounsellingSessionVersion(sessionId);
      updateSessionVersion(version);
      return version;
    } catch {
      return undefined;
    }
  }, [sessionId, updateSessionVersion]);
  /** Fallback for mutations whose response does not echo the bumped Version (e.g. refresh-from-opd). */
  const bumpSessionVersionLocally = useCallback(() => {
    setSession((prev) => {
      if (!prev || typeof prev.version !== 'number') return prev;
      const next = prev.version + 1;
      sessionVersionRef.current = next;
      return { ...prev, version: next };
    });
  }, []);
  /** Session object with sync Version for CounselingSession writes. */
  const sessionForMutation = useCallback((): CounsellingSession | null => {
    if (!session) return null;
    const version = resolveMutationVersion(sessionVersionRef.current, session.version);
    return version === session.version ? session : { ...session, version };
  }, [session]);
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
  /** Historical ReQueue system lines — kept for AdditionalNotes compose; not shown in Notes UI. */
  const requeueNoteEventsRef = useRef<RequeueNoteEvent[]>([]);
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
  const [coverageProgress, setCoverageProgress] = useState<CoverageProgressSnapshot>({
    uploadedDocCount: 0,
    requiredDocCount: 0,
    ccmsState: null,
    preAuthSubmitted: false,
  });
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
  const [finishSummaryActive, setFinishSummaryActive] = useState(false);
  const phasesInitializedRef = useRef(false);

  const overrides = useCounsellingOverrides({ sessionId, setSavedOverrides });

  const masterCatalogQuery = useCounsellorsMasterCatalogQuery(!!session);
  const masterCatalog = masterCatalogQuery.data ?? EMPTY_MASTER_CATALOG;
  const masterCatalogLoading = masterCatalogQuery.isLoading;
  const masterCatalogError = masterCatalogQuery.isError;
  const loadMasterCatalog = useCallback(() => {
    void masterCatalogQuery.refetch();
  }, [masterCatalogQuery]);

  const procedureQuery = useCounsellorProcedureVariants(!!session);
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

  // Staff directory is optional (price-override "another staff" picker only).
  // Requires user.view — Counsellor baseline must not call /users/with-details.
  const staffQuery = useStaffDirectoryQuery(!!session);
  const staffList = staffQuery.data ?? EMPTY_STAFF_LIST;

  const markDirty = useCallback(() => setIsDirty(true), []);
  const { data: counsellingSettings } = useCounsellingSettings();
  // Package catalog requires package_templates.read. Do NOT fetch on session hydration —
  // load only when Quote → Package is opened (or when restoring a saved package estimate).
  const [packageCatalogRequested, setPackageCatalogRequested] = useState(false);
  const requestPackageCatalog = useCallback(() => setPackageCatalogRequested(true), []);
  const packageTemplatesQuery = useCounsellingPackageTemplates({
    enabled: packageCatalogRequested,
  });
  const packageTemplates = packageTemplatesQuery.data ?? [];
  const packageTemplatesAccessDenied = !packageTemplatesQuery.canReadPackageTemplates;

  const applyingPackageRef = useRef(false);
  const prevVariantIdRef = useRef<string | null>(null);

  const procedureOverridePrice = useMemo(
    () => resolveProcedureOverridePrice(savedOverrides, selectedVariantId),
    [savedOverrides, selectedVariantId],
  );

  const packageOverridePrice = useMemo(
    () => resolvePackageOverridePrice(savedOverrides, estimateState.packageTemplateId),
    [savedOverrides, estimateState.packageTemplateId],
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
    packageOverridePrice,
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

      if (patch.surgeryDate !== undefined) {
        const nextDate = toCounsellingDateOnly(patch.surgeryDate);
        const currentDate = schedule?.selectedDate ?? '';
        if (nextDate !== currentDate) {
          setSchedule((prev) => ({
            selectedDate: nextDate,
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
      schedule?.selectedDate,
      paymentType,
      markDirty,
    ],
  );

  const handleCaseWorkspaceChange = useCallback(
    (snapshot: { ccmsCaseNumber?: string; ccmsCurrentState?: string }) => {
      setWorkspaceCcmsCaseNumber((prev) =>
        prev === snapshot.ccmsCaseNumber ? prev : snapshot.ccmsCaseNumber,
      );
      setWorkspaceCcmsState((prev) =>
        prev === snapshot.ccmsCurrentState ? prev : snapshot.ccmsCurrentState,
      );
      // Coverage create/draft notifies Auth and bumps CounselingSession.Version — sync so
      // the next Save Draft does not 409 as a false "another user" conflict.
      void syncSessionVersionFromServer();
    },
    [syncSessionVersionFromServer],
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

  const phaseInput = useMemo(
    (): CounsellingPhaseInput => ({
      selectedVariantId,
      hasActiveTemplate: !!counsellingEstimate.activeTemplate,
      selectedIolId,
      variantSubOption,
      iolOptionCount: iolOptions.length,
      paymentType,
      insuranceCompany,
      decision,
      schedule,
      followUpReason,
      followUpDate,
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
      insuranceCompany,
      decision,
      schedule,
      followUpReason,
      followUpDate,
      counsellorNotes,
      patientRemarks,
      wantToSeeDoctor,
      interestedToUpgrade,
      notRequiredPreAuth,
    ],
  );

  const phaseValidationContext = useMemo(
    () => ({ ...phaseInput, procedureVariants }),
    [phaseInput, procedureVariants],
  );

  const phaseCompletion = useMemo(
    () => computePhaseCompletion(phaseValidationContext),
    [phaseValidationContext],
  );

  const phaseAdvanceError = useMemo(
    () => validatePhase(activePhase, phaseValidationContext),
    [activePhase, phaseValidationContext],
  );

  const canAdvancePhase = !phaseAdvanceError;

  useEffect(() => {
    if (!session || phasesInitializedRef.current) return;
    if (sessionAppliedRef.current !== sessionId) return;

    const inferred = inferVisitedPhases(phaseValidationContext);
    setVisitedPhases(Array.from(inferred));
    setActivePhase('estimate');
    phasesInitializedRef.current = true;
  }, [session, sessionId, phaseValidationContext]);

  const markPhaseVisited = useCallback((phase: CounsellingPhase) => {
    setVisitedPhases((prev) => (prev.includes(phase) ? prev : [...prev, phase]));
  }, []);

  const goToPhase = useCallback(
    (phase: CounsellingPhase) => {
      if (queueStatus === 'RepeatCounselling' || queueStatus === 'SurgeryDone') return;
      if (
        !canNavigateToCounsellingPhase(
          phase,
          activePhase,
          phaseValidationContext,
          phaseCompletion,
        )
      ) {
        const error = validatePhasesBefore(phase, phaseValidationContext);
        toast.error(error ?? 'Complete the current step before continuing');
        return;
      }
      setActivePhase(phase);
      markPhaseVisited(phase);
    },
    [activePhase, phaseCompletion, phaseValidationContext, markPhaseVisited, queueStatus],
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

  const canGoToPhase = useCallback(
    (phase: CounsellingPhase) => {
      if (queueStatus === 'RepeatCounselling' || queueStatus === 'SurgeryDone') return false;
      return canNavigateToCounsellingPhase(
        phase,
        activePhase,
        phaseValidationContext,
        phaseCompletion,
      );
    },
    [activePhase, phaseCompletion, phaseValidationContext, queueStatus],
  );

  const isDoneState = queueStatus === 'Done';
  const isRepeatState = queueStatus === 'RepeatCounselling';
  const isSurgeryDoneState = queueStatus === 'SurgeryDone';
  const isAddOnState = queueStatus === 'AddOnSurgery';
  const isSessionOwner = isCounsellingSessionOwner(session?.counselorId, authUser?.id);
  const ownershipLocksMutations = isOwnershipReadOnly({
    counselorId: session?.counselorId,
    currentUserId: authUser?.id,
    queueStatus,
  });
  /** PD-PENDING-READONLY-01: Pending is sealed until Auth StartSession (Start Counseling). */
  const pendingLocksMutations = isPendingLifecycleReadOnly(queueStatus);
  /** Terminal counselling outcomes are sealed until Re-evaluate / reopen.
   * FE ownership/pending read-only is UX enforcement; backend UpdateSession also guards pre-start. */
  const isReadOnly =
    isRepeatState ||
    isSurgeryDoneState ||
    isDoneState ||
    isAddOnState ||
    finishSummaryActive ||
    ownershipLocksMutations ||
    pendingLocksMutations;

  const saveDisabledReason = useMemo((): string | null => {
    return resolveCompleteSessionDisabledReason({
      isSurgeryDoneState,
      pendingLocksMutations,
      ownershipLocksMutations,
      isSaving,
      isSavingDraft,
      decisionValidationError: validateSaveSessionDecision(phaseInput),
    });
  }, [
    isSurgeryDoneState,
    pendingLocksMutations,
    ownershipLocksMutations,
    isSaving,
    isSavingDraft,
    phaseInput,
  ]);

  const saveDraftDisabledReason = useMemo((): string | null => {
    return resolveSaveDraftDisabledReason({
      isSurgeryDoneState,
      pendingLocksMutations,
      ownershipLocksMutations,
      isSaving,
      isSavingDraft,
      isRepeatState,
    });
  }, [
    isSurgeryDoneState,
    pendingLocksMutations,
    ownershipLocksMutations,
    isSaving,
    isSavingDraft,
    isRepeatState,
  ]);

  const printDisabledReason = useMemo(
    (): string | null =>
      resolveCounsellingPrintDisabledReason({
        isRepeatState,
        finishSummaryActive,
        canPrintEstimate,
      }),
    [canPrintEstimate, isRepeatState, finishSummaryActive],
  );

  const showCoverageWorkflow = useMemo(
    () => isCoveragePaymentType(paymentType as string) && !notRequiredPreAuth,
    [paymentType, notRequiredPreAuth],
  );

  /** Insurance tab stays openable for coverage payment types even when pre-auth is not required. */
  const coverageTabAvailable = useMemo(
    () => isCoveragePaymentType(paymentType as string),
    [paymentType],
  );

  const estimatePdfData = useMemo(() => {
    if (!session || !canPrintEstimate) return null;
    const pdfVariant = findCounsellorVariant(procedureVariants, selectedVariantId);
    const scheduleSummary = formatScheduleSummary(schedule);
    const coverageLabel = resolveFinishCoverageLabel({
      showCoverageWorkflow,
      notRequiredPreAuth,
      coverageProgress,
    });
    const docsSummary =
      coverageProgress.requiredDocCount > 0
        ? `${coverageProgress.uploadedDocCount}/${coverageProgress.requiredDocCount} received`
        : undefined;
    const notesRecorded = [counsellorNotes, patientRemarks, doctorNotes].some((n) => n.trim());
    const fundingSource = insuranceCompany.trim()
      ? `${paymentType || '—'} · ${insuranceCompany.trim()}`
      : paymentType || undefined;
    const summaryExtras = finishSummaryActive
      ? {
          documentKind: 'counselling-summary' as const,
          procedureName: pdfVariant?.name,
          eyeLabel: eyeDisplayLabel(selectedEye),
          surgeonName: schedule?.doctor || undefined,
          scheduleSummary: scheduleSummary || undefined,
          operationTheatre: schedule?.operationTheatre || undefined,
          decisionLabel: decision ? formatDecisionLabel(decision as DecisionType) : undefined,
          outcomeLabel: finishOutcomeHeadline(queueStatus),
          fundingSource,
          insurerName: insuranceCompany.trim() || undefined,
          coverageStatusLabel: showCoverageWorkflow || notRequiredPreAuth ? coverageLabel : undefined,
          documentsSummary: docsSummary,
          notesRecorded,
          nextSteps: buildFinishPatientNextSteps({
            queueStatus,
            scheduleSummary,
            showCoverageWorkflow,
            coverageLabel,
            preAuthSubmitted: coverageProgress.preAuthSubmitted,
            docsIncomplete:
              coverageProgress.requiredDocCount > 0 &&
              coverageProgress.uploadedDocCount < coverageProgress.requiredDocCount,
          }),
        }
      : { documentKind: 'estimate' as const };

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
      ...summaryExtras,
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
    finishSummaryActive,
    schedule,
    showCoverageWorkflow,
    notRequiredPreAuth,
    coverageProgress,
    counsellorNotes,
    patientRemarks,
    doctorNotes,
    insuranceCompany,
    decision,
    queueStatus,
  ]);

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
      .then((response) => {
        if (!cancelled) setPatientDetails(unwrapPatientApiResponse(response));
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
      if (selVariant?.subOptions?.length && !variantSubOption) {
        toast.error('Please select a sub-type for the selected procedure');
        return false;
      }
      if (
        selVariant?.hasIolOptions &&
        !(selVariant.subOptions?.length) &&
        iolOptions.length > 0 &&
        !selectedIolId
      ) {
        toast.error('Please select an IOL for the selected procedure');
        return false;
      }
    }
    const discountError = validateDiscountForSave({
      discountType: mergedEstimate.discountType,
      discountValue: mergedEstimate.discountValue,
      discountReason: mergedEstimate.discountReason ?? '',
    });
    if (discountError) {
      toast.error(discountError);
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
      if (typeof data.version === 'number') {
        sessionVersionRef.current = data.version;
      }
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
      setSelectedIolId(data.selectedIolId ?? null);
      prevVariantIdRef.current = restoredVariantId;
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
      setSchedule(
        data.schedule
          ? { ...data.schedule, selectedDate: toCounsellingDateOnly(data.schedule.selectedDate) }
          : null,
      );
      const parsedNotes = parseCounsellorAdditionalNotes(data.counsellorNotes);
      setCounsellorNotes(parsedNotes.workingNotes);
      requeueNoteEventsRef.current = parsedNotes.requeueEvents;
      setPatientRemarks(data.patientRemarks);
      setDoctorNotes(data.doctorNotes);
      setWantToSeeDoctor(data.wantToSeeDoctor);
      setInterestedToUpgrade(data.interestedToUpgrade);
      setNotRequiredPreAuth(data.notRequiredPreAuth);
      setQueueStatus((data.status as WaitingListStatus) || 'Pending');
      const status = (data.status as WaitingListStatus) || 'Pending';
      setFinishSummaryActive(
        shouldAutoOpenFinishSummary(status, status === 'SurgeryDone'),
      );
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
        counsellorNotes: parsedNotes.workingNotes,
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
            selectedDate: toCounsellingDateOnly(azureRecord.scheduledDate),
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
            // Secondary restore when auth blob lacked lens fields (Azure enrichment).
            if (pkg.selectedIolId && !data.selectedIolId) {
              setSelectedIolId(String(pkg.selectedIolId));
            }
            if (pkg.variantSubOption && !data.variantSubOption) {
              setVariantSubOption(String(pkg.variantSubOption));
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

  /**
   * Drop stale IOL once catalogs are authoritative — never while procedure/IOL
   * catalogs are still loading (hydration race would wipe a restored selection).
   */
  useEffect(() => {
    if (applyingPackageRef.current) return;
    const action = resolveStaleIolSelection({
      selectedIolId,
      selectedVariantId,
      procedureVariants,
      procedureCatalogReady: !procedureLoading,
      iolOptions,
      iolOptionsReady: !iolPricing.loading,
    });
    if (action === 'clear') {
      setSelectedIolId(null);
    }
  }, [
    selectedIolId,
    selectedVariantId,
    procedureVariants,
    procedureLoading,
    iolOptions,
    iolPricing.loading,
  ]);

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
    // Need catalog to restore a previously selected package — request lazily.
    if (!packageCatalogRequested) {
      setPackageCatalogRequested(true);
      return;
    }
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
    packageCatalogRequested,
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
    // Legacy leave path (Quote no longer uses Back to exit — Close does).
    if (isDirty) {
      showConfirmation({
        title: counsellingCopy.unsavedChangesTitle,
        message: counsellingCopy.unsavedChangesMessage,
        variant: 'warning',
        confirmText: counsellingCopy.leaveWithoutSaving,
        cancelText: 'Cancel',
        onConfirm: () => router.push(sessionCloseHref),
      });
      return;
    }
    router.push(sessionCloseHref);
  }, [isDirty, showConfirmation, router, sessionCloseHref]);

  const goToPreviousPhase = useCallback(() => {
    const target = resolveSessionBackTarget({
      activeMainTab,
      activePhase,
      showCoverageWorkflow,
      coverageTabAvailable,
      finishSummaryActive,
    });
    if (!target) return;
    if (target.leaveSession) {
      handleBack();
      return;
    }
    if (typeof target.finishSummaryActive === 'boolean') {
      setFinishSummaryActive(target.finishSummaryActive);
    }
    if (target.tab) setActiveMainTab(target.tab);
    if (target.phase) setActivePhase(target.phase);
  }, [
    activeMainTab,
    activePhase,
    showCoverageWorkflow,
    coverageTabAvailable,
    finishSummaryActive,
    handleBack,
  ]);
  const openFinishSummary = useCallback(() => {
    setFinishSummaryActive(true);
    setActiveMainTab('counselling');
    setActivePhase('wrapup');
  }, []);

  const executeReEvaluate = useCallback(async () => {
    const mutationSession = sessionForMutation();
    try {
      // Auth StartSession is authoritative (Completed → InProgress, clear agreement flags).
      // Waiting List projects Processing from Auth queue — Azure alone must not drive status.
      const started = await counsellorsDeskApi.startSession(
        sessionId,
        undefined,
        mutationSession?.version,
      );
      updateSessionVersion(started.version);
      // Azure enrichment (Done → Processed) — best-effort; API client already swallows errors.
      await counsellingAzureApi.reEvaluate(sessionId);
      setQueueStatus('Processed');
      setFinishSummaryActive(false);
      setActiveMainTab('counselling');
      setActivePhase('estimate');
      setVisitedPhases(['estimate']);
      phasesInitializedRef.current = false;
      invalidateWaitingList();
      invalidateSession(sessionId);
      toast.success('Session reopened for re-evaluation');
    } catch (err) {
      // Phase 3I Slice 7 (PD-S7-06): stop on 409 — never overwrite; no auto-retry.
      if (isSessionConcurrencyConflict(err)) {
        toast.error(getSessionConcurrencyMessage(err));
        invalidateSession(sessionId);
        try {
          const fresh = await counsellorsDeskApi.getSession(sessionId, { skipCatalogFallback: true });
          updateSessionVersion(fresh.version);
        } catch {
          /* best-effort */
        }
        return;
      }
      toast.error('Failed to re-open session');
    }
  }, [sessionId, sessionForMutation, updateSessionVersion, invalidateWaitingList, invalidateSession]);

  const handleReEvaluate = useCallback(() => {
    if (!isCounsellingSessionOwner(session?.counselorId, authUser?.id)) {
      toast.error('Only the assigned counsellor can re-evaluate this session');
      return;
    }
    showConfirmation({
      title: 'Re-evaluate Session',
      message:
        'Changing the procedure will restart the counselling process (Done → In Progress). Continue?',
      variant: 'warning',
      confirmText: 'Continue',
      onConfirm: () => {
        void executeReEvaluate();
      },
    });
  }, [
    session?.counselorId,
    authUser?.id,
    showConfirmation,
    executeReEvaluate,
  ]);

  const handleStartRepeatSession = useCallback(async () => {
    if (!isCounsellingSessionOwner(session?.counselorId, authUser?.id)) {
      toast.error('Only the assigned counsellor can start repeat counselling');
      return;
    }
    const mutationSession = sessionForMutation();
    try {
      const started = await counsellorsDeskApi.startSession(
        sessionId,
        repeatSessionTypeCode,
        mutationSession?.version,
      );
      updateSessionVersion(started.version);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              sessionTypeCode: repeatSessionTypeCode,
              version:
                typeof started.version === 'number'
                  ? started.version
                  : resolveMutationVersion(sessionVersionRef.current, prev.version),
            }
          : prev,
      );
      setQueueStatus('Processed');
      setFinishSummaryActive(false);
      setActiveMainTab('counselling');
      setActivePhase('estimate');
      setVisitedPhases(['estimate']);
      phasesInitializedRef.current = false;
      invalidateWaitingList();
      invalidateSession(sessionId);
      toast.success('Repeat counselling session started');
    } catch (err) {
      // Phase 3I Slice 7 (PD-S7-06): stop on 409 — never overwrite; no auto-retry.
      if (isSessionConcurrencyConflict(err)) {
        toast.error(getSessionConcurrencyMessage(err));
        invalidateSession(sessionId);
        try {
          const fresh = await counsellorsDeskApi.getSession(sessionId, { skipCatalogFallback: true });
          updateSessionVersion(fresh.version);
        } catch {
          /* best-effort */
        }
        return;
      }
      toast.error('Failed to start repeat session');
    }
  }, [
    session?.counselorId,
    authUser?.id,
    sessionId,
    repeatSessionTypeCode,
    sessionForMutation,
    updateSessionVersion,
    invalidateWaitingList,
    invalidateSession,
  ]);

  /** Pending Start Counseling — Auth StartSession (Waiting → InProgress). No ownership stamp. */
  const handleStartCounselingSession = useCallback(async (): Promise<boolean> => {
    if (!isCounsellingSessionOwner(session?.counselorId, authUser?.id)) {
      toast.error('Only the assigned counsellor can start counselling');
      return false;
    }
    const mutationSession = sessionForMutation();
    try {
      // Prefer Start response Version immediately (sync ref) — do not wait for a second mutation.
      const startedOp = await counsellorsDeskApi.startSession(
        sessionId,
        undefined,
        mutationSession?.version,
      );
      updateSessionVersion(startedOp.version);
      // Verify Auth queue projection — do not show Processing if Waiting List would still be Pending.
      // Also confirm Version when the Start body nested Session is incomplete.
      const started = await counsellorsDeskApi.getSession(sessionId, {
        skipCatalogFallback: true,
      });
      assertCounsellingStartReachedProcessing(started.status);
      updateSessionVersion(started.version ?? startedOp.version);
      setQueueStatus('Processed');
      setFinishSummaryActive(false);
      setActiveMainTab('counselling');
      setActivePhase('estimate');
      setVisitedPhases(['estimate']);
      phasesInitializedRef.current = false;
      invalidateWaitingList();
      invalidateSession(sessionId);
      toast.success('Counselling session started');
      return true;
    } catch (err) {
      // Phase 3I Slice 7 (PD-S7-06): stop on 409 — never overwrite; no auto-retry.
      if (isSessionConcurrencyConflict(err)) {
        toast.error(getSessionConcurrencyMessage(err));
        invalidateSession(sessionId);
        try {
          const fresh = await counsellorsDeskApi.getSession(sessionId, { skipCatalogFallback: true });
          updateSessionVersion(fresh.version);
        } catch {
          /* best-effort */
        }
        return false;
      }
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to start counselling session';
      toast.error(msg);
      return false;
    }
  }, [
    session?.counselorId,
    authUser?.id,
    sessionId,
    sessionForMutation,
    updateSessionVersion,
    invalidateWaitingList,
    invalidateSession,
  ]);

  // Waiting List Re-evaluate CTA — enter Re-evaluate directly (no second confirmation).
  useEffect(() => {
    if (!session || lifecycleParam !== 're-evaluate') return;
    if (lifecycleHandledRef.current === `${sessionId}:re-evaluate`) return;
    if (queueStatus !== 'Done') return;
    if (!isCounsellingSessionOwner(session.counselorId, authUser?.id)) return;
    lifecycleHandledRef.current = `${sessionId}:re-evaluate`;
    void executeReEvaluate();
  }, [
    session,
    lifecycleParam,
    sessionId,
    queueStatus,
    authUser?.id,
    executeReEvaluate,
  ]);

  // Waiting List Start Repeat CTA — enter Start Repeat directly (no second banner/prompt).
  useEffect(() => {
    if (!session || lifecycleParam !== 'start-repeat') return;
    if (lifecycleHandledRef.current === `${sessionId}:start-repeat`) return;
    if (queueStatus !== 'RepeatCounselling') return;
    if (!isCounsellingSessionOwner(session.counselorId, authUser?.id)) return;
    lifecycleHandledRef.current = `${sessionId}:start-repeat`;
    void handleStartRepeatSession();
  }, [
    session,
    lifecycleParam,
    sessionId,
    queueStatus,
    authUser?.id,
    handleStartRepeatSession,
  ]);

  // Waiting List Start Counseling CTA — Pending → Processing (no silent start on View/direct URL).
  useEffect(() => {
    if (!session || lifecycleParam !== 'start-counseling') return;
    if (lifecycleHandledRef.current === `${sessionId}:start-counseling`) return;
    if (queueStatus !== 'Pending') return;
    if (!isCounsellingSessionOwner(session.counselorId, authUser?.id)) return;
    lifecycleHandledRef.current = `${sessionId}:start-counseling`;
    void handleStartCounselingSession().then((ok) => {
      // Allow retry if Auth queue was not actually moved to InProgress.
      if (!ok) lifecycleHandledRef.current = null;
    });
  }, [
    session,
    lifecycleParam,
    sessionId,
    queueStatus,
    authUser?.id,
    handleStartCounselingSession,
  ]);

  const handleSelectVariantId = useCallback(
    (id: string | null) => {
      setSelectedVariantId((prev) => {
        if (prev === id) return prev;
        if (!applyingPackageRef.current) {
          queueMicrotask(() => counsellingEstimate.notifySelectionChange('procedure'));
        }
        return id;
      });
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

  const handleSaveDraft = useCallback(async (): Promise<boolean> => {
    const mutationSession = sessionForMutation();
    if (!mutationSession || saveDraftDisabledReason) {
      if (saveDraftDisabledReason) toast.error(saveDraftDisabledReason);
      return false;
    }

    const coveragePanelReady = Boolean(coveragePanelRef.current?.saveDraft);
    const coverageDraftEditable = coveragePanelRef.current?.isCoverageDraftEditable
      ? coveragePanelRef.current.isCoverageDraftEditable()
      : true;

    const plan = planCounsellingDualDraftSave({
      draftDisabled: false,
      coverageWorkflowActive: showCoverageWorkflow,
      coveragePanelReady,
      coverageEditable: coverageDraftEditable,
      flushOutpatient: true,
    });

    if (!plan.saveCounselling && !plan.saveCoverage && !plan.flushOutpatient) return false;

    if (plan.saveCounselling && !validateCounsellingForSave()) return false;

    const notesForPersist = composeCounsellorAdditionalNotes(
      requeueNoteEventsRef.current,
      counsellorNotes,
    );

    setIsSavingDraft(true);
    let counsellingSaved = false;
    let coverageSaved = false;
    try {
      // Insurance/CCMS may have advanced Version via Auth callback while this page stayed open.
      if (showCoverageWorkflow || coverageTabMounted) {
        await syncSessionVersionFromServer();
      }

      if (plan.saveCounselling) {
        // Re-resolve mutation session after Version sync so PUT uses the authoritative token.
        const counsellingMutationSession = sessionForMutation() ?? mutationSession;
        await saveCounsellingDraft({
          sessionId,
          session: counsellingMutationSession,
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
          counsellorNotes: notesForPersist,
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
          onSuccess: (snapshot, version) => {
            savedSnapshotRef.current = snapshot;
            setIsDirty(false);
            updateSessionVersion(version);
          },
          onConcurrencyVersionSync: updateSessionVersion,
          invalidateSession,
        });
        counsellingSaved = true;
      }

      if (plan.saveCoverage) {
        coverageSaved = await saveCoveragePanelDraft({ force: true });
        // Coverage draft save notifies Auth and bumps Version — sync before leaving the flow.
        await syncSessionVersionFromServer();
      } else if (plan.coverageSoftWarn) {
        toast('Counselling draft saved; open Insurance to save coverage details', {
          icon: 'ℹ️',
        });
      }

      if (plan.flushOutpatient) {
        await outpatientChecklistRef.current?.flushDraft({ silent: true });
      }

      if (counsellingSaved && coverageSaved) {
        toast.success('Draft saved');
      } else if (counsellingSaved && (plan.coverageSkippedLocked || (!plan.saveCoverage && !plan.coverageSoftWarn))) {
        toast.success('Draft saved');
      } else if (counsellingSaved && plan.saveCoverage && !coverageSaved) {
        toast.success('Counselling draft saved');
        toast.error('Coverage draft could not be saved');
      } else if (!counsellingSaved && coverageSaved) {
        toast.success('Coverage draft saved');
      }

      return counsellingSaved || coverageSaved;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : getApiErrorMessage(err);
      toast.error(msg ? `Save failed: ${msg}` : 'Failed to save draft — check network tab');
      return false;
    } finally {
      setIsSavingDraft(false);
    }
  }, [
    sessionForMutation,
    saveDraftDisabledReason,
    showCoverageWorkflow,
    coverageTabMounted,
    syncSessionVersionFromServer,
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
    updateSessionVersion,
  ]);

  const handleSaveDraftRef = useRef(handleSaveDraft);
  handleSaveDraftRef.current = handleSaveDraft;

  const handleClose = useCallback(() => {
    const decision = resolveCloseNavigation({ isDirty });
    if (decision.action === 'navigate') {
      router.push(sessionCloseHref);
      return;
    }

    showConfirmation({
      title: counsellingCopy.unsavedChangesTitle,
      message: counsellingCopy.unsavedChangesMessage,
      variant: 'warning',
      confirmText: counsellingCopy.saveAndClose,
      alternateText: counsellingCopy.leaveWithoutSaving,
      cancelText: 'Cancel',
      onConfirm: async () => {
        const saved = await handleSaveDraftRef.current();
        if (!saved) {
          throw new Error('Draft save failed');
        }
        router.push(sessionCloseHref);
      },
      onAlternate: () => {
        router.push(sessionCloseHref);
      },
    });
  }, [isDirty, showConfirmation, router, sessionCloseHref]);

  const handleSave = useCallback(async () => {
    const mutationSession = sessionForMutation();
    if (!mutationSession) return;
    if (saveDisabledReason) {
      toast.error(saveDisabledReason);
      return;
    }
    if (!selectedSurgeryId) {
      toast('No procedure selected — saving decision and notes only', { icon: '⚠️' });
    }
    if (!validateCounsellingForSave()) return;
    const saveDecisionError = validateSaveSessionDecision(phaseInput);
    if (saveDecisionError) {
      toast.error(saveDecisionError);
      return;
    }

    const notesForPersist = composeCounsellorAdditionalNotes(
      requeueNoteEventsRef.current,
      counsellorNotes,
    );

    setIsSaving(true);
    try {
      if (showCoverageWorkflow && coveragePanelRef.current?.isDirty()) {
        await saveCoveragePanelDraft({ force: true });
      }
      await outpatientChecklistRef.current?.flushDraft({ silent: true });

      await saveCounsellingSession({
        sessionId,
        session: mutationSession,
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
        counsellorNotes: notesForPersist,
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
        onSuccess: ({ snapshot, queueStatus: nextStatus, openCoverageTab, version }) => {
          savedSnapshotRef.current = snapshot;
          setIsDirty(false);
          setQueueStatus(nextStatus);
          updateSessionVersion(version);
          if (isCounsellingTerminalOutcome(nextStatus)) {
            setFinishSummaryActive(true);
            setActivePhase('wrapup');
            setActiveMainTab('counselling');
          } else if (openCoverageTab) {
            setCoverageRefreshKey((k) => k + 1);
            setActiveMainTab('coverage');
          }
        },
        onConcurrencyVersionSync: updateSessionVersion,
        invalidateWaitingList,
        invalidateSession,
      });

      if (showCoverageWorkflow) {
        const editable = coveragePanelRef.current?.isCoverageDraftEditable?.() ?? true;
        if (coveragePanelRef.current?.saveDraft && editable) {
          await saveCoveragePanelDraft({ force: true });
          await syncSessionVersionFromServer();
        } else if (!coveragePanelRef.current?.saveDraft) {
          toast('Session completed; open Insurance to sync coverage draft', { icon: 'ℹ️' });
        }
        // Locked coverage (Waiting for TPA): skip silently — counselling session already completed.
      }
    } catch (err: unknown) {
      // Prefer explicit Error.message (e.g. FS-01 OT handoff) over nested axios payloads.
      const plain =
        err instanceof Error && err.message.trim() ? err.message.trim() : undefined;
      const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      if (
        plain?.startsWith('Counselling details were saved') ||
        plain?.startsWith('Counselling details were saved, but the')
      ) {
        toast.error(plain);
      } else {
        const msg = axiosMsg || plain;
        toast.error(msg ? `Complete failed: ${msg}` : 'Failed to complete session — check network tab');
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    sessionForMutation,
    saveDisabledReason,
    selectedSurgeryId,
    validateCounsellingForSave,
    phaseInput,
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
    existingOtScheduleId,
    showCoverageWorkflow,
    saveCoveragePanelDraft,
    syncSessionVersionFromServer,
    invalidateWaitingList,
    invalidateSession,
    updateSessionVersion,
  ]);

  const handleScheduleSubmit = useCallback(
    (data: ScheduleData) => {
      setSchedule({
        ...data,
        selectedDate: toCounsellingDateOnly(data.selectedDate),
      });
      markDirty();
      toast.success('Schedule set successfully');
    },
    [markDirty],
  );

  const handleCoverageProgressChange = useCallback((progress: CoverageProgressSnapshot) => {
    setCoverageProgress((prev) => {
      if (
        prev.uploadedDocCount === progress.uploadedDocCount &&
        prev.requiredDocCount === progress.requiredDocCount &&
        prev.ccmsState === progress.ccmsState &&
        prev.preAuthSubmitted === progress.preAuthSubmitted &&
        prev.canSubmitToClaims === progress.canSubmitToClaims &&
        prev.submittingToClaims === progress.submittingToClaims
      ) {
        return prev;
      }
      return progress;
    });
  }, []);

  return {
    sessionId,
    session,
    isLoading,
    ConfirmationComponent,
    /** Phase 3I Slice 7 (PD-S7-01) — patch local Version after out-of-band mutations (refresh-from-opd, comm log). */
    updateSessionVersion,
    bumpSessionVersionLocally,
    handleBack,
    handleClose,
    sessionFrom,
    sessionCloseHref,
    queueStatus,
    isDirty,
    isDoneState,
    isRepeatState,
    isSurgeryDoneState,
    isReadOnly,
    isSessionOwner,
    ownershipLocksMutations,
    lifecycleEntry,
    isSaving,
    isSavingDraft,
    coveragePanelRef,
    outpatientChecklistRef,
    counsellingSyncSkipRef,
    applyCoverageWorkspaceSync,
    handleCaseWorkspaceChange,
    workspaceCcmsCaseNumber,
    workspaceCcmsState,
    coverageProgress,
    handleCoverageProgressChange,
    patientDetails,
    patientDetailsLoading,
    workspaceIntegrationContext,
    showCoverageWorkflow,
    coverageTabAvailable,
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
    packageTemplatesAccessDenied,
    requestPackageCatalog,
    isScheduleModalOpen,
    handleScheduleSubmit,
    activePhase,
    finishSummaryActive,
    setFinishSummaryActive,
    openFinishSummary,
    visitedPhases,
    phaseCompletion,
    phaseValidationContext,
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
