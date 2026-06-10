'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useHasPermission } from '@/hooks/use-permissions';
import { useClinicalStore } from '@/lib/stores/clinical-store';
import { type Patient as PatientDetails } from '@/lib/api/patients.api';
import { type PatientHistory } from '@/lib/api/medical-records.api';
import { optometryQueueApi } from '@/lib/api/optometry.api';
import { optometryHistoryApi } from '@/lib/api/optometry-history.api';
import { optometrySegmentApi } from '@/lib/api/optometry-segment.api';
import { OPTOMETRY_SEGMENT_KEYS } from '@/lib/optometry/optometry-segment-keys';
import { useAuthStore } from '@/lib/auth-store';
import { useOptometryExam } from '@/hooks/use-optometry-exam';
import { useExamAutosave } from '@/hooks/use-exam-autosave';
import { buildExamDraftPayload } from '@/lib/optometry/build-exam-draft';
import {
  buildIopBundle,
  buildMedicalHistoryBundle,
  buildVisualAcuityBundle,
} from '@/lib/optometry/build-segment-bundles';
import { persistSegmentBundle } from '@/lib/optometry/persist-segment-bundle';
import {
  EMPTY_SPECTACLE_DRAFT,
  flushVisitSegments,
  normalizeSpectacleDraft,
  type IopClinicalDraftSlice,
  type SpectacleDispensingDraft,
  type VaClinicalDraftSlice,
} from '@/lib/optometry/optometry-persistence';
import { TabLastVisitLine } from '@/components/examination/exam-ui/TabLastVisitLine';
import { ExamTabNav } from '@/components/examination/exam-ui/ExamTabNav';
import { PatientDemographicsSheet } from '@/components/examination/PatientDemographicsSheet';
import {
  formatPatientDob,
  resolvePatientMrn,
  resolvePatientPhone,
  resolvePatientPhotoUrl,
} from '@/lib/patients/patient-display-utils';
import type { MedicalHistorySnapshot } from '@/components/examination/medical-history/medical-history-handle';
import {
  applyExamDraft,
  segmentKeysToDraftSkipKeys,
  type ExamDraftHydrationKey,
} from '@/lib/optometry/apply-exam-draft';
import { fetchExamInitialContext } from '@/lib/optometry/fetch-exam-initial-context';
import { hydrateVisitSegments } from '@/lib/optometry/hydrate-visit-segments';
import { OPTOMETRY_TAB_ORDER, type OptometryExamTabId } from '@/lib/optometry/optometry-exam-types';
import { PatientContextBar } from '@/components/examination/PatientContextBar';
import type { PatientContextAllergy } from '@/components/examination/PatientContextBar';
import { UnsavedMedicalHistoryDialog } from '@/components/examination/medical-history/UnsavedMedicalHistoryDialog';
import { MedicalHistoryTabContent } from '@/components/examination/MedicalHistoryTabContent';
import type { MedicalHistoryHandle } from '@/components/examination/medical-history/medical-history-handle';
import type { DisplayAllergy } from '@/lib/medical-history/allergy-utils';
import {
  medicalHistorySnapshotFromPatient,
  medicalHistorySnapshotHasClinicalData,
  pickMedicalHistoryLoadSnapshot,
} from '@/lib/medical-history/medical-history-snapshot';
import LastVisitSummaryBar from '@/components/examination/LastVisitSummaryBar';
import {
  VisualAcuityMegaTab,
  IOPMegaTab,
  RetinoscopyMegaTab,
  AnteriorSegmentTab,
  PosteriorSegmentTab,
  MedicationsTab,
  ContactLensTab,
  ReferralOrdersTab,
  DiagnosisTab,
  AdvicePatientEducationTab,
} from '@/components/examination/optometry-exam-dynamic-tabs';
import { readLocalDraft, persistExamDraft, clearExamDraft } from '@/lib/optometry/optometry-exam-draft';
import { fetchOptometryPatientHistory } from '@/lib/optometry/optometry-prior-visit';
import { historyQueryForExamVisit } from '@/lib/optometry/optometry-history-query';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';
import { anteriorTabHasAnyData } from '@/lib/optometry/anterior-segment-validation';
import { posteriorTabHasAnyData } from '@/lib/optometry/posterior-segment-tab-utils';
import {
  buildAnteriorTabSegmentPayload,
  buildPosteriorTabSegmentPayload,
} from '@/lib/optometry/build-segment-bundles';
import type { AnteriorSegmentExamData, PupilExamData } from '@/lib/optometry/anterior-segment-types';
import type {
  FundusExamData,
  PeripheralRetinaExamData,
  PosteriorSegmentExamData,
  VitreousExamData,
} from '@/lib/optometry/posterior-segment-types';

import type {
  AutoRefractionData,
  ColorVisionData,
  ContrastSensitivityData,
  KeratometryData,
  PachymetryData,
  RefractionData,
  RetinoscopyData,
  TonometryData,
  VisualAcuityData,
  VisualFieldData,
} from '@/lib/stores/clinical-store';

const TAB_SHORT_LABELS: Partial<Record<OptometryExamTabId, string>> = {
  'medical-history': 'Med History',
  'visual-acuity': 'VA',
  iop: 'IOP',
  retinoscopy: 'Retino',
  anterior: 'Anterior',
  posterior: 'Posterior',
  medications: 'Meds',
  'optical-prescription': 'Rx',
  referral: 'Referral',
  diagnosis: 'Dx',
  advice: 'Advice',
};

const TAB_LIST = OPTOMETRY_TAB_ORDER.map((t) => ({
  id: t.id,
  label: t.label,
  shortLabel: TAB_SHORT_LABELS[t.id] ?? t.label,
  step: t.step,
}));

const getAgeFromDob = (dob: Date | string) => {
  const date = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
};

function OptometristExamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId') || '';
  const visitId = searchParams.get('visitId') || '';
  const complaintParam = searchParams.get('complaint') || '';
  const initialTab = searchParams.get('tab') || 'medical-history';

  const { currentPatient } = useClinicalStore();
  const canView = useHasPermission('CLINICAL:EXAMINATION:VIEW');
  const canEdit = useHasPermission('CLINICAL:EXAMINATION:EDIT');

  const {
    priorVisit,
    priorLoading,
    tabStatus,
    markTabDirty,
    markTabSaved,
    isSaving,
    lastSavedAt,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    saveExam,
    reloadPriorVisit,
    hydratePriorVisit,
  } = useOptometryExam(patientId, visitId);

  const [activeTab, setActiveTab] = useState(initialTab);
  const tabMap = useMemo(() => new Set(TAB_LIST.map((tab) => tab.id)), []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tabMap.has(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, tabMap]);
  const [spectacleDispensing, setSpectacleDispensing] =
    useState<SpectacleDispensingDraft>(EMPTY_SPECTACLE_DRAFT);
  const [optometryPatientHistory, setOptometryPatientHistory] = useState<
    OptometryVisitExamRecord[]
  >([]);
  const [visitDateIso, setVisitDateIso] = useState<string | null>(null);
  const [vaExtended, setVaExtended] = useState<unknown>(null);
  const [iopExtended, setIopExtended] = useState<unknown>(null);
  const { user } = useAuthStore();
  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null);
  const [patientHistory, setPatientHistory] = useState<PatientHistory | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);

  const [visualAcuity, setVisualAcuity] = useState<VisualAcuityData | null>(null);
  const [refraction, setRefraction] = useState<RefractionData | null>(null);
  const [autoRefraction, setAutoRefraction] = useState<AutoRefractionData | null>(null);
  const [retinoscopy, setRetinoscopy] = useState<RetinoscopyData | null>(null);
  const [keratometry, setKeratometry] = useState<KeratometryData | null>(null);
  const [tonometry, setTonometry] = useState<TonometryData | null>(null);
  const [pachymetry, setPachymetry] = useState<PachymetryData | null>(null);
  const [visualField, setVisualField] = useState<VisualFieldData | null>(null);
  const [colorVision, setColorVision] = useState<ColorVisionData | null>(null);
  const [contrastSensitivity, setContrastSensitivity] = useState<ContrastSensitivityData | null>(null);

  // Retinoscopy mega-tab state (wet/dry/subjective)
  const [wetRetinoscopy, setWetRetinoscopy] = useState<any>(null); // TODO: Add proper type
  const [dryRetinoscopy, setDryRetinoscopy] = useState<any>(null); // TODO: Add proper type
  const [subjectiveRefraction, setSubjectiveRefraction] = useState<any>(null); // TODO: Add proper type

  // Anterior segment tab state
  const [pupilExam, setPupilExam] = useState<PupilExamData | null>(null);
  const [anteriorSegment, setAnteriorSegment] = useState<AnteriorSegmentExamData | null>(null);

  // Posterior segment tab state
  const [posteriorSegment, setPosteriorSegment] = useState<PosteriorSegmentExamData | null>(null);
  const [fundusExam, setFundusExam] = useState<FundusExamData | null>(null);
  const [vitreousExam, setVitreousExam] = useState<VitreousExamData | null>(null);
  const [peripheralRetinaExam, setPeripheralRetinaExam] = useState<PeripheralRetinaExamData | null>(
    null,
  );
  const [anteriorSaving, setAnteriorSaving] = useState(false);
  const [posteriorSaving, setPosteriorSaving] = useState(false);

  // Medications tab state
  const [currentMedications, setCurrentMedications] = useState<any>(null); // TODO: Add proper type
  const [prescriptionItems, setPrescriptionItems] = useState<any>(null); // TODO: Add proper type

  // Contact lens tab state
  const [clAssessment, setClAssessment] = useState<any>(null); // TODO: Add proper type
  const [clPrescription, setClPrescription] = useState<any>(null); // TODO: Add proper type
  const [clFitting, setClFitting] = useState<any>(null); // TODO: Add proper type
  const [clCornealHealth, setClCornealHealth] = useState<any>(null); // TODO: Add proper type
  const [clInstructions, setClInstructions] = useState<any>(null); // TODO: Add proper type

  // Referral & orders tab state
  const [doctorReferrals, setDoctorReferrals] = useState<any>(null); // TODO: Add proper type
  const [imagingOrders, setImagingOrders] = useState<any>(null); // TODO: Add proper type
  const [receptionReferrals, setReceptionReferrals] = useState<any>(null); // TODO: Add proper type

  // Diagnosis tab state
  const [diagnoses, setDiagnoses] = useState<any>(null); // TODO: Add proper type

  // Advice & Patient Education tab state
  const [adviceInstructions, setAdviceInstructions] = useState<any>(null); // TODO: Add proper type
  const [adviceFollowUp, setAdviceFollowUp] = useState<any>(null); // TODO: Add proper type
  const [advicePrecautions, setAdvicePrecautions] = useState<any>(null); // TODO: Add proper type
  const [adviceEducation, setAdviceEducation] = useState<any>(null); // TODO: Add proper type

  const draftHydratedRef = useRef<Set<ExamDraftHydrationKey>>(new Set());
  const [examContextReady, setExamContextReady] = useState(false);
  const [examContextLoading, setExamContextLoading] = useState(false);
  const medicalHistoryRef = useRef<MedicalHistoryHandle>(null);
  const [medicalHistoryDirty, setMedicalHistoryDirty] = useState(false);
  const [mhSaving, setMhSaving] = useState(false);
  const [headerAllergies, setHeaderAllergies] = useState<PatientContextAllergy[]>([]);
  const [headerNkda, setHeaderNkda] = useState(false);
  const [unsavedMhDialogOpen, setUnsavedMhDialogOpen] = useState(false);
  const pendingTabRef = useRef<string | null>(null);
  const pendingBackRef = useRef(false);
  const [mhDraftSnapshot, setMhDraftSnapshot] = useState<MedicalHistorySnapshot | null>(null);
  /** Last MH snapshot from tab (survives tab switch / unmount). */
  const [medicalHistorySnapshot, setMedicalHistorySnapshot] =
    useState<MedicalHistorySnapshot | null>(null);
  /** Visit segment snapshot (`medical_history_bundle`) for this visit. */
  const [mhVisitSnapshot, setMhVisitSnapshot] = useState<MedicalHistorySnapshot | null>(null);
  const medicalHistorySnapshotRef = useRef<MedicalHistorySnapshot | null>(null);
  const mhReviewedAtRef = useRef<string | null>(null);
  const mhPatientFallbackVisitRef = useRef<string | null>(null);
  const examContextKeyRef = useRef<string | null>(null);
  const mhHydratedKeyRef = useRef<string>('');
  const [demographicsOpen, setDemographicsOpen] = useState(false);

  const mhHydrationReady =
    examContextReady && Boolean(patientDetails) && !examContextLoading;

  const applyMedicalHistorySnapshot = useCallback((snap: MedicalHistorySnapshot | null) => {
    medicalHistorySnapshotRef.current = snap;
    setMedicalHistorySnapshot(snap);
    if (snap?.medicalHistoryReviewedAt) {
      mhReviewedAtRef.current = snap.medicalHistoryReviewedAt;
    }
  }, []);

  const handleMhSnapshotChange = useCallback((snap: MedicalHistorySnapshot) => {
    medicalHistorySnapshotRef.current = snap;
    setMedicalHistorySnapshot(snap);
  }, []);

  const reloadOptometryPatientHistory = useCallback(async () => {
    if (!patientId) return;
    const visits = await fetchOptometryPatientHistory(
      patientId,
      {
        ...historyQueryForExamVisit(visitId || undefined, 10, visitDateIso ?? undefined),
      },
    );
    setOptometryPatientHistory(visits);
  }, [patientId, visitId, visitDateIso]);

  const refreshExamHistory = useCallback(async () => {
    await Promise.all([reloadOptometryPatientHistory(), reloadPriorVisit()]);
  }, [reloadOptometryPatientHistory, reloadPriorVisit]);

  useEffect(() => {
    if (!patientId) {
      draftHydratedRef.current = new Set();
      setExamContextReady(true);
      setExamContextLoading(false);
      setPatientLoading(false);
      return;
    }

    let cancelled = false;

    const examDraftSetters = {
      onMedicalHistorySnapshot: (mhFromDraft: MedicalHistorySnapshot | null) => {
        if (!mhFromDraft) return;
        setMhDraftSnapshot(mhFromDraft);
        const prevLifted = medicalHistorySnapshotRef.current;
        if (!prevLifted || !medicalHistorySnapshotHasClinicalData(prevLifted)) {
          applyMedicalHistorySnapshot(mhFromDraft);
        }
      },
      setVisualAcuity,
      setRefraction,
      setAutoRefraction,
      setKeratometry,
      setColorVision,
      setContrastSensitivity,
      setTonometry,
      setPachymetry,
      setVisualField,
      setVaExtended,
      setIopExtended,
      setRetinoscopy,
      setWetRetinoscopy,
      setDryRetinoscopy,
      setSubjectiveRefraction,
      setPupilExam,
      setAnteriorSegment,
      setPosteriorSegment,
      setFundusExam,
      setVitreousExam,
      setPeripheralRetinaExam,
      setCurrentMedications,
      setPrescriptionItems,
      setClAssessment,
      setClPrescription,
      setClFitting,
      setClCornealHealth,
      setClInstructions,
      setSpectacleDispensing,
      setDoctorReferrals,
      setImagingOrders,
      setReceptionReferrals,
      setDiagnoses,
      setAdviceInstructions,
      setAdviceFollowUp,
      setAdvicePrecautions,
      setAdviceEducation,
    };

    const contextKey = visitId ? `${patientId}:${visitId}` : patientId;
    if (examContextKeyRef.current !== contextKey) {
      examContextKeyRef.current = contextKey;
      applyMedicalHistorySnapshot(null);
      setMhDraftSnapshot(null);
      setMhVisitSnapshot(null);
      mhReviewedAtRef.current = null;
      mhPatientFallbackVisitRef.current = null;
      mhHydratedKeyRef.current = '';
      draftHydratedRef.current = new Set();
      setVaExtended(null);
      setIopExtended(null);
      setVisualAcuity(null);
      setRefraction(null);
      setAutoRefraction(null);
      setKeratometry(null);
      setTonometry(null);
      setPachymetry(null);
      setVisualField(null);
      setColorVision(null);
      setContrastSensitivity(null);
      setExamContextReady(false);
    }

    const loadExamContext = async () => {
      setExamContextLoading(true);
      setPatientLoading(true);
      try {
        const ctx = await fetchExamInitialContext(patientId, visitId);
        if (cancelled) return;

        setPatientDetails(ctx.patient);
        setPatientHistory(ctx.patientHistory);
        setOptometryPatientHistory(ctx.optometryHistory);
        setVisitDateIso(ctx.visitDateIso);
        hydratePriorVisit(ctx.priorVisit);

        const segmentResult = hydrateVisitSegments(ctx.segments, examDraftSetters, {
          patientId,
          examinerId: user?.id ?? '',
        });
        setMhVisitSnapshot(segmentResult.mhVisitSnapshot);
        if (segmentResult.mhVisitSnapshot) {
          applyMedicalHistorySnapshot(segmentResult.mhVisitSnapshot);
          mhPatientFallbackVisitRef.current = visitId || null;
        }

        const draft =
          ctx.draft && (!visitId || ctx.draft.visitId === visitId)
            ? ctx.draft
            : visitId
              ? readLocalDraft(visitId)
              : null;

        let hydrated = new Set<ExamDraftHydrationKey>();
        if (draft && (!visitId || draft.visitId === visitId)) {
          const skipKeys = segmentKeysToDraftSkipKeys(segmentResult.loadedSegmentKeys);
          const draftResult = applyExamDraft(draft, examDraftSetters, {
            skipKeys,
            skipMedicalHistory: segmentResult.skipDraftMedicalHistory,
          });
          hydrated = draftResult.hydrated;
        }

        draftHydratedRef.current = hydrated;

        const hasOpticalSegment = segmentResult.loadedSegmentKeys.has(
          OPTOMETRY_SEGMENT_KEYS.opticalBundle,
        );
        if (!hydrated.has('spectacleDispensing') && !hasOpticalSegment) {
          setSpectacleDispensing(EMPTY_SPECTACLE_DRAFT);
        } else if (hydrated.has('spectacleDispensing')) {
          setSpectacleDispensing((s) => normalizeSpectacleDraft(s));
        }
      } catch (error) {
        console.error('Failed to load exam context', error);
        if (!cancelled) {
          toast.error('Failed to load examination data');
        }
      } finally {
        if (!cancelled) {
          setExamContextReady(true);
          setExamContextLoading(false);
          setPatientLoading(false);
        }
      }
    };

    void loadExamContext();

    return () => {
      cancelled = true;
    };
  }, [patientId, visitId, user?.id, hydratePriorVisit]);

  const resolveMedicalHistorySnapshot = useCallback((): MedicalHistorySnapshot | undefined => {
    const draftMh = (() => {
      if (!visitId) return null;
      const local = readLocalDraft(visitId);
      if (local?.visitId !== visitId || !local.medicalHistorySnapshot) return null;
      return local.medicalHistorySnapshot as MedicalHistorySnapshot;
    })();

    const snap =
      medicalHistoryRef.current?.getSnapshot() ??
      medicalHistorySnapshotRef.current ??
      medicalHistorySnapshot ??
      mhDraftSnapshot ??
      mhVisitSnapshot ??
      draftMh ??
      (patientDetails ? medicalHistorySnapshotFromPatient(patientDetails) : null);
    if (!snap) return undefined;
    return {
      ...snap,
      medicalHistoryReviewedAt:
        mhReviewedAtRef.current ?? snap.medicalHistoryReviewedAt,
    };
  }, [visitId, medicalHistorySnapshot, mhDraftSnapshot, mhVisitSnapshot, patientDetails]);

  const saveOptometrySegment = async (
    segmentKey: string,
    data: unknown,
    label: string,
    setter: (value: unknown) => void,
    tabId?: OptometryExamTabId,
    options?: { toast?: boolean },
  ): Promise<boolean> => {
    const showToast = options?.toast !== false;
    if (!canEdit) {
      if (showToast) toast.error('You do not have permission to save examinations');
      return false;
    }
    if (!visitId || !patientId) {
      if (showToast) toast.error('Visit ID is required to save segment data');
      return false;
    }
    try {
      await optometrySegmentApi.upsertSegment(visitId, segmentKey, {
        patientId,
        data,
      });
      setter(data);
      if (tabId) markTabSaved(tabId);
      if (showToast) toast.success(`${label} saved`);
      return true;
    } catch {
      if (showToast) toast.error(`Failed to save ${label}`);
      return false;
    }
  };

  useEffect(() => {
    if (!patientId || !visitId || !mhHydrationReady || !patientDetails) return;

    const localDraft = readLocalDraft(visitId);
    const draftFromLocal =
      localDraft?.visitId === visitId && localDraft.medicalHistorySnapshot
        ? (localDraft.medicalHistorySnapshot as MedicalHistorySnapshot)
        : null;

    const snap = pickMedicalHistoryLoadSnapshot({
      draft: draftFromLocal ?? mhDraftSnapshot,
      visitSegment: mhVisitSnapshot,
      patient: patientDetails,
    });

    const fp = snap ? JSON.stringify(snap) : 'empty';
    const loadKey = `${patientId}:${visitId}:${fp}`;
    if (mhHydratedKeyRef.current === loadKey) return;

    const segmentHasClinical =
      mhVisitSnapshot != null && medicalHistorySnapshotHasClinicalData(mhVisitSnapshot);
    if (
      draftFromLocal &&
      medicalHistorySnapshotHasClinicalData(draftFromLocal) &&
      !segmentHasClinical
    ) {
      setMhDraftSnapshot(draftFromLocal);
    } else if (segmentHasClinical) {
      setMhDraftSnapshot(null);
    }

    const tryHydrate = (): boolean => {
      const mh = medicalHistoryRef.current;
      if (!mh?.isHydrated()) return false;
      if (snap) {
        const merged: MedicalHistorySnapshot = {
          ...snap,
          allergies:
            Array.isArray(snap.allergies) && snap.allergies.length > 0
              ? snap.allergies
              : mh.getDisplayAllergies(),
        };
        mh.hydrateFromSnapshot(merged);
        applyMedicalHistorySnapshot(merged);
      }
      mhHydratedKeyRef.current = loadKey;
      return true;
    };

    if (tryHydrate()) return;

    const interval = window.setInterval(() => {
      if (tryHydrate()) window.clearInterval(interval);
    }, 50);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 8000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [
    patientId,
    visitId,
    mhHydrationReady,
    patientDetails,
    mhDraftSnapshot,
    mhVisitSnapshot,
    applyMedicalHistorySnapshot,
  ]);

  const saveOpticalBundle = async (overrides?: {
    assessment?: unknown;
    prescription?: unknown;
    fitting?: unknown;
    cornealHealth?: unknown;
    instructions?: unknown;
    spectacle?: unknown;
  }) => {
    const bundle = {
      assessment: overrides?.assessment ?? clAssessment,
      prescription: overrides?.prescription ?? clPrescription,
      fitting: overrides?.fitting ?? clFitting,
      cornealHealth: overrides?.cornealHealth ?? clCornealHealth,
      instructions: overrides?.instructions ?? clInstructions,
      spectacleDispensing: overrides?.spectacle ?? spectacleDispensing,
    };
    if (overrides?.assessment !== undefined) setClAssessment(overrides.assessment);
    if (overrides?.prescription !== undefined) setClPrescription(overrides.prescription);
    if (overrides?.fitting !== undefined) setClFitting(overrides.fitting);
    if (overrides?.cornealHealth !== undefined) setClCornealHealth(overrides.cornealHealth);
    if (overrides?.instructions !== undefined) setClInstructions(overrides.instructions);
    if (overrides?.spectacle !== undefined) setSpectacleDispensing(overrides.spectacle);
    await saveOptometrySegment(
      OPTOMETRY_SEGMENT_KEYS.opticalBundle,
      bundle,
      'Optical prescription',
      () => {},
      'optical-prescription',
    );
  };

  const buildDraftPayload = useCallback(
    () =>
      buildExamDraftPayload(visitId, patientId, complaintParam || undefined, {
        medicalHistorySnapshot: resolveMedicalHistorySnapshot(),
        visualAcuity,
        refraction,
        autoRefraction,
        keratometry,
        colorVision,
        contrastSensitivity,
        tonometry,
        pachymetry,
        visualField,
        vaExtended,
        iopExtended,
        wetRetinoscopy,
        dryRetinoscopy,
        subjectiveRefraction,
        retinoscopy,
        pupilExam,
        anteriorSegment,
        posteriorSegment,
        fundusExam,
        vitreousExam,
        peripheralRetinaExam,
        currentMedications,
        prescriptionItems,
        clAssessment,
        clPrescription,
        clFitting,
        clCornealHealth,
        clInstructions,
        spectacleDispensing,
        doctorReferrals,
        imagingOrders,
        receptionReferrals,
        diagnoses,
        adviceInstructions,
        adviceFollowUp,
        advicePrecautions,
        adviceEducation,
      }),
    [
      visitId,
      patientId,
      complaintParam,
      visualAcuity,
      refraction,
      autoRefraction,
      keratometry,
      colorVision,
      contrastSensitivity,
      tonometry,
      pachymetry,
      visualField,
      vaExtended,
      iopExtended,
      wetRetinoscopy,
      dryRetinoscopy,
      subjectiveRefraction,
      retinoscopy,
      pupilExam,
      anteriorSegment,
      posteriorSegment,
      fundusExam,
      vitreousExam,
      peripheralRetinaExam,
      currentMedications,
      prescriptionItems,
      clAssessment,
      clPrescription,
      clFitting,
      clCornealHealth,
      clInstructions,
      spectacleDispensing,
      doctorReferrals,
      imagingOrders,
      receptionReferrals,
      diagnoses,
      adviceInstructions,
      adviceFollowUp,
      advicePrecautions,
      adviceEducation,
      resolveMedicalHistorySnapshot,
    ],
  );

  useExamAutosave(
    Boolean(patientId && visitId && canEdit),
    patientId,
    visitId,
    user?.id,
    hasUnsavedChanges,
    buildDraftPayload,
  );

  const savedSectionCount = useMemo(
    () => Object.values(tabStatus).filter((s) => s === 'saved').length,
    [tabStatus],
  );

  const persistMedicalHistoryBundle = useCallback(
    async (snap?: MedicalHistorySnapshot) => {
      if (!visitId || !patientId || !canEdit) return false;
      const snapshot = snap ?? resolveMedicalHistorySnapshot();
      if (!snapshot || !medicalHistorySnapshotHasClinicalData(snapshot)) return true;
      try {
        await persistSegmentBundle(
          visitId,
          patientId,
          OPTOMETRY_SEGMENT_KEYS.medicalHistoryBundle,
          buildMedicalHistoryBundle(snapshot),
        );
        setMhVisitSnapshot(snapshot);
        applyMedicalHistorySnapshot(snapshot);
        return true;
      } catch (e) {
        console.error(e);
        toast.error('Failed to save medical history to visit');
        return false;
      }
    },
    [visitId, patientId, canEdit, resolveMedicalHistorySnapshot, applyMedicalHistorySnapshot],
  );

  const handlePersistMedicalHistoryBundle = useCallback(
    async (snap: MedicalHistorySnapshot) => {
      const ok = await persistMedicalHistoryBundle(snap);
      if (ok) {
        await refreshExamHistory();
      }
      return ok;
    },
    [persistMedicalHistoryBundle, refreshExamHistory],
  );

  const handleVaExtendedChange = useCallback((data: unknown) => {
    setVaExtended((prev) => {
      const prevJson = prev != null ? JSON.stringify(prev) : '';
      const nextJson = JSON.stringify(data);
      if (prevJson === nextJson) return prev;
      return data;
    });
  }, []);

  const handleVaDirtyChange = useCallback(
    (dirty: boolean) => {
      if (dirty) markTabDirty('visual-acuity');
    },
    [markTabDirty],
  );

  const handleMhDirtyChange = useCallback(
    (dirty: boolean) => {
      setMedicalHistoryDirty(dirty);
      if (dirty) markTabDirty('medical-history');
      else markTabSaved('medical-history');
    },
    [markTabDirty, markTabSaved],
  );

  const handleIopExtendedChange = useCallback(
    (data: unknown) => {
      let changed = false;
      setIopExtended((prev) => {
        const prevJson = prev != null ? JSON.stringify(prev) : '';
        const nextJson = JSON.stringify(data);
        if (prevJson === nextJson) return prev;
        changed = true;
        return data;
      });
      if (changed) markTabDirty('iop');
    },
    [markTabDirty],
  );

  const handleVaSectionSaved = useCallback(() => {
    markTabSaved('visual-acuity');
    void refreshExamHistory();
  }, [markTabSaved, refreshExamHistory]);

  const handleIopSectionSaved = useCallback(() => {
    markTabSaved('iop');
    void refreshExamHistory();
  }, [markTabSaved, refreshExamHistory]);

  const handleRetinoscopyDirtyChange = useCallback(
    (dirty: boolean) => {
      if (dirty) markTabDirty('retinoscopy');
    },
    [markTabDirty],
  );

  const handleRetinoscopyTabRecordState = useCallback(
    (sectionRecorded: Partial<Record<'wet' | 'dry' | 'subjective', boolean>>) => {
      const allRecorded =
        sectionRecorded.wet === true &&
        sectionRecorded.dry === true &&
        sectionRecorded.subjective === true;
      if (allRecorded) {
        markTabSaved('retinoscopy');
        void refreshExamHistory();
      } else if (
        sectionRecorded.wet ||
        sectionRecorded.dry ||
        sectionRecorded.subjective
      ) {
        markTabDirty('retinoscopy');
      }
    },
    [markTabSaved, markTabDirty, refreshExamHistory],
  );

  const handleSyncVaClinicalDraft = useCallback(
    (slice: VaClinicalDraftSlice) => {
      setVisualAcuity(slice.visualAcuity);
      setRefraction(slice.refraction);
      setKeratometry(slice.keratometry);
      setColorVision(slice.colorVision);
      setContrastSensitivity(slice.contrastSensitivity);
      markTabDirty('visual-acuity');
    },
    [markTabDirty],
  );

  const handleSyncIopClinicalDraft = useCallback(
    (slice: IopClinicalDraftSlice, extended: unknown) => {
      setTonometry(slice.tonometry);
      setPachymetry(slice.pachymetry);
      setVisualField(slice.visualField);
      setIopExtended(extended);
      markTabDirty('iop');
    },
    [markTabDirty],
  );

  const prefillSpectacleFromRefraction = useCallback(() => {
    const ext = vaExtended as {
      newPrescription?: { OD?: { sphere?: string }; OS?: { sphere?: string } };
      refraction?: { OD?: { sphere?: string }; OS?: { sphere?: string } };
    } | null;
    const fmt = (n: number | undefined) =>
      n === undefined || Number.isNaN(n) ? '' : n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);

    const od =
      ext?.newPrescription?.OD ??
      (ext?.refraction?.OD
        ? {
            sphere: ext.refraction.OD.sphere,
            cylinder: (ext.refraction.OD as { cylinder?: string }).cylinder,
            axis: (ext.refraction.OD as { axis?: string }).axis,
          }
        : null);
    const os =
      ext?.newPrescription?.OS ??
      (ext?.refraction?.OS
        ? {
            sphere: ext.refraction.OS.sphere,
            cylinder: (ext.refraction.OS as { cylinder?: string }).cylinder,
            axis: (ext.refraction.OS as { axis?: string }).axis,
          }
        : null);

    if (refraction?.finalRx) {
      setSpectacleDispensing((prev) => ({
        ...prev,
        od: {
          sphere: fmt(refraction.finalRx.OD.sphere),
          cylinder: refraction.finalRx.OD.cylinder != null ? fmt(refraction.finalRx.OD.cylinder) : '',
          axis: refraction.finalRx.OD.axis?.toString() ?? '',
          add: refraction.nearRx?.OD?.add != null ? fmt(refraction.nearRx.OD.add) : '',
        },
        os: {
          sphere: fmt(refraction.finalRx.OS.sphere),
          cylinder: refraction.finalRx.OS.cylinder != null ? fmt(refraction.finalRx.OS.cylinder) : '',
          axis: refraction.finalRx.OS.axis?.toString() ?? '',
          add: refraction.nearRx?.OS?.add != null ? fmt(refraction.nearRx.OS.add) : '',
        },
      }));
      markTabDirty('optical-prescription');
      toast.success('Spectacle Rx prefilled from refraction');
      return;
    }

    if (od?.sphere || os?.sphere) {
      setSpectacleDispensing((prev) => ({
        ...prev,
        od: {
          sphere: od.sphere ?? '',
          cylinder: (od as { cylinder?: string }).cylinder ?? '',
          axis: (od as { axis?: string }).axis ?? '',
          add: prev.od?.add ?? '',
        },
        os: {
          sphere: os?.sphere ?? '',
          cylinder: (os as { cylinder?: string })?.cylinder ?? '',
          axis: (os as { axis?: string })?.axis ?? '',
          add: prev.os?.add ?? '',
        },
      }));
      markTabDirty('optical-prescription');
      toast.success('Spectacle Rx prefilled from VA tab');
    } else {
      toast.error('Record refraction in Visual Acuity tab first');
    }
  }, [refraction, vaExtended, markTabDirty]);

  const handleCopyPreviousDiagnoses = useCallback(() => {
    const prior = priorVisit?.raw as { diagnoses?: Array<Record<string, unknown>> } | undefined;
    const list = prior?.diagnoses;
    if (!list?.length) {
      toast.error('No prior diagnoses on last visit');
      return;
    }
    const mapped = list.map((d, i) => ({
      id: `prior-${i}-${Date.now()}`,
      icd10Code: String(d.icd10Code ?? d.code ?? ''),
      description: String(d.description ?? ''),
      laterality: String(d.laterality ?? 'Both Eyes (Bilateral)'),
      severity: String(d.severity ?? 'Not Applicable'),
      status: 'Previous',
      isPrimary: i === 0,
      clinicalNotes: d.clinicalNotes ? String(d.clinicalNotes) : undefined,
    }));
    setDiagnoses(mapped);
    markTabDirty('diagnosis');
    toast.success(`Loaded ${mapped.length} diagnosis(es) from prior visit`);
  }, [priorVisit, markTabDirty]);

  const saveAdviceBundle = async (overrides?: {
    instructions?: unknown;
    followUp?: unknown;
    precautions?: unknown;
    education?: unknown;
  }) => {
    const bundle = {
      instructions: overrides?.instructions ?? adviceInstructions,
      followUp: overrides?.followUp ?? adviceFollowUp,
      precautions: overrides?.precautions ?? advicePrecautions,
      education: overrides?.education ?? adviceEducation,
    };
    if (overrides?.instructions !== undefined) setAdviceInstructions(overrides.instructions);
    if (overrides?.followUp !== undefined) setAdviceFollowUp(overrides.followUp);
    if (overrides?.precautions !== undefined) setAdvicePrecautions(overrides.precautions);
    if (overrides?.education !== undefined) setAdviceEducation(overrides.education);
    await saveOptometrySegment(
      OPTOMETRY_SEGMENT_KEYS.adviceBundle,
      bundle,
      'Advice & patient education',
      () => {},
      'advice',
    );
  };

  const applyTabChange = useCallback(
    (tabId: string) => {
      if (!tabMap.has(tabId)) return;
      setActiveTab(tabId);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tabId);
      if (patientId) params.set('patientId', patientId);
      if (visitId) params.set('visitId', visitId);
      if (complaintParam) params.set('complaint', complaintParam);
      router.replace(`/dashboard/optometrist/exam?${params.toString()}`, { scroll: false });
    },
    [tabMap, searchParams, patientId, visitId, complaintParam, router],
  );

  const isMedicalHistoryBlockingNavigation = useCallback(() => {
    if (activeTab !== 'medical-history') return false;
    const mh = medicalHistoryRef.current;
    if (!mh?.isHydrated()) return false;
    return mh.isDirty();
  }, [activeTab]);

  const handleTabChange = (tabId: string) => {
    if (!tabMap.has(tabId)) return;
    if (tabId === activeTab) return;
    if (isMedicalHistoryBlockingNavigation()) {
      pendingTabRef.current = tabId;
      pendingBackRef.current = false;
      setUnsavedMhDialogOpen(true);
      return;
    }
    applyTabChange(tabId);
  };

  const handleBackFromExam = () => {
    if (isMedicalHistoryBlockingNavigation()) {
      pendingTabRef.current = null;
      pendingBackRef.current = true;
      setUnsavedMhDialogOpen(true);
      return;
    }
    router.push('/dashboard/optometrist');
  };

  const handleMhSaveAndContinue = async () => {
    setMhSaving(true);
    try {
      const updated = await medicalHistoryRef.current?.save();
      if (updated) {
        setPatientDetails(updated);
        setMedicalHistoryDirty(false);
        markTabSaved('medical-history');
        medicalHistoryRef.current?.acknowledgePersisted();
      }
      setUnsavedMhDialogOpen(false);
      if (pendingBackRef.current) {
        pendingBackRef.current = false;
        router.push('/dashboard/optometrist');
      } else if (pendingTabRef.current) {
        applyTabChange(pendingTabRef.current);
        pendingTabRef.current = null;
      }
    } finally {
      setMhSaving(false);
    }
  };

  const handleMhDiscardAndContinue = () => {
    medicalHistoryRef.current?.discard();
    const snap = medicalHistoryRef.current?.getSnapshot();
    if (snap) applyMedicalHistorySnapshot(snap);
    setMedicalHistoryDirty(false);
    setUnsavedMhDialogOpen(false);
    if (pendingBackRef.current) {
      pendingBackRef.current = false;
      router.push('/dashboard/optometrist');
    } else if (pendingTabRef.current) {
      applyTabChange(pendingTabRef.current);
      pendingTabRef.current = null;
    }
  };

  const handleMhStay = () => {
    setUnsavedMhDialogOpen(false);
    pendingTabRef.current = null;
    pendingBackRef.current = false;
  };

  useEffect(() => {
    const mhDirty =
      activeTab === 'medical-history' &&
      medicalHistoryRef.current?.isHydrated() &&
      medicalHistoryRef.current?.isDirty();
    if (!medicalHistoryDirty && !mhDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [medicalHistoryDirty, activeTab]);

  useEffect(() => {
    if (!canEdit || activeTab !== 'medical-history') return;
    const timer = window.setInterval(() => {
      const mh = medicalHistoryRef.current;
      if (!mh?.isHydrated() || !mh.isDirty()) return;
      void mh.save().then(async (updated) => {
        if (updated) {
          setPatientDetails(updated);
          setMedicalHistoryDirty(false);
          markTabSaved('medical-history');
          medicalHistoryRef.current?.acknowledgePersisted();
          if (patientId && visitId && user?.id) {
            try {
              const payload = buildDraftPayload();
              payload.visitId = visitId;
              payload.patientId = patientId;
              await persistExamDraft(patientId, user.id, payload);
            } catch {
              /* draft sync best-effort */
            }
          }
        }
      });
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [medicalHistoryDirty, canEdit, activeTab, markTabSaved, buildDraftPayload, patientId, visitId, user?.id]);

  const handleAllergiesUpdated = useCallback((allergies: DisplayAllergy[], nkda: boolean) => {
    setHeaderNkda(nkda);
    setHeaderAllergies(
      nkda
        ? []
        : allergies.map((a) => ({ name: a.allergenName, severity: a.severity })),
    );
  }, []);

  const handleSaveExamination = async () => {
    if (!canEdit) {
      toast.error('You do not have permission to save examinations');
      return;
    }
    if (!patientId || !visitId) {
      toast.error('Patient and visit are required');
      return;
    }
    try {
      const mhSnap = resolveMedicalHistorySnapshot();
      const medicalHistoryBundle =
        mhSnap != null && medicalHistorySnapshotHasClinicalData(mhSnap)
          ? buildMedicalHistoryBundle(mhSnap)
          : undefined;
      const visualAcuityBundle = vaExtended ? buildVisualAcuityBundle(vaExtended) : undefined;
      const iopBundle = iopExtended ? buildIopBundle(iopExtended) : undefined;

      let draftSaved = true;
      try {
        await saveExam(buildDraftPayload);
      } catch (draftErr) {
        draftSaved = false;
        console.error(draftErr);
        toast.error('Draft save failed — saved locally; retry Save exam');
      }

      let segmentFailures: string[] = [];
      if (visitId) {
        segmentFailures = await flushVisitSegments(visitId, patientId, {
          medicalHistoryBundle,
          visualAcuityBundle,
          iopBundle,
          opticalBundle: {
            assessment: clAssessment,
            prescription: clPrescription,
            fitting: clFitting,
            cornealHealth: clCornealHealth,
            instructions: clInstructions,
            spectacleDispensing,
          },
          wetRetinoscopy,
          dryRetinoscopy,
          subjectiveRefraction,
          pupilExam,
          anteriorSegment,
          posteriorSegment,
          fundusExam,
          vitreousExam,
          peripheralRetinaExam,
          prescriptionItems,
          doctorReferrals,
          imagingOrders,
          receptionReferrals,
          diagnoses,
          adviceBundle: {
            instructions: adviceInstructions,
            followUp: adviceFollowUp,
            precautions: advicePrecautions,
            education: adviceEducation,
          },
        });
      }

      if (segmentFailures.length > 0) {
        toast.error(`Some sections failed to save: ${segmentFailures.join(', ')}`);
      } else if (draftSaved) {
        toast.success('Examination saved');
      }

      if (segmentFailures.length === 0) {
        setHasUnsavedChanges(false);
        setMedicalHistoryDirty(false);
        medicalHistoryRef.current?.acknowledgePersisted();
        if (mhSnap && medicalHistorySnapshotHasClinicalData(mhSnap)) {
          setMhVisitSnapshot(mhSnap);
          applyMedicalHistorySnapshot(mhSnap);
        }
        OPTOMETRY_TAB_ORDER.forEach((t) => markTabSaved(t.id));
      }

      await refreshExamHistory();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save examination');
    }
  };

  const tabStatusDot = (tabId: OptometryExamTabId): string | null => {
    const s = tabStatus[tabId];
    if (s === 'error') return 'bg-red-500';
    if (s === 'saved') return 'bg-emerald-500';
    if (s === 'dirty') return 'bg-amber-400 ring-2 ring-amber-200';
    if (tabId === 'medical-history' && medicalHistoryDirty) {
      return 'bg-amber-400 ring-2 ring-amber-200';
    }
    if (hasUnsavedChanges && activeTab === tabId) {
      return 'bg-amber-400 ring-2 ring-amber-200';
    }
    return null;
  };

  const handleCompleteExamination = async () => {
    if (!patientId) {
      toast.error('No patient selected');
      return;
    }
    if (!visitId) {
      toast.error('No visit linked — open exam from the optometry queue');
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to complete examinations');
      return;
    }

    if (hasUnsavedChanges || medicalHistoryDirty) {
      toast.error('Save exam before completing — you have unsaved changes');
      return;
    }

    if (!lastSavedAt) {
      toast.error('Save exam at least once before completing the examination');
      return;
    }

    try {
      await optometryQueueApi.completeLeg(visitId, 'doctor');
      let archiveOk = true;
      try {
        await optometryHistoryApi.archiveVisitExam(visitId, patientId);
      } catch (archiveErr) {
        archiveOk = false;
        console.error('Archive failed after complete:', archiveErr);
        toast.error(
          'Patient sent to doctor, but exam archive failed — save exam again or contact support',
        );
      }
      await clearExamDraft(patientId, visitId);
      if (archiveOk) {
        toast.success('Examination completed — patient sent to doctor');
      }
      router.push('/dashboard/optometrist');
    } catch (error) {
      console.error('Failed to complete examination:', error);
      toast.error('Failed to complete examination');
    }
  };

  const derivedDob = patientDetails?.dateOfBirth ?? currentPatient?.dateOfBirth ?? null;
  const patientAge = derivedDob ? getAgeFromDob(derivedDob) : null;
  const patientName = patientDetails
    ? `${patientDetails.firstName} ${patientDetails.lastName}`
    : currentPatient
      ? `${currentPatient.firstName} ${currentPatient.lastName}`
      : null;
  const patientMrn = resolvePatientMrn(
    patientDetails,
    currentPatient?.mrn ?? patientHistory?.mrn ?? null,
  );
  const patientGender = patientDetails?.gender ?? currentPatient?.gender ?? patientHistory?.gender ?? null;
  const patientDobLabel = formatPatientDob(derivedDob);
  const patientPhone = resolvePatientPhone(patientDetails);
  const patientPhotoUrl = resolvePatientPhotoUrl(patientDetails?.photoUrl);
  const patientLabel = patientName
    ? `${patientName} • ${patientAge ?? '-'}y / ${patientGender ?? '-'} • ${patientMrn ?? 'MRN N/A'}`
    : patientId
      ? `Patient ID: ${patientId}`
      : 'No patient selected';

  const allergyList =
    headerAllergies.length > 0 || headerNkda
      ? headerAllergies.map((a) => a.name)
      : (patientHistory?.allergies || []).map((item) => item.allergen).filter(Boolean);
  const medicationList = (patientHistory?.currentMedications || []).map((item) => item.name).filter(Boolean);
  const conditionCount = (patientHistory?.medicalHistory || []).length;
  const medicalHistoryList = (patientHistory?.medicalHistory || []).map((item) => item.condition).filter(Boolean);
  const surgicalHistoryList = (patientHistory?.surgicalHistory || []).map((item) => item.procedure).filter(Boolean);
  const familyHistoryList = (patientHistory?.familyHistory || []).map((item) => item.condition).filter(Boolean);
  const fallbackMedicalHistory = patientDetails?.medicalHistory ? [patientDetails.medicalHistory] : [];

  if (!canView) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          You do not have permission to view examinations.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Tab Navigation with Patient Demographics */}
      <div className="bg-white border-b-2 border-gray-100 shadow-sm">
        {patientId ? (
          <PatientContextBar
            loading={patientLoading || examContextLoading}
            name={patientName}
            firstName={patientDetails?.firstName ?? currentPatient?.firstName}
            lastName={patientDetails?.lastName ?? currentPatient?.lastName}
            mrn={patientMrn}
            age={patientAge}
            gender={patientGender}
            bloodGroup={patientDetails?.bloodGroup}
            dateOfBirthLabel={patientDobLabel}
            phone={patientPhone}
            photoUrl={patientPhotoUrl}
            complaint={complaintParam || null}
            allergies={
              headerAllergies.length > 0
                ? headerAllergies
                : allergyList.map((name) => ({ name, severity: undefined }))
            }
            nkda={headerNkda}
            medicationCount={medicationList.length}
            conditionCount={conditionCount}
            savedSections={savedSectionCount}
            totalSections={TAB_LIST.length}
            lastSavedAt={lastSavedAt}
            hasUnsavedChanges={hasUnsavedChanges}
            medicalHistoryDirty={medicalHistoryDirty}
            isSaving={isSaving || mhSaving}
            canEdit={canEdit}
            onSaveExam={handleSaveExamination}
            onComplete={handleCompleteExamination}
            visitLabel="Optometry examination"
            onViewDetails={() => setDemographicsOpen(true)}
            onBack={handleBackFromExam}
          />
        ) : (
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex items-center justify-center gap-3 text-gray-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-lg font-medium">No patient selected - Please select a patient from the queue</span>
            </div>
          </div>
        )}

        <LastVisitSummaryBar priorVisit={priorVisit} loading={priorLoading} />

        <ExamTabNav
          tabs={TAB_LIST}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          statusDotClass={tabStatusDot}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-slate-50 px-4 py-3">
        {!patientId ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-600">
            Select a patient from the queue to begin the examination.
          </div>
        ) : !examContextReady ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-48" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {activeTab === 'medical-history' && (
              <TabLastVisitLine tabId="medical-history" priorVisit={priorVisit} />
            )}
            <div className={activeTab === 'medical-history' ? undefined : 'hidden'} aria-hidden={activeTab !== 'medical-history'}>
              <MedicalHistoryTabContent
                ref={medicalHistoryRef}
                patientId={patientId}
                visitId={visitId}
                canEdit={canEdit}
                patientDetails={patientDetails}
                patientLoading={patientLoading}
                priorVisit={priorVisit}
                patientOptometryHistory={optometryPatientHistory}
                excludeVisitId={visitId}
                visitSnapshot={mhVisitSnapshot}
                draftSnapshot={
                  mhVisitSnapshot && medicalHistorySnapshotHasClinicalData(mhVisitSnapshot)
                    ? null
                    : mhDraftSnapshot
                }
                hydrationReady={mhHydrationReady}
                onUpdate={(updated) => setPatientDetails(updated)}
                onDirtyChange={handleMhDirtyChange}
                onAllergiesUpdated={handleAllergiesUpdated}
                onMhReviewed={() => {
                  mhReviewedAtRef.current = new Date().toISOString();
                  toast.success('Medical history marked as reviewed');
                }}
                onSnapshotChange={handleMhSnapshotChange}
                onPersistVisitBundle={
                  visitId && canEdit ? handlePersistMedicalHistoryBundle : undefined
                }
              />
            </div>

            {activeTab === 'visual-acuity' && (
              <>
                <TabLastVisitLine tabId="visual-acuity" priorVisit={priorVisit} />
              <VisualAcuityMegaTab
                patientId={patientId}
                visitId={visitId}
                priorVisit={priorVisit}
                visualAcuityData={visualAcuity}
                refractionData={refraction}
                autoRefractionData={autoRefraction}
                keratometryData={keratometry}
                colorVisionData={colorVision}
                contrastSensitivityData={contrastSensitivity}
                patientOptometryHistory={optometryPatientHistory}
                excludeVisitId={visitId}
                canEdit={canEdit}
                onDirtyChange={handleVaDirtyChange}
                vaExtended={vaExtended}
                onVaExtendedChange={handleVaExtendedChange}
                onSectionSaved={handleVaSectionSaved}
                onSyncClinicalDraft={handleSyncVaClinicalDraft}
                visitDateIso={visitDateIso}
              />
              </>
            )}

            {activeTab === 'retinoscopy' && (
              <>
                <TabLastVisitLine tabId="retinoscopy" priorVisit={priorVisit} />
              <RetinoscopyMegaTab
                wetRetinoscopyData={wetRetinoscopy}
                dryRetinoscopyData={dryRetinoscopy}
                subjectiveRefractionData={subjectiveRefraction}
                priorVisit={priorVisit}
                patientOptometryHistory={optometryPatientHistory}
                excludeVisitId={visitId}
                visitDateIso={visitDateIso}
                canEdit={canEdit}
                onDirtyChange={handleRetinoscopyDirtyChange}
                onTabRecordStateChange={handleRetinoscopyTabRecordState}
                onSaveWetRetinoscopy={(data) =>
                  saveOptometrySegment(
                    OPTOMETRY_SEGMENT_KEYS.wetRetinoscopy,
                    data,
                    'Wet retinoscopy',
                    setWetRetinoscopy,
                    undefined,
                    { toast: false },
                  )
                }
                onSaveDryRetinoscopy={(data) =>
                  saveOptometrySegment(
                    OPTOMETRY_SEGMENT_KEYS.dryRetinoscopy,
                    data,
                    'Dry retinoscopy',
                    setDryRetinoscopy,
                    undefined,
                    { toast: false },
                  )
                }
                onSaveSubjectiveRefraction={(data) =>
                  saveOptometrySegment(
                    OPTOMETRY_SEGMENT_KEYS.subjectiveRefraction,
                    data,
                    'Subjective refraction',
                    setSubjectiveRefraction,
                    undefined,
                    { toast: false },
                  )
                }
              />
              </>
            )}

            {activeTab === 'iop' && (
              <>
                <TabLastVisitLine tabId="iop" priorVisit={priorVisit} />
              <IOPMegaTab
                patientId={patientId}
                visitId={visitId}
                priorVisit={priorVisit}
                tonometryData={tonometry}
                pachymetryData={pachymetry}
                visualFieldData={visualField}
                canEdit={canEdit}
                onDirtyChange={(dirty) => {
                  if (dirty) markTabDirty('iop');
                }}
                iopExtended={iopExtended}
                onIopExtendedChange={handleIopExtendedChange}
                onSectionSaved={handleIopSectionSaved}
                onSyncClinicalDraft={handleSyncIopClinicalDraft}
                patientOptometryHistory={optometryPatientHistory}
                excludeVisitId={visitId}
              />
              </>
            )}

            {activeTab === 'anterior' && (
              <>
                <TabLastVisitLine tabId="anterior" priorVisit={priorVisit} />
              <AnteriorSegmentTab
                pupilExamData={pupilExam}
                anteriorSegmentData={anteriorSegment}
                priorVisit={priorVisit}
                chiefComplaint={complaintParam || patientDetails?.chiefComplaint}
                canEdit={canEdit}
                saving={anteriorSaving}
                onDirtyChange={(dirty) => {
                  if (dirty) markTabDirty('anterior');
                }}
                onSaveTab={async ({ pupil, segment }) => {
                  setAnteriorSaving(true);
                  try {
                    const bundle = buildAnteriorTabSegmentPayload({ pupil, segment });
                    const [a, b] = await Promise.all([
                      saveOptometrySegment(
                        OPTOMETRY_SEGMENT_KEYS.pupilExam,
                        bundle.pupil,
                        'Pupil exam',
                        setPupilExam,
                        undefined,
                        { toast: false },
                      ),
                      saveOptometrySegment(
                        OPTOMETRY_SEGMENT_KEYS.anteriorSegment,
                        bundle.segment,
                        'Anterior segment',
                        setAnteriorSegment,
                        undefined,
                        { toast: false },
                      ),
                    ]);
                    const ok = a && b;
                    if (ok && anteriorTabHasAnyData(bundle.pupil, bundle.segment)) {
                      markTabSaved('anterior');
                    }
                    return ok;
                  } finally {
                    setAnteriorSaving(false);
                  }
                }}
              />
              </>
            )}

            {activeTab === 'posterior' && (
              <>
                <TabLastVisitLine tabId="posterior" priorVisit={priorVisit} />
              <PosteriorSegmentTab
                posteriorSegmentData={posteriorSegment}
                fundusExamData={fundusExam}
                vitreousExamData={vitreousExam}
                peripheralRetinaExamData={peripheralRetinaExam}
                priorVisit={priorVisit}
                canEdit={canEdit}
                saving={posteriorSaving}
                onDirtyChange={(dirty) => {
                  if (dirty) markTabDirty('posterior');
                }}
                onSaveTab={async ({ overview, fundus, vitreous, peripheralRetina }) => {
                  setPosteriorSaving(true);
                  try {
                    const bundle = buildPosteriorTabSegmentPayload({
                      overview,
                      fundus,
                      vitreous,
                      peripheralRetina,
                    });
                    const [a, b, c, d] = await Promise.all([
                      saveOptometrySegment(
                        OPTOMETRY_SEGMENT_KEYS.posteriorSegment,
                        bundle.overview,
                        'Posterior overview',
                        setPosteriorSegment,
                        undefined,
                        { toast: false },
                      ),
                      saveOptometrySegment(
                        OPTOMETRY_SEGMENT_KEYS.fundusExam,
                        bundle.fundus,
                        'Fundus exam',
                        setFundusExam,
                        undefined,
                        { toast: false },
                      ),
                      saveOptometrySegment(
                        OPTOMETRY_SEGMENT_KEYS.vitreousExam,
                        bundle.vitreous,
                        'Vitreous exam',
                        setVitreousExam,
                        undefined,
                        { toast: false },
                      ),
                      saveOptometrySegment(
                        OPTOMETRY_SEGMENT_KEYS.peripheralRetinaExam,
                        bundle.peripheralRetina,
                        'Peripheral retina',
                        setPeripheralRetinaExam,
                        undefined,
                        { toast: false },
                      ),
                    ]);
                    const ok = a && b && c && d;
                    if (
                      ok &&
                      posteriorTabHasAnyData(
                        bundle.overview,
                        bundle.fundus,
                        bundle.vitreous,
                        bundle.peripheralRetina,
                      )
                    ) {
                      markTabSaved('posterior');
                    }
                    return ok;
                  } finally {
                    setPosteriorSaving(false);
                  }
                }}
              />
              </>
            )}

            {activeTab === 'medications' && (
              <MedicationsTab
                currentMedications={currentMedications}
                prescriptionItems={prescriptionItems}
                canEdit={canEdit}
                onSavePrescription={(items) =>
                  saveOptometrySegment(
                    OPTOMETRY_SEGMENT_KEYS.prescriptionItems,
                    items,
                    'Prescription',
                    setPrescriptionItems,
                    'medications',
                  )
                }
                onPrintPrescription={() => {
                  // TODO: Implement prescription PDF generation
                  toast.success('Print prescription (backend pending)');
                }}
                onEmailPrescription={() => {
                  // TODO: Implement email prescription to patient
                  toast.success('Email prescription (backend pending)');
                }}
              />
            )}

            {activeTab === 'optical-prescription' && (
              <>
                <TabLastVisitLine tabId="optical-prescription" priorVisit={priorVisit} />
              <ContactLensTab
                assessmentData={clAssessment}
                prescriptionData={clPrescription}
                fittingData={clFitting}
                cornealHealthData={clCornealHealth}
                instructionsData={clInstructions}
                spectacleData={spectacleDispensing}
                priorVisit={priorVisit}
                keratometryData={keratometry}
                canEdit={canEdit}
                onSpectacleChange={(data) => {
                  setSpectacleDispensing(data);
                  markTabDirty('optical-prescription');
                }}
                onPrefillSpectacleFromRefraction={prefillSpectacleFromRefraction}
                onSaveSpectacleBundle={() => saveOpticalBundle()}
                onSaveAssessment={(data) => saveOpticalBundle({ assessment: data })}
                onSavePrescription={(data) => saveOpticalBundle({ prescription: data })}
                onSaveFitting={(data) => saveOpticalBundle({ fitting: data })}
                onSaveCornealHealth={(data) => saveOpticalBundle({ cornealHealth: data })}
                onSaveInstructions={(data) => saveOpticalBundle({ instructions: data })}
                onPrintPrescription={() => {
                  // TODO: Implement CL prescription PDF generation
                  toast.success('Print CL prescription (backend pending)');
                }}
                onEmailPrescription={() => {
                  // TODO: Implement email CL prescription to patient
                  toast.success('Email CL prescription (backend pending)');
                }}
              />
              </>
            )}

            {activeTab === 'referral' && (
              <ReferralOrdersTab
                doctorReferrals={doctorReferrals}
                imagingOrders={imagingOrders}
                receptionReferrals={receptionReferrals}
                canEdit={canEdit}
                onSaveDoctorReferral={(referrals) =>
                  saveOptometrySegment(
                    OPTOMETRY_SEGMENT_KEYS.doctorReferrals,
                    referrals,
                    'Doctor referrals',
                    setDoctorReferrals,
                    'referral',
                  )
                }
                onSaveImagingOrders={(orders) =>
                  saveOptometrySegment(
                    OPTOMETRY_SEGMENT_KEYS.imagingOrders,
                    orders,
                    'Imaging orders',
                    setImagingOrders,
                    'referral',
                  )
                }
                onSaveReceptionReferral={(referrals) =>
                  saveOptometrySegment(
                    OPTOMETRY_SEGMENT_KEYS.receptionReferrals,
                    referrals,
                    'Reception referrals',
                    setReceptionReferrals,
                    'referral',
                  )
                }
                onPrintReferral={(id, type) => {
                  // TODO: Implement referral letter PDF generation
                  toast.success(`Print ${type} referral (backend pending)`);
                }}
              />
            )}

            {activeTab === 'diagnosis' && (
              <DiagnosisTab
                diagnoses={diagnoses}
                canEdit={canEdit}
                onSaveDiagnoses={(diagnosisList) =>
                  saveOptometrySegment(
                    OPTOMETRY_SEGMENT_KEYS.diagnoses,
                    diagnosisList,
                    'Diagnoses',
                    setDiagnoses,
                    'diagnosis',
                  )
                }
                onCopyPreviousDiagnoses={handleCopyPreviousDiagnoses}
                onPrintSummary={() => {
                  // TODO: Implement diagnosis summary PDF generation
                  toast.success('Print diagnosis summary (backend pending)');
                }}
              />
            )}

            {activeTab === 'advice' && (
              <AdvicePatientEducationTab
                instructions={adviceInstructions}
                followUp={adviceFollowUp}
                precautions={advicePrecautions}
                education={adviceEducation}
                diagnoses={diagnoses}
                canEdit={canEdit}
                onSaveInstructions={(instructions) => saveAdviceBundle({ instructions })}
                onSaveFollowUp={(followUp) => saveAdviceBundle({ followUp })}
                onSavePrecautions={(precautions) => saveAdviceBundle({ precautions })}
                onSaveEducation={(education) => saveAdviceBundle({ education })}
                onPrintInstructions={() => {
                  // TODO: Implement patient instructions PDF generation
                  toast.success('Print patient instructions (backend pending)');
                }}
                onPrintFullReport={() => {
                  // TODO: Implement full examination report PDF generation
                  toast.success('Print full report (backend pending)');
                }}
                onEmailAll={() => {
                  // TODO: Implement email delivery of all patient materials
                  toast.success('Email all materials to patient (backend pending)');
                }}
                onSendSMSReminder={() => {
                  // TODO: Implement SMS reminder functionality
                  toast.success('Send SMS reminder (backend pending)');
                }}
              />
            )}

          </div>
        )}
      </div>

      <UnsavedMedicalHistoryDialog
        isOpen={unsavedMhDialogOpen}
        isSaving={mhSaving}
        onStay={handleMhStay}
        onDiscard={handleMhDiscardAndContinue}
        onSaveAndContinue={handleMhSaveAndContinue}
      />

      <PatientDemographicsSheet
        open={demographicsOpen}
        onClose={() => setDemographicsOpen(false)}
        patient={patientDetails}
        age={patientAge}
      />
    </div>
  );
}

export default function OptometristExamPage() {
  return (
    <ProtectedRoute requiredPermission="CLINICAL:EXAMINATION:VIEW">
      <OptometristExamContent />
    </ProtectedRoute>
  );
}
