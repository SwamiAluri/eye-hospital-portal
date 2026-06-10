'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import toast from 'react-hot-toast';
import { ExamInput } from './ExamCard';
import { ExamSelectField } from './exam-ui/ExamSelectField';
import { Eye, TrendingUp, Palette, Grid, Glasses } from 'lucide-react';
import type {
  VisualAcuityData,
  RefractionData,
  AutoRefractionData,
  KeratometryData,
  ColorVisionData,
  ContrastSensitivityData,
} from '@/lib/stores/clinical-store';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';
import type { VaClinicalDraftSlice } from '@/lib/optometry/optometry-persistence';
import { buildVaClinicalSlice } from '@/lib/optometry/optometry-persistence';
import type { VisualAcuityMegaSnapshot } from '@/lib/optometry/exam-mappers';
import { useAuthStore } from '@/lib/auth-store';
import { RefractionBilateralTable } from './exam-ui/RefractionBilateralTable';
import { VaBilateralTable } from './exam-ui/VaBilateralTable';
import { KeratometryBilateralTable } from './exam-ui/KeratometryBilateralTable';
import { VaProjectionRaysSection } from './exam-ui/VaProjectionRaysSection';
import { RxBilateralPrescriptionCard, type EyeRx } from './exam-ui/RxBilateralPrescriptionCard';
import { VisualAcuityLayout } from './visual-acuity/VisualAcuityLayout';
import { VaSectionCard } from './visual-acuity/VaSectionCard';
import { VaSectionRecordedRail } from './visual-acuity/VaSectionRecordedRail';
import {
  type VaSectionId,
  type VaSectionRecordStatus,
  VA_SECTIONS,
} from '@/lib/optometry/visual-acuity-constants';
import { isVaSectionEditableOnVisitDay } from '@/lib/optometry/va-section-edit-lock';
import { hasPriorHistoryForSection } from '@/lib/optometry/va-section-history';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';
import {
  applySectionSnapshot,
  buildEffectiveVaFormState,
  clearSectionLiveState,
  extractSectionSnapshot,
  normalizeVaSectionViewMode,
  hasSectionShellContent,
  hasSectionLiveContent,
  applyShellToLiveState,
  applyShellToMegaState,
  EMPTY_COLOR_VISION,
  EMPTY_CONTRAST,
  EMPTY_KERATOMETRY,
  EMPTY_REFRACTION,
  EMPTY_RX_BILATERAL,
  EMPTY_VA_BILATERAL,
  type VaMegaFormState,
  type VaSectionSnapshotMap,
  type VaSectionViewMode,
} from '@/lib/optometry/va-section-snapshot';
import {
  buildVaExtendedDraft,
  buildVisualAcuityBundleFromExtended,
} from '@/lib/optometry/build-segment-bundles';
import { persistSegmentBundle } from '@/lib/optometry/persist-segment-bundle';
import { OPTOMETRY_SEGMENT_KEYS } from '@/lib/optometry/optometry-segment-keys';

interface VisualAcuityMegaTabProps {
  patientId: string;
  visitId?: string;
  visualAcuityData: VisualAcuityData | null;
  refractionData: RefractionData | null;
  autoRefractionData: AutoRefractionData | null;
  keratometryData: KeratometryData | null;
  colorVisionData: ColorVisionData | null;
  contrastSensitivityData: ContrastSensitivityData | null;
  priorVisit?: PriorVisitSnapshot | null;
  canEdit: boolean;
  onSyncClinicalDraft: (slice: VaClinicalDraftSlice) => void;
  vaHistory?: unknown[];
  refHistory?: unknown[];
  patientOptometryHistory?: OptometryVisitExamRecord[];
  excludeVisitId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  vaExtended?: unknown;
  onVaExtendedChange?: (data: unknown) => void;
  onSectionSaved?: () => void;
  /** Hospital-local visit day for section edit lock (checked-in / appointment date). */
  visitDateIso?: string | null;
}

const COLOR_TEST_TYPES = [
  'Ishihara',
  'D-15',
  'HRR',
  'HRR (Hardy-Rand-Rittler)',
  'Farnsworth-Munsell 100',
];
const COLOR_RESULTS = [
  'Normal',
  'Protan defect',
  'Protan defect (Red-weak)',
  'Deutan defect',
  'Deutan defect (Green-weak)',
  'Tritan defect',
  'Tritan defect (Blue-weak)',
  'Total color blindness',
];
const CONTRAST_TEST_TYPES = ['Pelli-Robson', 'MARS', 'CSV-1000'];

function countRxFields(rx: { OD: EyeRx; OS: EyeRx }): number {
  let n = 0;
  (['OD', 'OS'] as const).forEach((eye) => {
    (['sphere', 'cylinder', 'axis', 'va'] as const).forEach((k) => {
      if (rx[eye][k]) n += 1;
    });
  });
  return n;
}

function countRefractionFields(r: { OD: { sphere: string; cylinder: string; axis: string }; OS: { sphere: string; cylinder: string; axis: string } }): number {
  return countRxFields({ OD: { ...r.OD, va: '' }, OS: { ...r.OS, va: '' } });
}

function countVaFields(d: { OD: { unaided: string; aided: string }; OS: { unaided: string; aided: string } }): number {
  let n = 0;
  (['OD', 'OS'] as const).forEach((eye) => {
    if (d[eye].unaided) n += 1;
    if (d[eye].aided) n += 1;
  });
  return n;
}

export default function VisualAcuityMegaTab({
  patientId,
  visitId,
  visualAcuityData,
  refractionData,
  autoRefractionData: _autoRefractionData,
  keratometryData,
  colorVisionData,
  contrastSensitivityData,
  priorVisit,
  canEdit,
  onSyncClinicalDraft,
  vaHistory = [],
  refHistory = [],
  patientOptometryHistory,
  excludeVisitId,
  onDirtyChange,
  vaExtended,
  onVaExtendedChange,
  onSectionSaved,
  visitDateIso,
}: VisualAcuityMegaTabProps) {
  const { user } = useAuthStore();
  const [oldGlass, setOldGlass] = useState({
    OD: { sphere: '', cylinder: '', axis: '', va: '' },
    OS: { sphere: '', cylinder: '', axis: '', va: '' },
  });
  const [newPrescription, setNewPrescription] = useState({
    OD: { sphere: '', cylinder: '', axis: '', va: '' },
    OS: { sphere: '', cylinder: '', axis: '', va: '' },
  });
  const [distanceVision, setDistanceVision] = useState({
    OD: { unaided: '', aided: '' },
    OS: { unaided: '', aided: '' },
  });
  const [projectionRays, setProjectionRays] = useState({
    OD: {
      unaided: { superior: false, inferior: false, nasal: false, temporal: false },
      aided: { superior: false, inferior: false, nasal: false, temporal: false },
    },
    OS: {
      unaided: { superior: false, inferior: false, nasal: false, temporal: false },
      aided: { superior: false, inferior: false, nasal: false, temporal: false },
    },
  });
  const [nearVision, setNearVision] = useState({
    OD: { unaided: '', aided: '' },
    OS: { unaided: '', aided: '' },
  });
  const [refraction, setRefraction] = useState({
    OD: { sphere: '', cylinder: '', axis: '' },
    OS: { sphere: '', cylinder: '', axis: '' },
  });
  const [keratometry, setKeratometry] = useState({
    OD: { k1: '', k2: '', axis: '' },
    OS: { k1: '', k2: '', axis: '' },
  });
  const [colorVision, setColorVision] = useState({
    testType: 'Ishihara',
    result: 'Normal',
    platesMissed: '',
  });
  const [contrastSensitivity, setContrastSensitivity] = useState({
    testType: 'Pelli-Robson',
    OD: { score: '', interpretation: '' },
    OS: { score: '', interpretation: '' },
  });

  const [sectionDirty, setSectionDirty] = useState<Partial<Record<VaSectionId, boolean>>>({});
  const [sectionRecorded, setSectionRecorded] = useState<Partial<Record<VaSectionId, boolean>>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [savingSection, setSavingSection] = useState<VaSectionId | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<VaSectionId>>(
    () => new Set(['old']),
  );
  const [sectionViewMode, setSectionViewMode] = useState<
    Partial<Record<VaSectionId, VaSectionViewMode>>
  >({});
  const [sectionRecordedAt, setSectionRecordedAt] = useState<
    Partial<Record<VaSectionId, string>>
  >({});
  const [sectionSnapshots, setSectionSnapshots] = useState<VaSectionSnapshotMap>({});
  /** Ephemeral UI values for recorded sections in view mode (Select defaults, edits before Edit). */
  const [sectionShells, setSectionShells] = useState<VaSectionSnapshotMap>({});

  const clearSectionShell = useCallback((sectionId: VaSectionId) => {
    setSectionShells((prev) => {
      if (prev[sectionId] == null) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  }, []);

  const getMegaFormState = useCallback(
    (): VaMegaFormState => ({
      oldGlass,
      newPrescription,
      refraction,
      distanceVision,
      nearVision,
      projectionRays,
      keratometry,
      colorVision,
      contrastSensitivity,
    }),
    [
      oldGlass,
      newPrescription,
      refraction,
      distanceVision,
      nearVision,
      projectionRays,
      keratometry,
      colorVision,
      contrastSensitivity,
    ],
  );

  const sectionSetters = useMemo(
    () => ({
      setOldGlass,
      setNewPrescription,
      setRefraction,
      setDistanceVision,
      setNearVision,
      setProjectionRays,
      setKeratometry,
      setColorVision,
      setContrastSensitivity,
    }),
    [],
  );

  const isSectionEditLocked = useCallback(
    (id: VaSectionId) =>
      Boolean(
        sectionRecordedAt[id] &&
          !isVaSectionEditableOnVisitDay(sectionRecordedAt[id], visitDateIso),
      ),
    [sectionRecordedAt, visitDateIso],
  );

  const getViewMode = useCallback(
    (id: VaSectionId): VaSectionViewMode => {
      if (isSectionEditLocked(id)) return 'view';
      if (!sectionRecorded[id]) return 'editing';
      return normalizeVaSectionViewMode(sectionViewMode[id]);
    },
    [sectionRecorded, sectionViewMode, isSectionEditLocked],
  );

  const shouldSyncSection = useCallback(
    (id: VaSectionId) => !sectionRecorded[id] || getViewMode(id) === 'editing',
    [sectionRecorded, getViewMode],
  );

  const vaExtHydratedRef = useRef(false);
  const vaExtDraftAppliedRef = useRef(false);
  const clinicalPrefillAppliedRef = useRef(false);
  const priorVisitPrefillAppliedRef = useRef(false);
  const vaExtendedSyncJsonRef = useRef<string>('');
  const pushVaExtendedRef = useRef<() => void>(() => {});

  const markSectionDirty = useCallback(
    (id: VaSectionId) => {
      if (!shouldSyncSection(id)) return;
      setSectionDirty((prev) => ({ ...prev, [id]: true }));
      setHasChanges(true);
      onDirtyChange?.(true);
      queueMicrotask(() => pushVaExtendedRef.current());
    },
    [onDirtyChange, shouldSyncSection],
  );

  useEffect(() => {
    vaExtHydratedRef.current = false;
    vaExtDraftAppliedRef.current = false;
    clinicalPrefillAppliedRef.current = false;
    priorVisitPrefillAppliedRef.current = false;
    vaExtendedSyncJsonRef.current = '';
  }, [patientId]);

  useEffect(() => {
    if (!vaExtended || vaExtHydratedRef.current) return;
    const ext = vaExtended as {
      projectionRays?: typeof projectionRays;
      distanceVision?: typeof distanceVision;
      nearVision?: typeof nearVision;
      oldGlass?: typeof oldGlass;
      newPrescription?: typeof newPrescription;
      refraction?: typeof refraction;
      keratometry?: typeof keratometry;
      colorVision?: typeof colorVision;
      contrastSensitivity?: typeof contrastSensitivity;
      sectionRecorded?: Partial<Record<VaSectionId, boolean>>;
      sectionDirty?: Partial<Record<VaSectionId, boolean>>;
      sectionViewMode?: Partial<Record<VaSectionId, VaSectionViewMode | 'summary' | 'edit'>>;
      sectionRecordedAt?: Partial<Record<VaSectionId, string>>;
      sectionSnapshots?: VaSectionSnapshotMap;
    };
    if (ext.projectionRays) setProjectionRays(ext.projectionRays);
    if (ext.distanceVision) setDistanceVision(ext.distanceVision);
    if (ext.nearVision) setNearVision(ext.nearVision);
    if (ext.oldGlass) setOldGlass(ext.oldGlass);
    if (ext.newPrescription) setNewPrescription(ext.newPrescription);
    if (ext.refraction) setRefraction(ext.refraction);
    if (ext.keratometry) setKeratometry(ext.keratometry);
    if (ext.colorVision) setColorVision(ext.colorVision);
    if (ext.contrastSensitivity) setContrastSensitivity(ext.contrastSensitivity);
    if (ext.sectionRecorded) setSectionRecorded(ext.sectionRecorded);
    if (ext.sectionDirty) setSectionDirty(ext.sectionDirty);
    const hydratedState: VaMegaFormState = {
      oldGlass: ext.oldGlass ?? oldGlass,
      newPrescription: ext.newPrescription ?? newPrescription,
      refraction: ext.refraction ?? refraction,
      distanceVision: ext.distanceVision ?? distanceVision,
      nearVision: ext.nearVision ?? nearVision,
      projectionRays: ext.projectionRays ?? projectionRays,
      keratometry: ext.keratometry ?? keratometry,
      colorVision: ext.colorVision ?? colorVision,
      contrastSensitivity: ext.contrastSensitivity ?? contrastSensitivity,
    };
    const backfilledSnapshots: VaSectionSnapshotMap = { ...(ext.sectionSnapshots ?? {}) };
    if (ext.sectionRecorded) {
      VA_SECTIONS.forEach((s) => {
        if (ext.sectionRecorded?.[s.id] && backfilledSnapshots[s.id] == null) {
          backfilledSnapshots[s.id] = extractSectionSnapshot(s.id, hydratedState);
        }
      });
    }
    setSectionSnapshots(backfilledSnapshots);
    if (ext.sectionViewMode) {
      const normalized: Partial<Record<VaSectionId, VaSectionViewMode>> = {};
      (Object.entries(ext.sectionViewMode) as [VaSectionId, VaSectionViewMode | 'summary' | 'edit'][]).forEach(
        ([k, v]) => {
          normalized[k] = normalizeVaSectionViewMode(v);
        },
      );
      setSectionViewMode(normalized);
    }
    if (ext.sectionRecordedAt) setSectionRecordedAt(ext.sectionRecordedAt);
    if (ext.sectionRecorded) {
      VA_SECTIONS.forEach((s) => {
        if (ext.sectionRecorded?.[s.id]) {
          const mode = normalizeVaSectionViewMode(ext.sectionViewMode?.[s.id]);
          if (mode !== 'editing') {
            clearSectionLiveState(s.id, sectionSetters);
          }
        }
      });
    }
    vaExtDraftAppliedRef.current = true;
    vaExtHydratedRef.current = true;
    queueMicrotask(() => pushVaExtendedRef.current());
  }, [vaExtended, sectionSetters]);

  const getCSInterpretation = (score: number): string => {
    if (score >= 1.65) return 'Normal';
    if (score >= 1.5) return 'Borderline';
    return 'Reduced';
  };

  const calculateAverageK = (k1: string, k2: string): string => {
    const k1Num = parseFloat(k1);
    const k2Num = parseFloat(k2);
    if (!isNaN(k1Num) && !isNaN(k2Num)) {
      return ((k1Num + k2Num) / 2).toFixed(2);
    }
    return '';
  };

  const calculateAstigmatism = (k1: string, k2: string): string => {
    const k1Num = parseFloat(k1);
    const k2Num = parseFloat(k2);
    if (!isNaN(k1Num) && !isNaN(k2Num)) {
      return Math.abs(k2Num - k1Num).toFixed(2);
    }
    return '';
  };

  const calculatePowerChange = (oldSphere: string, newSphere: string): string => {
    const old = parseFloat(oldSphere);
    const newVal = parseFloat(newSphere);
    if (!isNaN(old) && !isNaN(newVal)) {
      const diff = newVal - old;
      return diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
    }
    return '';
  };

  const getEffectiveFormState = useCallback(() => {
    return buildEffectiveVaFormState(
      getMegaFormState(),
      sectionRecorded,
      sectionViewMode,
      sectionSnapshots,
    );
  }, [getMegaFormState, sectionRecorded, sectionViewMode, sectionSnapshots]);

  const syncDraftFromForm = useCallback(
    (formState: VaMegaFormState, persistSectionId?: VaSectionId) => {
      const examinerId = user?.id || '';
      const viewModeForSync =
        persistSectionId != null
          ? { ...sectionViewMode, [persistSectionId]: 'editing' as VaSectionViewMode }
          : sectionViewMode;
      const effective = buildEffectiveVaFormState(
        formState,
        sectionRecorded,
        viewModeForSync,
        sectionSnapshots,
      );
      const snap: VisualAcuityMegaSnapshot = {
        distanceVision: effective.distanceVision,
        nearVision: effective.nearVision,
        oldGlass: effective.oldGlass,
        newPrescription: effective.newPrescription,
        refraction: effective.refraction,
        keratometry: effective.keratometry,
        colorVision: effective.colorVision,
        contrastSensitivity: effective.contrastSensitivity,
      };
      return buildVaClinicalSlice(patientId, examinerId, snap, {
        visualAcuity: visualAcuityData,
        refraction: refractionData,
        keratometry: keratometryData,
        colorVision: colorVisionData,
        contrastSensitivity: contrastSensitivityData,
      });
    },
    [
      user?.id,
      patientId,
      sectionRecorded,
      sectionViewMode,
      sectionSnapshots,
      visualAcuityData,
      refractionData,
      keratometryData,
      colorVisionData,
      contrastSensitivityData,
    ],
  );

  const syncDraft = useCallback(
    () => syncDraftFromForm(getMegaFormState()),
    [syncDraftFromForm, getMegaFormState],
  );

  const pushVaExtended = useCallback(() => {
    if (!onVaExtendedChange) return;
    const payload = {
      projectionRays,
      distanceVision,
      nearVision,
      oldGlass,
      newPrescription,
      refraction,
      keratometry,
      colorVision,
      contrastSensitivity,
      sectionRecorded,
      sectionDirty,
      sectionViewMode,
      sectionRecordedAt,
      sectionSnapshots,
    };
    const json = JSON.stringify(payload);
    if (json === vaExtendedSyncJsonRef.current) return;
    vaExtendedSyncJsonRef.current = json;
    onVaExtendedChange(payload);
  }, [
    onVaExtendedChange,
    projectionRays,
    distanceVision,
    nearVision,
    oldGlass,
    newPrescription,
    refraction,
    keratometry,
    colorVision,
    contrastSensitivity,
    sectionRecorded,
    sectionDirty,
    sectionViewMode,
    sectionRecordedAt,
    sectionSnapshots,
  ]);

  pushVaExtendedRef.current = pushVaExtended;

  const schedulePushVaExtended = useCallback(() => {
    queueMicrotask(() => pushVaExtendedRef.current());
  }, []);

  const hasSectionFormContent = useCallback(
    (id: VaSectionId): boolean => {
      const mode = getViewMode(id);
      if (!sectionRecorded[id] || mode === 'editing') {
        return hasSectionLiveContent(id, getMegaFormState());
      }
      return hasSectionShellContent(id, sectionShells[id]);
    },
    [getViewMode, sectionRecorded, getMegaFormState, sectionShells],
  );

  const sectionShowRail = useCallback(
    (id: VaSectionId): boolean => {
      if (sectionRecorded[id]) return true;
      return hasPriorHistoryForSection(id, patientOptometryHistory ?? []);
    },
    [sectionRecorded, patientOptometryHistory],
  );

  const persistVaSection = useCallback(
    async (sectionId: VaSectionId, isUpdate: boolean) => {
      if (!canEdit || !patientId) return;
      setSavingSection(sectionId);
      try {
        const shell = sectionShells[sectionId];
        const mergedForm = shell
          ? applyShellToMegaState(sectionId, getMegaFormState(), shell)
          : getMegaFormState();
        flushSync(() => {
          applyShellToLiveState(sectionId, shell, sectionSetters);
        });
        const label = VA_SECTIONS.find((s) => s.id === sectionId)?.label ?? 'Section';
        const snap = extractSectionSnapshot(sectionId, mergedForm);
        const now = new Date().toISOString();
        const nextRecorded = { ...sectionRecorded, [sectionId]: true };
        const nextSnapshots = { ...sectionSnapshots, [sectionId]: snap };
        const nextViewMode = { ...sectionViewMode, [sectionId]: 'view' as VaSectionViewMode };
        const nextDirty = { ...sectionDirty, [sectionId]: false };
        const nextRecordedAt = { ...sectionRecordedAt, [sectionId]: now };

        const effectiveForm = buildEffectiveVaFormState(
          mergedForm,
          nextRecorded,
          nextViewMode,
          nextSnapshots,
        );
        onSyncClinicalDraft(syncDraftFromForm(mergedForm, sectionId));

        const extPayload = buildVaExtendedDraft({
          projectionRays: effectiveForm.projectionRays,
          distanceVision: effectiveForm.distanceVision,
          nearVision: effectiveForm.nearVision,
          oldGlass: effectiveForm.oldGlass,
          newPrescription: effectiveForm.newPrescription,
          refraction: effectiveForm.refraction,
          keratometry: effectiveForm.keratometry,
          colorVision: effectiveForm.colorVision,
          contrastSensitivity: effectiveForm.contrastSensitivity,
          sectionRecorded: nextRecorded,
          sectionDirty: nextDirty,
          sectionViewMode: nextViewMode,
          sectionRecordedAt: nextRecordedAt,
          sectionSnapshots: nextSnapshots,
        });

        if (visitId) {
          await persistSegmentBundle(
            visitId,
            patientId,
            OPTOMETRY_SEGMENT_KEYS.visualAcuityBundle,
            buildVisualAcuityBundleFromExtended(extPayload),
          );
        }

        setSectionSnapshots(nextSnapshots);
        clearSectionLiveState(sectionId, sectionSetters);
        clearSectionShell(sectionId);
        setSectionRecorded(nextRecorded);
        setSectionRecordedAt(nextRecordedAt);
        setSectionViewMode(nextViewMode);
        setSectionDirty((prev) => {
          const next = { ...prev, [sectionId]: false };
          const anyDirty = VA_SECTIONS.some((s) => next[s.id]);
          if (!anyDirty) {
            setHasChanges(false);
            onDirtyChange?.(false);
          }
          return next;
        });

        vaExtendedSyncJsonRef.current = JSON.stringify(extPayload);
        onVaExtendedChange?.(extPayload);
        onSectionSaved?.();
        toast.success(isUpdate ? `${label} updated` : `${label} saved`);
      } catch (e) {
        console.error(e);
        toast.error(
          `Failed to save ${VA_SECTIONS.find((s) => s.id === sectionId)?.label ?? 'section'}`,
        );
      } finally {
        setSavingSection(null);
      }
    },
    [
      canEdit,
      patientId,
      visitId,
      sectionShells,
      sectionSetters,
      syncDraftFromForm,
      onSyncClinicalDraft,
      getMegaFormState,
      clearSectionShell,
      onSectionSaved,
      onDirtyChange,
      onVaExtendedChange,
      sectionRecorded,
      sectionViewMode,
      sectionSnapshots,
      sectionDirty,
      sectionRecordedAt,
    ],
  );

  const recordVaSection = useCallback(
    (sectionId: VaSectionId) => {
      if (getViewMode(sectionId) === 'editing' && sectionRecorded[sectionId]) return;
      if (!hasSectionFormContent(sectionId)) return;
      persistVaSection(sectionId, false);
    },
    [getViewMode, sectionRecorded, hasSectionFormContent, persistVaSection],
  );

  const updateVaSection = useCallback(
    (sectionId: VaSectionId) => {
      if (getViewMode(sectionId) !== 'editing' || !sectionRecorded[sectionId]) return;
      if (!hasSectionFormContent(sectionId)) return;
      persistVaSection(sectionId, true);
    },
    [getViewMode, sectionRecorded, hasSectionFormContent, persistVaSection],
  );

  const enterSectionEdit = useCallback(
    (sectionId: VaSectionId) => {
      clearSectionShell(sectionId);
      const snap = sectionSnapshots[sectionId];
      if (snap != null) {
        applySectionSnapshot(sectionId, snap, sectionSetters);
      }
      setSectionViewMode((prev) => ({ ...prev, [sectionId]: 'editing' }));
      setExpandedSections((prev) => {
        const next = new Set(prev);
        next.add(sectionId);
        return next;
      });
      schedulePushVaExtended();
      requestAnimationFrame(() => {
        const anchor = VA_SECTIONS.find((s) => s.id === sectionId)?.anchor;
        document.getElementById(anchor ?? `va-section-${sectionId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    },
    [sectionSnapshots, sectionSetters, clearSectionShell, schedulePushVaExtended],
  );

  const exitSectionEdit = useCallback(
    (sectionId: VaSectionId) => {
      clearSectionLiveState(sectionId, sectionSetters);
      clearSectionShell(sectionId);
      setSectionViewMode((prev) => ({ ...prev, [sectionId]: 'view' }));
      setSectionDirty((prev) => {
        const next = { ...prev, [sectionId]: false };
        const anyDirty = VA_SECTIONS.some((s) => next[s.id]);
        if (!anyDirty) {
          setHasChanges(false);
          onDirtyChange?.(false);
        }
        return next;
      });
      schedulePushVaExtended();
    },
    [sectionSetters, clearSectionShell, onDirtyChange, schedulePushVaExtended],
  );

  const displayOldGlass = useMemo(() => {
    if (!sectionRecorded.old || getViewMode('old') === 'editing') return oldGlass;
    return (sectionShells.old as typeof oldGlass) ?? EMPTY_RX_BILATERAL;
  }, [oldGlass, sectionRecorded.old, sectionViewMode, sectionShells, getViewMode]);

  const displayNewPrescription = useMemo(() => {
    if (!sectionRecorded.new || getViewMode('new') === 'editing') return newPrescription;
    return (sectionShells.new as typeof newPrescription) ?? EMPTY_RX_BILATERAL;
  }, [newPrescription, sectionRecorded.new, sectionViewMode, sectionShells, getViewMode]);

  const displayRefraction = useMemo(() => {
    if (!sectionRecorded.refraction || getViewMode('refraction') === 'editing') return refraction;
    return (sectionShells.refraction as typeof refraction) ?? EMPTY_REFRACTION;
  }, [refraction, sectionRecorded.refraction, sectionViewMode, sectionShells, getViewMode]);

  const displayDistanceVision = useMemo(() => {
    if (!sectionRecorded.distance || getViewMode('distance') === 'editing') return distanceVision;
    const shell = sectionShells.distance as { distanceVision?: typeof distanceVision } | undefined;
    return shell?.distanceVision ?? EMPTY_VA_BILATERAL;
  }, [distanceVision, sectionRecorded.distance, sectionViewMode, sectionShells, getViewMode]);

  const displayNearVision = useMemo(() => {
    if (!sectionRecorded.distance || getViewMode('distance') === 'editing') return nearVision;
    const shell = sectionShells.distance as { nearVision?: typeof nearVision } | undefined;
    return shell?.nearVision ?? EMPTY_VA_BILATERAL;
  }, [nearVision, sectionRecorded.distance, sectionViewMode, sectionShells, getViewMode]);

  const displayKeratometry = useMemo(() => {
    if (!sectionRecorded.keratometry || getViewMode('keratometry') === 'editing') return keratometry;
    return (sectionShells.keratometry as typeof keratometry) ?? EMPTY_KERATOMETRY;
  }, [keratometry, sectionRecorded.keratometry, sectionViewMode, sectionShells, getViewMode]);

  const displayColorVision = useMemo(() => {
    if (!sectionRecorded.color || getViewMode('color') === 'editing') return colorVision;
    return (sectionShells.color as typeof colorVision) ?? EMPTY_COLOR_VISION;
  }, [colorVision, sectionRecorded.color, sectionViewMode, sectionShells, getViewMode]);

  const displayContrastSensitivity = useMemo(() => {
    if (!sectionRecorded.contrast || getViewMode('contrast') === 'editing') return contrastSensitivity;
    return (sectionShells.contrast as typeof contrastSensitivity) ?? EMPTY_CONTRAST;
  }, [contrastSensitivity, sectionRecorded.contrast, sectionViewMode, sectionShells, getViewMode]);

  const emptyProjectionRays = useMemo(
    () => ({
      OD: {
        unaided: { superior: false, inferior: false, nasal: false, temporal: false },
        aided: { superior: false, inferior: false, nasal: false, temporal: false },
      },
      OS: {
        unaided: { superior: false, inferior: false, nasal: false, temporal: false },
        aided: { superior: false, inferior: false, nasal: false, temporal: false },
      },
    }),
    [],
  );

  const displayProjectionRays = useMemo(() => {
    if (!sectionRecorded.distance || getViewMode('distance') === 'editing') return projectionRays;
    const shell = sectionShells.distance as { projectionRays?: typeof projectionRays } | undefined;
    return shell?.projectionRays ?? emptyProjectionRays;
  }, [projectionRays, sectionRecorded.distance, sectionViewMode, sectionShells, getViewMode, emptyProjectionRays]);

  const effectiveForPower = useMemo(() => getEffectiveFormState(), [getEffectiveFormState]);

  const getSectionStatus = (id: VaSectionId): VaSectionRecordStatus => {
    if (sectionRecorded[id] && !sectionDirty[id]) return 'recorded';
    if (sectionDirty[id]) return 'draft';
    return 'empty';
  };

  const sectionCounts = useMemo(
    (): Partial<Record<VaSectionId, number>> => ({
      old: countRxFields(oldGlass),
      new: countRxFields(newPrescription),
      refraction: countRefractionFields(refraction),
      distance: countVaFields(distanceVision) + countVaFields(nearVision),
      keratometry:
        (keratometry.OD.k1 ? 1 : 0) +
        (keratometry.OD.k2 ? 1 : 0) +
        (keratometry.OS.k1 ? 1 : 0) +
        (keratometry.OS.k2 ? 1 : 0),
      color: (colorVision.result !== 'Normal' ? 1 : 0) + (colorVision.platesMissed ? 1 : 0),
      contrast: (contrastSensitivity.OD.score ? 1 : 0) + (contrastSensitivity.OS.score ? 1 : 0),
    }),
    [oldGlass, newPrescription, refraction, distanceVision, nearVision, keratometry, colorVision, contrastSensitivity],
  );

  const sectionStatus = useMemo((): Partial<Record<VaSectionId, VaSectionRecordStatus>> => {
    const out: Partial<Record<VaSectionId, VaSectionRecordStatus>> = {};
    VA_SECTIONS.forEach((s) => {
      if (sectionRecorded[s.id] && !sectionDirty[s.id]) out[s.id] = 'recorded';
      else if (sectionDirty[s.id]) out[s.id] = 'draft';
      else out[s.id] = 'empty';
    });
    return out;
  }, [sectionRecorded, sectionDirty]);

  const handleSidebarNavigate = useCallback((id: VaSectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleManualExpand = useCallback((id: VaSectionId, open: boolean) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const canEditSection = useCallback(
    (id: VaSectionId) => canEdit && !isSectionEditLocked(id),
    [canEdit, isSectionEditLocked],
  );

  const powerChangeOd = useMemo(() => {
    const o = effectiveForPower.oldGlass;
    const n = effectiveForPower.newPrescription;
    return o.OD.sphere && n.OD.sphere
      ? `${calculatePowerChange(o.OD.sphere, n.OD.sphere)} D`
      : undefined;
  }, [effectiveForPower]);

  const powerChangeOs = useMemo(() => {
    const o = effectiveForPower.oldGlass;
    const n = effectiveForPower.newPrescription;
    return o.OS.sphere && n.OS.sphere
      ? `${calculatePowerChange(o.OS.sphere, n.OS.sphere)} D`
      : undefined;
  }, [effectiveForPower]);

  const recordedRail = (id: VaSectionId) => (
    <VaSectionRecordedRail
      sectionId={id}
      snapshot={sectionSnapshots[id]}
      formState={getMegaFormState()}
      recordedAt={sectionRecordedAt[id]}
      isEditing={getViewMode(id) === 'editing'}
      canEdit={canEdit}
      editLocked={isSectionEditLocked(id)}
      onEdit={() => enterSectionEdit(id)}
      vaHistory={vaHistory}
      refHistory={refHistory}
      patientOptometryHistory={patientOptometryHistory}
      excludeVisitId={excludeVisitId}
      powerChangeOd={id === 'new' ? powerChangeOd : undefined}
      powerChangeOs={id === 'new' ? powerChangeOs : undefined}
    />
  );

  const sectionCardProps = (id: VaSectionId) => ({
    sectionId: id,
    recordStatus: getSectionStatus(id),
    canEdit: canEditSection(id),
    saving: savingSection === id,
    showRail: sectionShowRail(id),
    hasFormContent: hasSectionFormContent(id),
    onRecord: () => recordVaSection(id),
    onUpdate: () => updateVaSection(id),
    expanded: expandedSections.has(id),
    onExpandedChange: (open: boolean) => handleManualExpand(id, open),
    viewMode: getViewMode(id),
    onDoneEditing: () => exitSectionEdit(id),
    recordedRail: recordedRail(id),
  });

  useEffect(() => {
    if (clinicalPrefillAppliedRef.current || vaExtDraftAppliedRef.current) return;
    if (
      !visualAcuityData &&
      !refractionData &&
      !keratometryData &&
      !colorVisionData &&
      !contrastSensitivityData
    ) {
      return;
    }
    clinicalPrefillAppliedRef.current = true;
    if (visualAcuityData) {
      setDistanceVision({
        OD: {
          unaided: visualAcuityData.distance?.OD?.unaided || '',
          aided: visualAcuityData.distance?.OD?.aided || '',
        },
        OS: {
          unaided: visualAcuityData.distance?.OS?.unaided || '',
          aided: visualAcuityData.distance?.OS?.aided || '',
        },
      });
      setNearVision({
        OD: {
          unaided: visualAcuityData.near?.OD?.unaided || '',
          aided: visualAcuityData.near?.OD?.aided || '',
        },
        OS: {
          unaided: visualAcuityData.near?.OS?.unaided || '',
          aided: visualAcuityData.near?.OS?.aided || '',
        },
      });
    }
    if (refractionData) {
      setRefraction({
        OD: {
          sphere: refractionData.finalRx?.OD?.sphere || '',
          cylinder: refractionData.finalRx?.OD?.cylinder || '',
          axis: refractionData.finalRx?.OD?.axis || '',
        },
        OS: {
          sphere: refractionData.finalRx?.OS?.sphere || '',
          cylinder: refractionData.finalRx?.OS?.cylinder || '',
          axis: refractionData.finalRx?.OS?.axis || '',
        },
      });
      if (refractionData.startingRx) {
        setOldGlass({
          OD: {
            sphere: refractionData.startingRx.OD?.sphere || '',
            cylinder: refractionData.startingRx.OD?.cylinder || '',
            axis: refractionData.startingRx.OD?.axis || '',
            va: refractionData.startingRx.OD?.visualAcuity || '',
          },
          OS: {
            sphere: refractionData.startingRx.OS?.sphere || '',
            cylinder: refractionData.startingRx.OS?.cylinder || '',
            axis: refractionData.startingRx.OS?.axis || '',
            va: refractionData.startingRx.OS?.visualAcuity || '',
          },
        });
      }
      setNewPrescription({
        OD: {
          sphere: refractionData.finalRx?.OD?.sphere || '',
          cylinder: refractionData.finalRx?.OD?.cylinder || '',
          axis: refractionData.finalRx?.OD?.axis || '',
          va: refractionData.finalRx?.OD?.visualAcuity || '',
        },
        OS: {
          sphere: refractionData.finalRx?.OS?.sphere || '',
          cylinder: refractionData.finalRx?.OS?.cylinder || '',
          axis: refractionData.finalRx?.OS?.axis || '',
          va: refractionData.finalRx?.OS?.visualAcuity || '',
        },
      });
    }
    if (keratometryData) {
      setKeratometry({
        OD: {
          k1: keratometryData.OD?.k1 || '',
          k2: keratometryData.OD?.k2 || '',
          axis: keratometryData.OD?.axis || '',
        },
        OS: {
          k1: keratometryData.OS?.k1 || '',
          k2: keratometryData.OS?.k2 || '',
          axis: keratometryData.OS?.axis || '',
        },
      });
    }
    if (colorVisionData) {
      setColorVision({
        testType: colorVisionData.testType || 'Ishihara',
        result: colorVisionData.result || 'Normal',
        platesMissed: colorVisionData.platesMissed || '',
      });
    }
    if (contrastSensitivityData) {
      setContrastSensitivity({
        testType: contrastSensitivityData.testType || 'Pelli-Robson',
        OD: {
          score: contrastSensitivityData.OD?.logCS?.toString() || '',
          interpretation: getCSInterpretation(contrastSensitivityData.OD?.logCS || 0),
        },
        OS: {
          score: contrastSensitivityData.OS?.logCS?.toString() || '',
          interpretation: getCSInterpretation(contrastSensitivityData.OS?.logCS || 0),
        },
      });
    }
    queueMicrotask(() => pushVaExtendedRef.current());
  }, [visualAcuityData, refractionData, keratometryData, colorVisionData, contrastSensitivityData]);

  useEffect(() => {
    if (priorVisitPrefillAppliedRef.current || vaExtDraftAppliedRef.current) return;
    const od = priorVisit?.refraction?.startingRxOD ?? priorVisit?.refraction?.finalRxOD;
    const os = priorVisit?.refraction?.startingRxOS ?? priorVisit?.refraction?.finalRxOS;
    if (!od && !os) return;
    priorVisitPrefillAppliedRef.current = true;
    setOldGlass((prev) => ({
      OD: {
        sphere: prev.OD.sphere || od?.sphere || '',
        cylinder: prev.OD.cylinder || od?.cylinder || '',
        axis: prev.OD.axis || od?.axis || '',
        va: prev.OD.va || od?.visualAcuity || '',
      },
      OS: {
        sphere: prev.OS.sphere || os?.sphere || '',
        cylinder: prev.OS.cylinder || os?.cylinder || '',
        axis: prev.OS.axis || os?.axis || '',
        va: prev.OS.va || os?.visualAcuity || '',
      },
    }));
    queueMicrotask(() => pushVaExtendedRef.current());
  }, [priorVisit]);

  return (
    <div className="p-2 sm:p-4">
      <VisualAcuityLayout
        sectionStatus={sectionStatus}
        sectionCounts={sectionCounts}
        vaHistory={vaHistory}
        refHistory={refHistory}
        patientOptometryHistory={patientOptometryHistory}
        onNavigateSection={handleSidebarNavigate}
      >
          <VaSectionCard
            {...sectionCardProps('old')}
            title="Previous glasses (old Rx)"
            icon={<Glasses className="w-5 h-5" />}
          >
            <RxBilateralPrescriptionCard
              variant="old"
              rx={displayOldGlass}
              canEdit={canEditSection('old')}
              onChange={(eye, field, value) => {
                if (shouldSyncSection('old')) {
                  setOldGlass({ ...oldGlass, [eye]: { ...oldGlass[eye], [field]: value } });
                  markSectionDirty('old');
                } else {
                  setSectionShells((prev) => {
                    const base = (prev.old as typeof oldGlass) ?? EMPTY_RX_BILATERAL;
                    return {
                      ...prev,
                      old: { ...base, [eye]: { ...base[eye], [field]: value } },
                    };
                  });
                }
              }}
            />
          </VaSectionCard>

          <VaSectionCard
            {...sectionCardProps('new')}
            title="Today's prescription (new Rx)"
            icon={<TrendingUp className="w-5 h-5" />}
          >
            <RxBilateralPrescriptionCard
              variant="new"
              rx={displayNewPrescription}
              canEdit={canEditSection('new')}
              powerChangeOd={getViewMode('new') === 'editing' ? powerChangeOd : undefined}
              powerChangeOs={getViewMode('new') === 'editing' ? powerChangeOs : undefined}
              onChange={(eye, field, value) => {
                if (shouldSyncSection('new')) {
                  setNewPrescription({
                    ...newPrescription,
                    [eye]: { ...newPrescription[eye], [field]: value },
                  });
                  markSectionDirty('new');
                } else {
                  setSectionShells((prev) => {
                    const base = (prev.new as typeof newPrescription) ?? EMPTY_RX_BILATERAL;
                    return {
                      ...prev,
                      new: { ...base, [eye]: { ...base[eye], [field]: value } },
                    };
                  });
                }
              }}
            />
          </VaSectionCard>

          <VaSectionCard
            {...sectionCardProps('refraction')}
            title="Refraction (subjective / objective)"
            icon={<Eye className="w-5 h-5" />}
          >
            <div className="w-fit max-w-full overflow-x-auto">
              <RefractionBilateralTable
                refraction={displayRefraction}
                canEdit={canEditSection('refraction')}
                onChange={(eye, field, value) => {
                  if (shouldSyncSection('refraction')) {
                    setRefraction({ ...refraction, [eye]: { ...refraction[eye], [field]: value } });
                    markSectionDirty('refraction');
                  } else {
                    setSectionShells((prev) => {
                      const base = (prev.refraction as typeof refraction) ?? EMPTY_REFRACTION;
                      return {
                        ...prev,
                        refraction: { ...base, [eye]: { ...base[eye], [field]: value } },
                      };
                    });
                  }
                }}
              />
            </div>
          </VaSectionCard>

          <VaSectionCard
            {...sectionCardProps('distance')}
            title="Distance & near vision"
            icon={<Eye className="w-5 h-5" />}
          >
            <div className="w-fit max-w-full overflow-x-auto">
              <VaBilateralTable
                distanceVision={displayDistanceVision}
                nearVision={displayNearVision}
                canEdit={canEditSection('distance')}
                onDistanceChange={(eye, field, value) => {
                  if (shouldSyncSection('distance')) {
                    setDistanceVision({
                      ...distanceVision,
                      [eye]: { ...distanceVision[eye], [field]: value },
                    });
                    markSectionDirty('distance');
                  } else {
                    setSectionShells((prev) => {
                      const shell = (prev.distance as {
                        distanceVision?: typeof distanceVision;
                        nearVision?: typeof nearVision;
                        projectionRays?: typeof projectionRays;
                      }) ?? {};
                      const base = shell.distanceVision ?? EMPTY_VA_BILATERAL;
                      return {
                        ...prev,
                        distance: {
                          ...shell,
                          distanceVision: { ...base, [eye]: { ...base[eye], [field]: value } },
                        },
                      };
                    });
                  }
                }}
                onNearChange={(eye, field, value) => {
                  if (shouldSyncSection('distance')) {
                    setNearVision({
                      ...nearVision,
                      [eye]: { ...nearVision[eye], [field]: value },
                    });
                    markSectionDirty('distance');
                  } else {
                    setSectionShells((prev) => {
                      const shell = (prev.distance as {
                        distanceVision?: typeof distanceVision;
                        nearVision?: typeof nearVision;
                      }) ?? {};
                      const base = shell.nearVision ?? EMPTY_VA_BILATERAL;
                      return {
                        ...prev,
                        distance: {
                          ...shell,
                          nearVision: { ...base, [eye]: { ...base[eye], [field]: value } },
                        },
                      };
                    });
                  }
                }}
              />
            </div>
            <VaProjectionRaysSection
              distanceVision={displayDistanceVision}
              projectionRays={displayProjectionRays}
              canEdit={canEditSection('distance')}
              onPrChange={(next) => {
                if (shouldSyncSection('distance')) {
                  setProjectionRays(next);
                  markSectionDirty('distance');
                } else {
                  setSectionShells((prev) => {
                    const shell = (prev.distance as { projectionRays?: typeof projectionRays }) ?? {};
                    return { ...prev, distance: { ...shell, projectionRays: next } };
                  });
                }
              }}
            />
          </VaSectionCard>

          <VaSectionCard
            {...sectionCardProps('keratometry')}
            title="Keratometry"
          >
            <div className="w-fit max-w-full overflow-x-auto">
              <KeratometryBilateralTable
                keratometry={displayKeratometry}
                canEdit={canEditSection('keratometry')}
                calculateAverageK={calculateAverageK}
                calculateAstigmatism={calculateAstigmatism}
                onChange={(eye, field, value) => {
                  if (shouldSyncSection('keratometry')) {
                    setKeratometry({
                      ...keratometry,
                      [eye]: { ...keratometry[eye], [field]: value },
                    });
                    markSectionDirty('keratometry');
                  } else {
                    setSectionShells((prev) => {
                      const base = (prev.keratometry as typeof keratometry) ?? EMPTY_KERATOMETRY;
                      return {
                        ...prev,
                        keratometry: { ...base, [eye]: { ...base[eye], [field]: value } },
                      };
                    });
                  }
                }}
              />
            </div>
          </VaSectionCard>

          <VaSectionCard
            {...sectionCardProps('color')}
            title="Color vision"
            icon={<Palette className="w-5 h-5" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Test Type</label>
                <ExamSelectField
                  value={displayColorVision.testType}
                  options={COLOR_TEST_TYPES}
                  onChange={(value) => {
                    if (shouldSyncSection('color')) {
                      setColorVision({ ...colorVision, testType: value });
                      markSectionDirty('color');
                    } else {
                      setSectionShells((prev) => {
                        const base = (prev.color as typeof colorVision) ?? EMPTY_COLOR_VISION;
                        return { ...prev, color: { ...base, testType: value } };
                      });
                    }
                  }}
                  disabled={!canEditSection('color')}
                  aria-label="Color vision test type"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Result</label>
                <ExamSelectField
                  value={displayColorVision.result}
                  options={COLOR_RESULTS}
                  onChange={(value) => {
                    if (shouldSyncSection('color')) {
                      setColorVision({ ...colorVision, result: value });
                      markSectionDirty('color');
                    } else {
                      setSectionShells((prev) => {
                        const base = (prev.color as typeof colorVision) ?? EMPTY_COLOR_VISION;
                        return { ...prev, color: { ...base, result: value } };
                      });
                    }
                  }}
                  disabled={!canEditSection('color')}
                  aria-label="Color vision result"
                />
              </div>
              <ExamInput
                label="Plates missed (Ishihara)"
                type="text"
                value={displayColorVision.platesMissed}
                onChange={(e) => {
                  if (shouldSyncSection('color')) {
                    setColorVision({ ...colorVision, platesMissed: e.target.value });
                    markSectionDirty('color');
                  } else {
                    setSectionShells((prev) => {
                      const base = (prev.color as typeof colorVision) ?? EMPTY_COLOR_VISION;
                      return { ...prev, color: { ...base, platesMissed: e.target.value } };
                    });
                  }
                }}
                disabled={!canEditSection('color')}
              />
            </div>
          </VaSectionCard>

          <VaSectionCard
            {...sectionCardProps('contrast')}
            title="Contrast sensitivity"
            icon={<Grid className="w-5 h-5" />}
          >
            <div className="space-y-4 max-w-3xl">
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Test Type</label>
                <ExamSelectField
                  value={displayContrastSensitivity.testType}
                  options={CONTRAST_TEST_TYPES}
                  onChange={(value) => {
                    if (shouldSyncSection('contrast')) {
                      setContrastSensitivity({ ...contrastSensitivity, testType: value });
                      markSectionDirty('contrast');
                    } else {
                      setSectionShells((prev) => {
                        const base = (prev.contrast as typeof contrastSensitivity) ?? EMPTY_CONTRAST;
                        return { ...prev, contrast: { ...base, testType: value } };
                      });
                    }
                  }}
                  disabled={!canEditSection('contrast')}
                  aria-label="Contrast sensitivity test type"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-blue-800 border-b border-blue-100 pb-1">
                    Right / OD
                  </h4>
                  <ExamInput
                    label="Score (log units)"
                    type="number"
                    step="0.05"
                    value={displayContrastSensitivity.OD.score}
                    onChange={(e) => {
                      const score = parseFloat(e.target.value) || 0;
                      if (shouldSyncSection('contrast')) {
                        setContrastSensitivity({
                          ...contrastSensitivity,
                          OD: {
                            score: e.target.value,
                            interpretation: getCSInterpretation(score),
                          },
                        });
                        markSectionDirty('contrast');
                      } else {
                        setSectionShells((prev) => {
                          const base = (prev.contrast as typeof contrastSensitivity) ?? EMPTY_CONTRAST;
                          return {
                            ...prev,
                            contrast: {
                              ...base,
                              OD: { score: e.target.value, interpretation: getCSInterpretation(score) },
                            },
                          };
                        });
                      }
                    }}
                    disabled={!canEditSection('contrast')}
                  />
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-emerald-800 border-b border-emerald-100 pb-1">
                    Left / OS
                  </h4>
                  <ExamInput
                    label="Score (log units)"
                    type="number"
                    step="0.05"
                    value={displayContrastSensitivity.OS.score}
                    onChange={(e) => {
                      const score = parseFloat(e.target.value) || 0;
                      if (shouldSyncSection('contrast')) {
                        setContrastSensitivity({
                          ...contrastSensitivity,
                          OS: {
                            score: e.target.value,
                            interpretation: getCSInterpretation(score),
                          },
                        });
                        markSectionDirty('contrast');
                      } else {
                        setSectionShells((prev) => {
                          const base = (prev.contrast as typeof contrastSensitivity) ?? EMPTY_CONTRAST;
                          return {
                            ...prev,
                            contrast: {
                              ...base,
                              OS: { score: e.target.value, interpretation: getCSInterpretation(score) },
                            },
                          };
                        });
                      }
                    }}
                    disabled={!canEditSection('contrast')}
                  />
                </div>
              </div>
            </div>
          </VaSectionCard>
      </VisualAcuityLayout>
    </div>
  );
}
