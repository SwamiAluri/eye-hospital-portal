'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { flushSync } from 'react-dom';
import toast from 'react-hot-toast';
import { Gauge, Droplet, Eye, Activity } from 'lucide-react';
import type {
  TonometryData,
  PachymetryData,
  VisualFieldData,
} from '@/lib/stores/clinical-store';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';
import type { IOPMegaSnapshot } from '@/lib/optometry/exam-mappers';
import { buildIopClinicalSlice, type IopClinicalDraftSlice } from '@/lib/optometry/optometry-persistence';
import { useAuthStore } from '@/lib/auth-store';
import { IopMeasurementGrid } from './exam-ui/IopMeasurementGrid';
import { SchirmerBilateralGrid } from './exam-ui/SchirmerBilateralGrid';
import { PachymetryBilateralTable } from './exam-ui/PachymetryBilateralTable';
import { VisualFieldBilateralTable } from './exam-ui/VisualFieldBilateralTable';
import { IopLayout } from './iop/IopLayout';
import { IopSectionCard } from './iop/IopSectionCard';
import { IopSectionRecordedRail } from './iop/IopSectionRecordedRail';
import {
  IOP_SECTIONS,
  type IopSectionId,
  type IopSectionRecordStatus,
} from '@/lib/optometry/iop-section-constants';
import {
  applySectionSnapshot,
  applyShellToLiveState,
  applyShellToMegaState,
  buildEffectiveIopFormState,
  clearSectionLiveState,
  extractSectionSnapshot,
  hasSectionLiveContent,
  hasSectionShellContent,
  normalizeIopSectionViewMode,
  EMPTY_TONOMETRY_PHASE,
  EMPTY_SCHIRMER,
  EMPTY_PACHYMETRY,
  EMPTY_VISUAL_FIELD,
  type IopMegaFormState,
  type IopSectionSnapshotMap,
  type IopSectionViewMode,
  type IopTonometryPhase,
} from '@/lib/optometry/iop-section-snapshot';
import {
  buildClinicalIopFormState,
  buildIopTrendFromVisits,
  getAtnPriorBeforeDil,
  hasPriorHistoryForIopSectionFromVisits,
} from '@/lib/optometry/iop-section-history';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';
import { iopSectionAnchor } from '@/lib/optometry/iop-section-constants';
import { buildIopBundleFromExtended, buildIopExtendedDraft } from '@/lib/optometry/build-segment-bundles';
import { persistSegmentBundle } from '@/lib/optometry/persist-segment-bundle';
import { OPTOMETRY_SEGMENT_KEYS } from '@/lib/optometry/optometry-segment-keys';

interface IOPMegaTabProps {
  patientId: string;
  visitId?: string;
  tonometryData: TonometryData | null;
  pachymetryData: PachymetryData | null;
  visualFieldData: VisualFieldData | null;
  priorVisit?: PriorVisitSnapshot | null;
  /** Prior visit `iopExtended.sectionSnapshots` when available from draft/history. */
  priorIopExtended?: unknown;
  canEdit: boolean;
  onSyncClinicalDraft: (slice: IopClinicalDraftSlice, iopExtended: unknown) => void;
  onDirtyChange?: (dirty: boolean) => void;
  iopExtended?: unknown;
  onIopExtendedChange?: (data: unknown) => void;
  onSectionSaved?: () => void;
  patientOptometryHistory?: OptometryVisitExamRecord[];
  excludeVisitId?: string;
}

export default function IOPMegaTab({
  patientId,
  visitId,
  tonometryData,
  pachymetryData,
  visualFieldData,
  priorVisit,
  priorIopExtended,
  canEdit,
  onSyncClinicalDraft,
  onDirtyChange,
  iopExtended,
  onIopExtendedChange,
  onSectionSaved,
  patientOptometryHistory,
  excludeVisitId,
}: IOPMegaTabProps) {
  const { user } = useAuthStore();

  const [nct, setNct] = useState<IopTonometryPhase>({ ...EMPTY_TONOMETRY_PHASE });
  const [atn, setAtn] = useState<IopTonometryPhase>({ ...EMPTY_TONOMETRY_PHASE });
  const [schirmer, setSchirmer] = useState({ ...EMPTY_SCHIRMER });
  const [pachymetry, setPachymetry] = useState({ ...EMPTY_PACHYMETRY });
  const [visualField, setVisualField] = useState({ ...EMPTY_VISUAL_FIELD });

  const [hasChanges, setHasChanges] = useState(false);
  const [savingSection, setSavingSection] = useState<IopSectionId | null>(null);

  const [sectionRecorded, setSectionRecorded] = useState<Partial<Record<IopSectionId, boolean>>>({});
  const [sectionDirty, setSectionDirty] = useState<Partial<Record<IopSectionId, boolean>>>({});
  const [sectionViewMode, setSectionViewMode] = useState<Partial<Record<IopSectionId, IopSectionViewMode>>>({});
  const [sectionRecordedAt, setSectionRecordedAt] = useState<Partial<Record<IopSectionId, string>>>({});
  const [sectionSnapshots, setSectionSnapshots] = useState<IopSectionSnapshotMap>({});
  const [sectionShells, setSectionShells] = useState<IopSectionSnapshotMap>({});
  const [expandedSections, setExpandedSections] = useState<Set<IopSectionId>>(
    () => new Set(IOP_SECTIONS.filter((s) => s.defaultExpanded).map((s) => s.id)),
  );

  const iopExtHydratedRef = useRef(false);
  const iopExtDraftAppliedRef = useRef(false);
  const clinicalPrefillAppliedRef = useRef(false);
  const iopExtendedSyncJsonRef = useRef('');
  const pushIopExtendedRef = useRef<() => void>(() => {});

  useEffect(() => {
    iopExtHydratedRef.current = false;
    iopExtDraftAppliedRef.current = false;
    clinicalPrefillAppliedRef.current = false;
    iopExtendedSyncJsonRef.current = '';
  }, [patientId]);

  const resolvedPriorIopExtended = useMemo(() => {
    const fromRaw = (priorVisit?.raw as { iopExtended?: unknown } | undefined)?.iopExtended;
    return fromRaw ?? priorIopExtended;
  }, [priorVisit, priorIopExtended]);

  const atnPriorBeforeDil = useMemo(
    () => getAtnPriorBeforeDil(priorVisit, resolvedPriorIopExtended),
    [priorVisit, resolvedPriorIopExtended],
  );

  const iopTrend = useMemo(
    () => buildIopTrendFromVisits(patientOptometryHistory ?? []),
    [patientOptometryHistory],
  );

  const calculateCorrectedIOP = useCallback((cct: number, measuredIOP: number): string => {
    if (!cct || !measuredIOP) return '';
    const difference = cct - 545;
    const correction = (difference / 10) * 0.7;
    const corrected = measuredIOP - correction;
    return corrected.toFixed(1);
  }, []);

  const getSchirmerInterpretation = (measurement: string): string => {
    const val = parseFloat(measurement);
    if (isNaN(val)) return '';
    if (val > 10) return 'Normal';
    if (val >= 5) return 'Mild Dry Eye';
    return 'Severe Dry Eye';
  };

  const getIOPStatus = (value: string): { text: string; color: string } => {
    const val = parseFloat(value);
    if (isNaN(val)) return { text: '', color: '' };
    if (val > 21) return { text: 'High (Glaucoma Suspect)', color: 'text-red-700 bg-red-50' };
    if (val < 10) return { text: 'Low (Hypotony)', color: 'text-yellow-700 bg-yellow-50' };
    return { text: 'Normal', color: 'text-green-700 bg-green-50' };
  };

  const sectionSetters = useMemo(
    () => ({
      setNct,
      setAtn,
      setSchirmer,
      setPachymetry,
      setVisualField,
    }),
    [],
  );

  const getMegaFormState = useCallback(
    (): IopMegaFormState => ({
      nct,
      atn,
      schirmer,
      pachymetry,
      visualField,
    }),
    [nct, atn, schirmer, pachymetry, visualField],
  );

  const getViewMode = useCallback(
    (id: IopSectionId): IopSectionViewMode => {
      if (!sectionRecorded[id]) return 'editing';
      return normalizeIopSectionViewMode(sectionViewMode[id]);
    },
    [sectionRecorded, sectionViewMode],
  );

  const shouldSyncSection = useCallback(
    (id: IopSectionId) => !sectionRecorded[id] || getViewMode(id) === 'editing',
    [sectionRecorded, getViewMode],
  );

  const clearSectionShell = useCallback((sectionId: IopSectionId) => {
    setSectionShells((prev) => {
      if (prev[sectionId] == null) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  }, []);

  const getEffectiveFormState = useCallback(() => {
    return buildEffectiveIopFormState(
      getMegaFormState(),
      sectionRecorded,
      sectionViewMode,
      sectionSnapshots,
    );
  }, [getMegaFormState, sectionRecorded, sectionViewMode, sectionSnapshots]);

  const getClinicalSnapshot = useCallback(
    (formState: IopMegaFormState): IOPMegaSnapshot => ({
      nct: formState.nct,
      pachymetry: { OD: { cct: formState.pachymetry.OD.cct }, OS: { cct: formState.pachymetry.OS.cct } },
      visualField: formState.visualField,
    }),
    [],
  );

  const syncDraftFromForm = useCallback(
    (formState: IopMegaFormState) => {
      const examinerId = user?.id || '';
      const snap = getClinicalSnapshot(formState);
      const slice = buildIopClinicalSlice(patientId, examinerId, snap, {
        tonometry: tonometryData,
        pachymetry: pachymetryData,
        visualField: visualFieldData,
      });
      return { slice, extended: formState };
    },
    [user?.id, patientId, getClinicalSnapshot, tonometryData, pachymetryData, visualFieldData],
  );

  const pushIopExtended = useCallback(() => {
    if (!onIopExtendedChange) return;
    const payload = buildIopExtendedDraft({
      nct,
      atn,
      schirmer,
      pachymetry,
      visualField,
      sectionRecorded,
      sectionDirty,
      sectionViewMode,
      sectionRecordedAt,
      sectionSnapshots,
    });
    const json = JSON.stringify(payload);
    if (json === iopExtendedSyncJsonRef.current) return;
    iopExtendedSyncJsonRef.current = json;
    onIopExtendedChange(payload);
  }, [
    onIopExtendedChange,
    nct,
    atn,
    schirmer,
    pachymetry,
    visualField,
    sectionRecorded,
    sectionDirty,
    sectionViewMode,
    sectionRecordedAt,
    sectionSnapshots,
  ]);

  pushIopExtendedRef.current = pushIopExtended;

  const schedulePushIopExtended = useCallback(() => {
    queueMicrotask(() => pushIopExtendedRef.current());
  }, []);

  const markSectionDirty = useCallback(
    (id: IopSectionId) => {
      if (!shouldSyncSection(id)) return;
      setSectionDirty((prev) => ({ ...prev, [id]: true }));
      setHasChanges(true);
      onDirtyChange?.(true);
      schedulePushIopExtended();
    },
    [shouldSyncSection, onDirtyChange, schedulePushIopExtended],
  );

  useEffect(() => {
    if (!iopExtended || iopExtHydratedRef.current) return;
    const ext = iopExtended as {
      nct?: IopTonometryPhase;
      atn?: IopTonometryPhase;
      schirmer?: typeof schirmer;
      pachymetry?: typeof pachymetry;
      visualField?: typeof visualField;
      sectionRecorded?: Partial<Record<IopSectionId, boolean>>;
      sectionDirty?: Partial<Record<IopSectionId, boolean>>;
      sectionViewMode?: Partial<Record<IopSectionId, IopSectionViewMode>>;
      sectionRecordedAt?: Partial<Record<IopSectionId, string>>;
      sectionSnapshots?: IopSectionSnapshotMap;
    };

    const clinicalPartial = buildClinicalIopFormState({
      tonometryData,
      pachymetryData,
      visualFieldData,
      calculateCorrectedIOP,
    });

    if (ext.nct) setNct(ext.nct);
    else if (clinicalPartial.nct) setNct(clinicalPartial.nct);

    if (ext.atn) setAtn(ext.atn);
    if (ext.schirmer) setSchirmer(ext.schirmer);

    if (ext.pachymetry) setPachymetry(ext.pachymetry);
    else if (clinicalPartial.pachymetry) setPachymetry(clinicalPartial.pachymetry);

    if (ext.visualField) setVisualField(ext.visualField);
    else if (clinicalPartial.visualField) setVisualField(clinicalPartial.visualField);

    if (ext.sectionRecorded) setSectionRecorded(ext.sectionRecorded);
    if (ext.sectionDirty) setSectionDirty(ext.sectionDirty);
    if (ext.sectionViewMode) {
      const normalized: Partial<Record<IopSectionId, IopSectionViewMode>> = {};
      (Object.keys(ext.sectionViewMode) as IopSectionId[]).forEach((k) => {
        normalized[k] = normalizeIopSectionViewMode(ext.sectionViewMode![k]);
      });
      setSectionViewMode(normalized);
    }
    if (ext.sectionRecordedAt) setSectionRecordedAt(ext.sectionRecordedAt);

    const hydratedState: IopMegaFormState = {
      nct: ext.nct ?? clinicalPartial.nct ?? { ...EMPTY_TONOMETRY_PHASE },
      atn: ext.atn ?? { ...EMPTY_TONOMETRY_PHASE },
      schirmer: ext.schirmer ?? { ...EMPTY_SCHIRMER },
      pachymetry: ext.pachymetry ?? clinicalPartial.pachymetry ?? { ...EMPTY_PACHYMETRY },
      visualField: ext.visualField ?? clinicalPartial.visualField ?? { ...EMPTY_VISUAL_FIELD },
    };

    const backfilledSnapshots: IopSectionSnapshotMap = { ...(ext.sectionSnapshots ?? {}) };
    if (ext.sectionRecorded) {
      IOP_SECTIONS.forEach((s) => {
        if (ext.sectionRecorded?.[s.id] && backfilledSnapshots[s.id] == null) {
          backfilledSnapshots[s.id] = extractSectionSnapshot(s.id, hydratedState);
        }
      });
    }
    setSectionSnapshots(backfilledSnapshots);

    if (ext.sectionRecorded) {
      IOP_SECTIONS.forEach((s) => {
        if (ext.sectionRecorded?.[s.id]) {
          const mode = normalizeIopSectionViewMode(ext.sectionViewMode?.[s.id]);
          if (mode !== 'editing') {
            clearSectionLiveState(s.id, sectionSetters);
          }
        }
      });
    }

    iopExtDraftAppliedRef.current = true;
    iopExtHydratedRef.current = true;
    clinicalPrefillAppliedRef.current = true;
    queueMicrotask(() => pushIopExtendedRef.current());
  }, [iopExtended, tonometryData, pachymetryData, visualFieldData, calculateCorrectedIOP, sectionSetters]);

  useEffect(() => {
    if (clinicalPrefillAppliedRef.current || iopExtDraftAppliedRef.current) return;
    if (!tonometryData && !pachymetryData && !visualFieldData) return;
    clinicalPrefillAppliedRef.current = true;

    const clinicalPartial = buildClinicalIopFormState({
      tonometryData,
      pachymetryData,
      visualFieldData,
      calculateCorrectedIOP,
    });
    if (clinicalPartial.nct) setNct(clinicalPartial.nct);
    if (clinicalPartial.pachymetry) setPachymetry(clinicalPartial.pachymetry);
    if (clinicalPartial.visualField) setVisualField(clinicalPartial.visualField);
  }, [tonometryData, pachymetryData, visualFieldData, calculateCorrectedIOP]);

  const hasSectionFormContent = useCallback(
    (id: IopSectionId): boolean => {
      const mode = getViewMode(id);
      if (!sectionRecorded[id] || mode === 'editing') {
        return hasSectionLiveContent(id, getMegaFormState());
      }
      return hasSectionShellContent(id, sectionShells[id]);
    },
    [getViewMode, sectionRecorded, getMegaFormState, sectionShells],
  );

  const sectionShowRail = useCallback(
    (id: IopSectionId): boolean => {
      const meta = IOP_SECTIONS.find((s) => s.id === id);
      if (!meta?.showHistoryPanel) return sectionRecorded[id] === true;
      if (sectionRecorded[id]) return true;
      return hasPriorHistoryForIopSectionFromVisits(id, patientOptometryHistory ?? [], excludeVisitId);
    },
    [sectionRecorded, patientOptometryHistory, excludeVisitId],
  );

  const persistIopSection = useCallback(
    async (sectionId: IopSectionId, isUpdate: boolean) => {
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
        const label = IOP_SECTIONS.find((s) => s.id === sectionId)?.label ?? 'Section';
        const snap = extractSectionSnapshot(sectionId, mergedForm);
        const now = new Date().toISOString();
        const nextRecorded = { ...sectionRecorded, [sectionId]: true };
        const nextSnapshots = { ...sectionSnapshots, [sectionId]: snap };
        const nextViewMode = { ...sectionViewMode, [sectionId]: 'view' as IopSectionViewMode };
        const nextDirty = { ...sectionDirty, [sectionId]: false };
        const nextRecordedAt = { ...sectionRecordedAt, [sectionId]: now };

        const effectiveClinical = buildEffectiveIopFormState(
          mergedForm,
          nextRecorded,
          nextViewMode,
          nextSnapshots,
        );
        const { slice } = syncDraftFromForm(effectiveClinical);
        const extPayload = buildIopExtendedDraft({
          nct: effectiveClinical.nct,
          atn: effectiveClinical.atn,
          schirmer: effectiveClinical.schirmer,
          pachymetry: effectiveClinical.pachymetry,
          visualField: effectiveClinical.visualField,
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
            OPTOMETRY_SEGMENT_KEYS.iopBundle,
            buildIopBundleFromExtended(extPayload),
          );
        }

        onSyncClinicalDraft(slice, extPayload);

        setSectionSnapshots(nextSnapshots);
        clearSectionLiveState(sectionId, sectionSetters);
        clearSectionShell(sectionId);
        setSectionRecorded(nextRecorded);
        setSectionRecordedAt(nextRecordedAt);
        setSectionViewMode(nextViewMode);
        setSectionDirty((prev) => {
          const next = { ...prev, [sectionId]: false };
          const anyDirty = IOP_SECTIONS.some((s) => next[s.id]);
          if (!anyDirty) {
            setHasChanges(false);
            onDirtyChange?.(false);
          }
          return next;
        });

        iopExtendedSyncJsonRef.current = JSON.stringify(extPayload);
        onIopExtendedChange?.(extPayload);
        onSectionSaved?.();
        toast.success(isUpdate ? `${label} updated` : `${label} saved`);
      } catch (e) {
        console.error(e);
        toast.error(
          `Failed to save ${IOP_SECTIONS.find((s) => s.id === sectionId)?.label ?? 'section'}`,
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
      getMegaFormState,
      syncDraftFromForm,
      sectionRecorded,
      sectionViewMode,
      sectionSnapshots,
      sectionDirty,
      sectionRecordedAt,
      onSyncClinicalDraft,
      clearSectionShell,
      onSectionSaved,
      onDirtyChange,
      onIopExtendedChange,
    ],
  );

  const recordIopSection = useCallback(
    (sectionId: IopSectionId) => {
      if (getViewMode(sectionId) === 'editing' && sectionRecorded[sectionId]) return;
      if (!hasSectionFormContent(sectionId)) return;
      persistIopSection(sectionId, false);
    },
    [getViewMode, sectionRecorded, hasSectionFormContent, persistIopSection],
  );

  const updateIopSection = useCallback(
    (sectionId: IopSectionId) => {
      if (getViewMode(sectionId) !== 'editing' || !sectionRecorded[sectionId]) return;
      if (!hasSectionFormContent(sectionId)) return;
      persistIopSection(sectionId, true);
    },
    [getViewMode, sectionRecorded, hasSectionFormContent, persistIopSection],
  );

  const enterSectionEdit = useCallback(
    (sectionId: IopSectionId) => {
      clearSectionShell(sectionId);
      const snap = sectionSnapshots[sectionId];
      if (snap != null) {
        applySectionSnapshot(sectionId, snap, sectionSetters);
      }
      setSectionViewMode((prev) => ({ ...prev, [sectionId]: 'editing' }));
      setExpandedSections((prev) => new Set(prev).add(sectionId));
      schedulePushIopExtended();
      requestAnimationFrame(() => {
        document.getElementById(iopSectionAnchor(sectionId))?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    },
    [sectionSnapshots, sectionSetters, clearSectionShell, schedulePushIopExtended],
  );

  const exitSectionEdit = useCallback(
    (sectionId: IopSectionId) => {
      clearSectionLiveState(sectionId, sectionSetters);
      clearSectionShell(sectionId);
      setSectionViewMode((prev) => ({ ...prev, [sectionId]: 'view' }));
      setSectionDirty((prev) => {
        const next = { ...prev, [sectionId]: false };
        const anyDirty = IOP_SECTIONS.some((s) => next[s.id]);
        if (!anyDirty) {
          setHasChanges(false);
          onDirtyChange?.(false);
        }
        return next;
      });
      schedulePushIopExtended();
    },
    [sectionSetters, clearSectionShell, onDirtyChange, schedulePushIopExtended],
  );

  const displayTonometry = useCallback(
    (id: 'nct' | 'atn') => {
      const live = id === 'nct' ? nct : atn;
      if (!sectionRecorded[id] || getViewMode(id) === 'editing') return live;
      return (sectionShells[id] as IopTonometryPhase) ?? EMPTY_TONOMETRY_PHASE;
    },
    [nct, atn, sectionRecorded, getViewMode, sectionShells],
  );

  const displaySchirmer = useMemo(() => {
    if (!sectionRecorded.schirmer || getViewMode('schirmer') === 'editing') return schirmer;
    return (sectionShells.schirmer as typeof schirmer) ?? EMPTY_SCHIRMER;
  }, [schirmer, sectionRecorded.schirmer, getViewMode, sectionShells]);

  const displayPachymetry = useMemo(() => {
    if (!sectionRecorded.pachymetry || getViewMode('pachymetry') === 'editing') return pachymetry;
    return (sectionShells.pachymetry as typeof pachymetry) ?? EMPTY_PACHYMETRY;
  }, [pachymetry, sectionRecorded.pachymetry, getViewMode, sectionShells]);

  const displayVisualField = useMemo(() => {
    if (!sectionRecorded['visual-field'] || getViewMode('visual-field') === 'editing') return visualField;
    return (sectionShells['visual-field'] as typeof visualField) ?? EMPTY_VISUAL_FIELD;
  }, [visualField, sectionRecorded, getViewMode, sectionShells]);

  const getSectionStatus = (id: IopSectionId): IopSectionRecordStatus => {
    if (sectionRecorded[id] && !sectionDirty[id]) return 'recorded';
    if (sectionDirty[id]) return 'draft';
    return 'empty';
  };

  const sectionStatus = useMemo((): Partial<Record<IopSectionId, IopSectionRecordStatus>> => {
    const out: Partial<Record<IopSectionId, IopSectionRecordStatus>> = {};
    IOP_SECTIONS.forEach((s) => {
      out[s.id] = getSectionStatus(s.id);
    });
    return out;
  }, [sectionRecorded, sectionDirty]);

  const handleSidebarNavigate = useCallback((id: IopSectionId) => {
    setExpandedSections((prev) => new Set(prev).add(id));
  }, []);

  const handleManualExpand = useCallback((id: IopSectionId, open: boolean) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const canEditSection = useCallback((id: IopSectionId) => canEdit, [canEdit]);

  const recordedRail = (id: IopSectionId) => (
    <IopSectionRecordedRail
      sectionId={id}
      snapshot={sectionSnapshots[id]}
      recordedAt={sectionRecordedAt[id]}
      isEditing={getViewMode(id) === 'editing'}
      canEdit={canEdit}
      onEdit={() => enterSectionEdit(id)}
      iopTrend={iopTrend}
      priorIopExtended={resolvedPriorIopExtended}
      priorExaminationDate={priorVisit?.examinationDate}
      patientOptometryHistory={patientOptometryHistory}
      excludeVisitId={excludeVisitId}
      targetIOPOD={tonometryData?.targetIOPOD}
      targetIOPOS={tonometryData?.targetIOPOS}
    />
  );

  const sectionCardProps = (id: IopSectionId) => ({
    sectionId: id,
    recordStatus: getSectionStatus(id),
    canEdit: canEditSection(id),
    saving: savingSection === id,
    showRail: sectionShowRail(id),
    hasFormContent: hasSectionFormContent(id),
    onRecord: () => recordIopSection(id),
    onUpdate: () => updateIopSection(id),
    expanded: expandedSections.has(id),
    onExpandedChange: (open: boolean) => handleManualExpand(id, open),
    viewMode: getViewMode(id),
    onDoneEditing: () => exitSectionEdit(id),
    recordedRail: recordedRail(id),
  });

  const updateTonometry = (
    which: 'nct' | 'atn',
    phase: 'beforeDilatation' | 'afterDilatation',
    eye: 'OD' | 'OS',
    field: 'value' | 'time',
    value: string,
  ) => {
    const setter = which === 'nct' ? setNct : setAtn;
    const current = which === 'nct' ? nct : atn;
    if (shouldSyncSection(which)) {
      setter({
        ...current,
        [phase]: {
          ...current[phase],
          [eye]: { ...current[phase][eye], [field]: value },
        },
      });
      markSectionDirty(which);
    } else {
      setSectionShells((prev) => {
        const base = (prev[which] as IopTonometryPhase) ?? current;
        return {
          ...prev,
          [which]: {
            ...base,
            [phase]: {
              ...base[phase],
              [eye]: { ...base[phase][eye], [field]: value },
            },
          },
        };
      });
    }
  };

  const renderTonometryGrids = (which: 'nct' | 'atn', data: IopTonometryPhase, editable: boolean) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
      <IopMeasurementGrid
        title="Before Dilatation"
        od={data.beforeDilatation.OD}
        os={data.beforeDilatation.OS}
        priorOd={
          which === 'nct'
            ? priorVisit?.iop?.od
            : atnPriorBeforeDil.od
        }
        priorOs={
          which === 'nct'
            ? priorVisit?.iop?.os
            : atnPriorBeforeDil.os
        }
        canEdit={editable}
        getIOPStatus={getIOPStatus}
        onChange={(eye, field, value) => updateTonometry(which, 'beforeDilatation', eye, field, value)}
      />
      <IopMeasurementGrid
        title="After Dilatation"
        od={data.afterDilatation.OD}
        os={data.afterDilatation.OS}
        canEdit={editable}
        getIOPStatus={getIOPStatus}
        onChange={(eye, field, value) => updateTonometry(which, 'afterDilatation', eye, field, value)}
      />
    </div>
  );

  return (
    <div className="p-2 sm:p-4">
      <IopLayout
        sectionStatus={sectionStatus}
        patientOptometryHistory={patientOptometryHistory}
        tonometryData={tonometryData}
        onNavigateSection={handleSidebarNavigate}
      >
        <IopSectionCard
          {...sectionCardProps('nct')}
          title="Non-Contact Tonometry (NCT)"
          icon={<Gauge className="w-5 h-5" />}
        >
          {renderTonometryGrids('nct', displayTonometry('nct'), canEditSection('nct'))}
        </IopSectionCard>

        <IopSectionCard
          {...sectionCardProps('atn')}
          title="Applanation Tonometry (ATN)"
          icon={<Gauge className="w-5 h-5" />}
        >
          {renderTonometryGrids('atn', displayTonometry('atn'), canEditSection('atn'))}
        </IopSectionCard>

        <IopSectionCard
          {...sectionCardProps('schirmer')}
          title="Schirmer Tear Test (Dry Eye Assessment)"
          icon={<Droplet className="w-5 h-5" />}
        >
          <SchirmerBilateralGrid
            od={displaySchirmer.OD}
            os={displaySchirmer.OS}
            canEdit={canEditSection('schirmer')}
            onChange={(eye, field, value) => {
              if (shouldSyncSection('schirmer')) {
                setSchirmer({
                  ...schirmer,
                  [eye]: {
                    ...schirmer[eye],
                    [field]: value,
                    ...(field === 'measurement'
                      ? { interpretation: getSchirmerInterpretation(value) }
                      : {}),
                  },
                });
                markSectionDirty('schirmer');
              } else {
                setSectionShells((prev) => {
                  const base = (prev.schirmer as typeof schirmer) ?? schirmer;
                  return {
                    ...prev,
                    schirmer: {
                      ...base,
                      [eye]: {
                        ...base[eye],
                        [field]: value,
                        ...(field === 'measurement'
                          ? { interpretation: getSchirmerInterpretation(value) }
                          : {}),
                      },
                    },
                  };
                });
              }
            }}
          />
        </IopSectionCard>

        <IopSectionCard
          {...sectionCardProps('pachymetry')}
          title="Pachymetry (CCT for IOP Correction)"
          icon={<Eye className="w-5 h-5" />}
        >
          <PachymetryBilateralTable
            od={displayPachymetry.OD}
            os={displayPachymetry.OS}
            canEdit={canEditSection('pachymetry')}
            correctionSourceNote="Corrected IOP uses NCT before dilatation values when available."
            onCctChange={(eye, cct) => {
              const effectiveNct = getEffectiveFormState().nct;
              const iopVal = parseFloat(effectiveNct.beforeDilatation[eye].value || '0');
              const corrected = calculateCorrectedIOP(parseFloat(cct), iopVal);
              if (shouldSyncSection('pachymetry')) {
                setPachymetry({
                  ...pachymetry,
                  [eye]: { cct, correctedIOP: corrected },
                });
                markSectionDirty('pachymetry');
              } else {
                setSectionShells((prev) => {
                  const base = (prev.pachymetry as typeof pachymetry) ?? pachymetry;
                  return {
                    ...prev,
                    pachymetry: {
                      ...base,
                      [eye]: { cct, correctedIOP: corrected },
                    },
                  };
                });
              }
            }}
          />
        </IopSectionCard>

        <IopSectionCard
          {...sectionCardProps('visual-field')}
          title="Visual Field Test (Glaucoma Screening)"
          icon={<Activity className="w-5 h-5" />}
        >
          <VisualFieldBilateralTable
            od={displayVisualField.OD}
            os={displayVisualField.OS}
            canEdit={canEditSection('visual-field')}
            onChange={(eye, patch) => {
              if (shouldSyncSection('visual-field')) {
                setVisualField({
                  ...visualField,
                  [eye]: { ...visualField[eye], ...patch },
                });
                markSectionDirty('visual-field');
              } else {
                setSectionShells((prev) => {
                  const base = (prev['visual-field'] as typeof visualField) ?? visualField;
                  return {
                    ...prev,
                    'visual-field': {
                      ...base,
                      [eye]: { ...base[eye], ...patch },
                    },
                  };
                });
              }
            }}
          />
        </IopSectionCard>
      </IopLayout>
    </div>
  );
}
