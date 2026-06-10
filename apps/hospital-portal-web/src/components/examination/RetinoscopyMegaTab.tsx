'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { ExamInput, ExamSelect } from './ExamCard';
import { Lightbulb } from 'lucide-react';
import type {
  DryRetinoscopyData,
  RetinoscopyReading,
  SubjectiveRefractionData,
  SubjectiveRefractionReading,
  WetRetinoscopyData,
} from '@/lib/optometry/retinoscopy-types';
import {
  RETINOSCOPY_SECTIONS,
  type RetinoscopySectionId,
  type RetinoscopySectionRecordStatus,
} from '@/lib/optometry/retinoscopy-section-constants';
import {
  canAddNewRecordToday,
  hasTodaySectionContent,
  isEditTargetForSection,
  type RetinoscopyEditTarget,
} from '@/lib/optometry/retinoscopy-section-access';
import {
  hasDrySectionContent,
  hasPriorHistoryForRetinoscopySection,
  hasSubjectiveSectionContent,
  hasWetSectionContent,
} from '@/lib/optometry/retinoscopy-section-history';
import {
  buildSectionSavePayload,
  subjectiveReadingToNewForm,
  type SubjectiveNewReadingForm,
} from '@/lib/optometry/retinoscopy-merge-pending';
import {
  createEmptyRetinoscopyNewReadingForm,
  readingToNewReadingForm,
  type RetinoscopyNewReadingForm,
} from '@/lib/optometry/retinoscopy-reading-form';
import {
  retinoscopyAxisOptions,
  retinoscopyCylinderOptions,
  retinoscopySphereOptions,
} from '@/lib/optometry/retinoscopy-form-options';
import { RetinoscopyNewReadingColumn } from './retinoscopy/RetinoscopyNewReadingColumn';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';
import { RetinoscopyLayout } from './retinoscopy/RetinoscopyLayout';
import { RetinoscopySectionCard } from './retinoscopy/RetinoscopySectionCard';
import { RetinoscopySectionRecordedRail } from './retinoscopy/RetinoscopySectionRecordedRail';

interface RetinoscopyMegaTabProps {
  wetRetinoscopyData: WetRetinoscopyData | null;
  dryRetinoscopyData: DryRetinoscopyData | null;
  subjectiveRefractionData: SubjectiveRefractionData | null;
  priorVisit?: PriorVisitSnapshot | null;
  patientOptometryHistory?: OptometryVisitExamRecord[];
  excludeVisitId?: string;
  visitDateIso?: string | null;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  /** Fired after each successful section record — parent marks tab saved only when all three are recorded. */
  onTabRecordStateChange?: (
    sectionRecorded: Partial<Record<RetinoscopySectionId, boolean>>,
  ) => void;
  onSaveWetRetinoscopy: (data: WetRetinoscopyData) => Promise<boolean> | boolean;
  onSaveDryRetinoscopy: (data: DryRetinoscopyData) => Promise<boolean> | boolean;
  onSaveSubjectiveRefraction: (data: SubjectiveRefractionData) => Promise<boolean> | boolean;
}

export default function RetinoscopyMegaTab({
  wetRetinoscopyData,
  dryRetinoscopyData,
  subjectiveRefractionData,
  priorVisit,
  patientOptometryHistory,
  excludeVisitId,
  visitDateIso: _visitDateIso,
  canEdit,
  onDirtyChange,
  onTabRecordStateChange,
  onSaveWetRetinoscopy,
  onSaveDryRetinoscopy,
  onSaveSubjectiveRefraction,
}: RetinoscopyMegaTabProps) {
  // ========== WET RETINOSCOPY STATE ==========
  const [wetData, setWetData] = useState<WetRetinoscopyData>({
    drug: undefined,
    duration: undefined,
    timeAdministered: undefined,
    odReadings: [],
    osReadings: [],
  });
  // ========== DRY RETINOSCOPY STATE ==========
  const [dryData, setDryData] = useState<DryRetinoscopyData>({
    odReadings: [],
    osReadings: [],
  });

  // ========== SUBJECTIVE REFRACTION STATE ==========
  const [subjectiveData, setSubjectiveData] = useState<SubjectiveRefractionData>({
    readings: [],
  });

  const [savingSection, setSavingSection] = useState<RetinoscopySectionId | null>(null);
  const [sectionRecorded, setSectionRecorded] = useState<
    Partial<Record<RetinoscopySectionId, boolean>>
  >({});
  const [sectionDirty, setSectionDirty] = useState<Partial<Record<RetinoscopySectionId, boolean>>>(
    {},
  );
  const [editTarget, setEditTarget] = useState<RetinoscopyEditTarget | null>(null);
  const [sectionRecordedAt, setSectionRecordedAt] = useState<
    Partial<Record<RetinoscopySectionId, string>>
  >({});
  const [sectionSnapshots, setSectionSnapshots] = useState<
    Partial<Record<RetinoscopySectionId, unknown>>
  >({});
  const [expandedSections, setExpandedSections] = useState<Set<RetinoscopySectionId>>(
    () => new Set(RETINOSCOPY_SECTIONS.filter((s) => s.defaultExpanded).map((s) => s.id)),
  );

  const generateId = () => crypto.randomUUID?.() ?? Math.random().toString(36).substring(2, 11);

  const createEmptySubjectiveNewReading = (entryNumber: number): SubjectiveNewReadingForm => ({
    id: generateId(),
    entryNumber,
    odSphere: '',
    odCylinder: '',
    odAxis: '',
    osSphere: '',
    osCylinder: '',
    osAxis: '',
    vaAchievedOD: '',
    vaAchievedOS: '',
    isFinal: false,
  });

  // ========== NEW READING FORMS STATE (Always visible) ==========
  const [newWetOD, setNewWetOD] = useState<RetinoscopyNewReadingForm>(createEmptyRetinoscopyNewReadingForm);
  const [newWetOS, setNewWetOS] = useState<RetinoscopyNewReadingForm>(createEmptyRetinoscopyNewReadingForm);
  const [newDryOD, setNewDryOD] = useState<RetinoscopyNewReadingForm>(createEmptyRetinoscopyNewReadingForm);
  const [newDryOS, setNewDryOS] = useState<RetinoscopyNewReadingForm>(createEmptyRetinoscopyNewReadingForm);
  const [newSubjReading, setNewSubjReading] = useState<SubjectiveNewReadingForm>(
    createEmptySubjectiveNewReading(1),
  );

  const markSectionDirty = useCallback(
    (id: RetinoscopySectionId) => {
      setSectionDirty((prev) => ({ ...prev, [id]: true }));
      onDirtyChange?.(true);
    },
    [onDirtyChange],
  );

  const syncRecordedFromProps = useCallback(() => {
    const nextRecorded: Partial<Record<RetinoscopySectionId, boolean>> = {};
    const nextSnapshots: Partial<Record<RetinoscopySectionId, unknown>> = {};
    if (hasWetSectionContent(wetRetinoscopyData)) {
      nextRecorded.wet = true;
      nextSnapshots.wet = wetRetinoscopyData;
    }
    if (hasDrySectionContent(dryRetinoscopyData)) {
      nextRecorded.dry = true;
      nextSnapshots.dry = dryRetinoscopyData;
    }
    if (hasSubjectiveSectionContent(subjectiveRefractionData)) {
      nextRecorded.subjective = true;
      nextSnapshots.subjective = subjectiveRefractionData;
    }
    setSectionRecorded(nextRecorded);
    setSectionSnapshots(nextSnapshots);
  }, [wetRetinoscopyData, dryRetinoscopyData, subjectiveRefractionData]);

  // Load initial data
  useEffect(() => {
    if (wetRetinoscopyData) {
      setWetData(wetRetinoscopyData);
    }
    if (dryRetinoscopyData) {
      setDryData(dryRetinoscopyData);
    }
    if (subjectiveRefractionData) {
      setSubjectiveData(subjectiveRefractionData);
    }
    syncRecordedFromProps();
  }, [wetRetinoscopyData, dryRetinoscopyData, subjectiveRefractionData, syncRecordedFromProps]);

  useEffect(() => {
    if (sectionRecorded.wet || sectionRecorded.dry || sectionRecorded.subjective) {
      onTabRecordStateChange?.(sectionRecorded);
    }
  }, [sectionRecorded, onTabRecordStateChange]);

  // ========== WET RETINOSCOPY HANDLERS ==========
  const handleWetDrugChange = (drug: string) => {
    setWetData({ ...wetData, drug });
    markSectionDirty('wet');
  };

  const handleWetDurationChange = (duration: number | undefined) => {
    setWetData({ ...wetData, duration });
    markSectionDirty('wet');
  };

  const handleWetTimeChange = (time: string) => {
    setWetData({ ...wetData, timeAdministered: time });
    markSectionDirty('wet');
  };

  const canAddNew = useCallback(
    (id: RetinoscopySectionId) =>
      canEdit && canAddNewRecordToday(id, wetData, dryData, subjectiveData),
    [canEdit, wetData, dryData, subjectiveData],
  );

  const isDrugFormEditable = useCallback(
    () =>
      canEdit &&
      (canAddNew('wet') || (editTarget?.sectionId === 'wet' && editTarget.kind === 'drug')),
    [canEdit, canAddNew, editTarget],
  );

  const isWetEyeFormEditable = useCallback(
    (eye: 'od' | 'os') =>
      canEdit &&
      (canAddNew('wet') ||
        (editTarget?.sectionId === 'wet' &&
          editTarget.kind === 'reading' &&
          editTarget.eye === eye)),
    [canEdit, canAddNew, editTarget],
  );

  const isDryEyeFormEditable = useCallback(
    (eye: 'od' | 'os') =>
      canEdit &&
      (canAddNew('dry') ||
        (editTarget?.sectionId === 'dry' &&
          editTarget.kind === 'reading' &&
          editTarget.eye === eye)),
    [canEdit, canAddNew, editTarget],
  );

  const isSubjectiveFormEditable = useCallback(
    () =>
      canEdit &&
      (canAddNew('subjective') ||
        (editTarget?.sectionId === 'subjective' && editTarget.kind === 'subjective')),
    [canEdit, canAddNew, editTarget],
  );

  const applyPreparedSectionState = useCallback(
    (
      sectionId: RetinoscopySectionId,
      payload: {
        wet?: WetRetinoscopyData;
        dry?: DryRetinoscopyData;
        subjective?: SubjectiveRefractionData;
      },
    ) => {
      if (sectionId === 'wet' && payload.wet) {
        setWetData(payload.wet);
        setNewWetOD(createEmptyRetinoscopyNewReadingForm());
        setNewWetOS(createEmptyRetinoscopyNewReadingForm());
      }
      if (sectionId === 'dry' && payload.dry) {
        setDryData(payload.dry);
        setNewDryOD(createEmptyRetinoscopyNewReadingForm());
        setNewDryOS(createEmptyRetinoscopyNewReadingForm());
      }
      if (sectionId === 'subjective' && payload.subjective) {
        setSubjectiveData(payload.subjective);
        setNewSubjReading(
          createEmptySubjectiveNewReading(payload.subjective.readings.length + 1),
        );
      }
    },
    [],
  );

  const prepareSectionPayload = useCallback(
    (sectionId: RetinoscopySectionId) => {
      const target = isEditTargetForSection(editTarget, sectionId) ? editTarget : null;
      const result = buildSectionSavePayload(
        sectionId,
        target,
        wetData,
        dryData,
        subjectiveData,
        newWetOD,
        newWetOS,
        newDryOD,
        newDryOS,
        newSubjReading,
      );
      if (!result.ok) {
        toast.error(result.errors.join(' '));
        return { ok: false as const };
      }
      return result;
    },
    [
      editTarget,
      wetData,
      dryData,
      subjectiveData,
      newWetOD,
      newWetOS,
      newDryOD,
      newDryOS,
      newSubjReading,
    ],
  );

  const getSectionStatus = useCallback(
    (id: RetinoscopySectionId): RetinoscopySectionRecordStatus => {
      if (sectionRecorded[id] && !sectionDirty[id]) return 'recorded';
      if (
        sectionDirty[id] ||
        hasTodaySectionContent(id, wetData, dryData, subjectiveData)
      ) {
        return 'draft';
      }
      return 'empty';
    },
    [sectionRecorded, sectionDirty, wetData, dryData, subjectiveData],
  );

  const sectionStatus = useMemo(() => {
    const out: Partial<Record<RetinoscopySectionId, RetinoscopySectionRecordStatus>> = {};
    RETINOSCOPY_SECTIONS.forEach((s) => {
      out[s.id] = getSectionStatus(s.id);
    });
    return out;
  }, [getSectionStatus]);

  const hasLiveSectionContent = useCallback(
    (id: RetinoscopySectionId): boolean => {
      if (id === 'wet') {
        return (
          Boolean(wetData.drug) ||
          wetData.odReadings.length > 0 ||
          wetData.osReadings.length > 0
        );
      }
      if (id === 'dry') {
        return dryData.odReadings.length > 0 || dryData.osReadings.length > 0;
      }
      return subjectiveData.readings.length > 0;
    },
    [wetData, dryData, subjectiveData],
  );

  const sectionShowRail = useCallback(
    (id: RetinoscopySectionId): boolean => {
      if (sectionRecorded[id] || hasLiveSectionContent(id)) return true;
      return hasPriorHistoryForRetinoscopySection(
        id,
        patientOptometryHistory ?? [],
        excludeVisitId,
      );
    },
    [sectionRecorded, hasLiveSectionContent, patientOptometryHistory, excludeVisitId],
  );

  const notifyTabRecordState = useCallback(
    (nextRecorded: Partial<Record<RetinoscopySectionId, boolean>>) => {
      onTabRecordStateChange?.(nextRecorded);
    },
    [onTabRecordStateChange],
  );

  const persistRetinoscopySection = useCallback(
    async (
      sectionId: RetinoscopySectionId,
      isUpdate: boolean,
      payload: {
        wet?: WetRetinoscopyData;
        dry?: DryRetinoscopyData;
        subjective?: SubjectiveRefractionData;
      },
    ) => {
      if (!canEdit) return;
      setSavingSection(sectionId);
      try {
        const label = RETINOSCOPY_SECTIONS.find((s) => s.id === sectionId)?.label ?? 'Section';
        const wetSave = payload.wet ?? wetData;
        const drySave = payload.dry ?? dryData;
        const subjSave = payload.subjective ?? subjectiveData;
        let ok = false;
        if (sectionId === 'wet') ok = Boolean(await onSaveWetRetinoscopy(wetSave));
        else if (sectionId === 'dry') ok = Boolean(await onSaveDryRetinoscopy(drySave));
        else ok = Boolean(await onSaveSubjectiveRefraction(subjSave));

        if (!ok) {
          toast.error(
            `Failed to save ${RETINOSCOPY_SECTIONS.find((s) => s.id === sectionId)?.label ?? 'section'}`,
          );
          return;
        }

        const snap =
          sectionId === 'wet' ? wetSave : sectionId === 'dry' ? drySave : subjSave;
        const now = new Date().toISOString();

        setSectionRecorded((prev) => {
          const next = { ...prev, [sectionId]: true };
          notifyTabRecordState(next);
          return next;
        });
        setSectionSnapshots((prev) => ({ ...prev, [sectionId]: structuredClone(snap) }));
        setSectionRecordedAt((prev) => ({ ...prev, [sectionId]: now }));
        setEditTarget(null);
        setSectionDirty((prev) => {
          const next = { ...prev, [sectionId]: false };
          const anyDirty = RETINOSCOPY_SECTIONS.some((s) => next[s.id]);
          if (!anyDirty) onDirtyChange?.(false);
          return next;
        });

        toast.success(isUpdate ? `${label} updated` : `${label} recorded`);
      } catch (e) {
        console.error(e);
        toast.error(
          `Failed to save ${RETINOSCOPY_SECTIONS.find((s) => s.id === sectionId)?.label ?? 'section'}`,
        );
      } finally {
        setSavingSection(null);
      }
    },
    [
      canEdit,
      wetData,
      dryData,
      subjectiveData,
      onSaveWetRetinoscopy,
      onSaveDryRetinoscopy,
      onSaveSubjectiveRefraction,
      onDirtyChange,
      notifyTabRecordState,
    ],
  );

  const recordSection = useCallback(
    (sectionId: RetinoscopySectionId) => {
      if (!canAddNewRecordToday(sectionId, wetData, dryData, subjectiveData)) return;
      const prepared = prepareSectionPayload(sectionId);
      if (!prepared.ok) return;
      applyPreparedSectionState(sectionId, prepared);
      persistRetinoscopySection(sectionId, false, prepared);
    },
    [wetData, dryData, subjectiveData, prepareSectionPayload, applyPreparedSectionState, persistRetinoscopySection],
  );

  const updateSection = useCallback(
    (sectionId: RetinoscopySectionId) => {
      if (!isEditTargetForSection(editTarget, sectionId)) return;
      const prepared = prepareSectionPayload(sectionId);
      if (!prepared.ok) return;
      applyPreparedSectionState(sectionId, prepared);
      persistRetinoscopySection(sectionId, true, prepared);
    },
    [editTarget, prepareSectionPayload, applyPreparedSectionState, persistRetinoscopySection],
  );

  const cancelRailEdit = useCallback(() => {
    setEditTarget(null);
    setNewWetOD(createEmptyRetinoscopyNewReadingForm());
    setNewWetOS(createEmptyRetinoscopyNewReadingForm());
    setNewDryOD(createEmptyRetinoscopyNewReadingForm());
    setNewDryOS(createEmptyRetinoscopyNewReadingForm());
    setNewSubjReading(createEmptySubjectiveNewReading(subjectiveData.readings.length + 1));
  }, [subjectiveData.readings.length]);

  const syncRecordedFlag = useCallback(
    (
      sectionId: RetinoscopySectionId,
      data?: WetRetinoscopyData | DryRetinoscopyData | SubjectiveRefractionData,
    ) => {
      const wet = sectionId === 'wet' ? (data as WetRetinoscopyData) ?? wetData : wetData;
      const dry = sectionId === 'dry' ? (data as DryRetinoscopyData) ?? dryData : dryData;
      const subj =
        sectionId === 'subjective'
          ? (data as SubjectiveRefractionData) ?? subjectiveData
          : subjectiveData;
      const hasContent = hasTodaySectionContent(sectionId, wet, dry, subj);
      setSectionRecorded((prev) => {
        const next = { ...prev, [sectionId]: hasContent };
        onTabRecordStateChange?.(next);
        return next;
      });
      if (!hasContent) {
        setSectionRecordedAt((prev) => {
          const next = { ...prev };
          delete next[sectionId];
          return next;
        });
      }
    },
    [wetData, dryData, subjectiveData, onTabRecordStateChange],
  );

  const persistAfterLocalChange = useCallback(
    async (sectionId: RetinoscopySectionId) => {
      if (!sectionRecorded[sectionId]) return;
      const payload =
        sectionId === 'wet'
          ? { wet: wetData }
          : sectionId === 'dry'
            ? { dry: dryData }
            : { subjective: subjectiveData };
      await persistRetinoscopySection(sectionId, true, payload);
    },
    [sectionRecorded, wetData, dryData, subjectiveData, persistRetinoscopySection],
  );

  const startEditReading = useCallback(
    (sectionId: 'wet' | 'dry', eye: 'od' | 'os', reading: RetinoscopyReading) => {
      setEditTarget({ sectionId, kind: 'reading', eye, readingId: reading.id });
      const form = readingToNewReadingForm(reading);
      if (sectionId === 'wet') {
        if (eye === 'od') setNewWetOD(form);
        else setNewWetOS(form);
      } else if (eye === 'od') setNewDryOD(form);
      else setNewDryOS(form);
      setExpandedSections((prev) => new Set(prev).add(sectionId));
    },
    [],
  );

  const startEditSubjective = useCallback((reading: SubjectiveRefractionReading) => {
    setEditTarget({ sectionId: 'subjective', kind: 'subjective', readingId: reading.id });
    setNewSubjReading(subjectiveReadingToNewForm(reading));
    setExpandedSections((prev) => new Set(prev).add('subjective'));
  }, []);

  const startEditDrug = useCallback(() => {
    setEditTarget({ sectionId: 'wet', kind: 'drug' });
    setExpandedSections((prev) => new Set(prev).add('wet'));
    requestAnimationFrame(() => {
      document.getElementById('retinoscopy-wet-drug')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }, []);

  const deleteWetODReading = (id: string) => {
    const next = { ...wetData, odReadings: wetData.odReadings.filter((r) => r.id !== id) };
    setWetData(next);
    markSectionDirty('wet');
    syncRecordedFlag('wet', next);
    if (editTarget?.kind === 'reading' && editTarget.readingId === id) cancelRailEdit();
    void persistAfterLocalChange('wet');
  };

  const deleteWetOSReading = (id: string) => {
    const next = { ...wetData, osReadings: wetData.osReadings.filter((r) => r.id !== id) };
    setWetData(next);
    markSectionDirty('wet');
    syncRecordedFlag('wet', next);
    if (editTarget?.kind === 'reading' && editTarget.readingId === id) cancelRailEdit();
    void persistAfterLocalChange('wet');
  };

  const deleteWetDrug = () => {
    const next: WetRetinoscopyData = {
      ...wetData,
      drug: undefined,
      duration: undefined,
      timeAdministered: undefined,
    };
    setWetData(next);
    markSectionDirty('wet');
    if (editTarget?.sectionId === 'wet' && editTarget.kind === 'drug') cancelRailEdit();
    syncRecordedFlag('wet', next);
    void persistAfterLocalChange('wet');
  };

  const deleteDryODReading = (id: string) => {
    const next = { ...dryData, odReadings: dryData.odReadings.filter((r) => r.id !== id) };
    setDryData(next);
    markSectionDirty('dry');
    syncRecordedFlag('dry', next);
    if (editTarget?.kind === 'reading' && editTarget.readingId === id) cancelRailEdit();
    void persistAfterLocalChange('dry');
  };

  const deleteDryOSReading = (id: string) => {
    const next = { ...dryData, osReadings: dryData.osReadings.filter((r) => r.id !== id) };
    setDryData(next);
    markSectionDirty('dry');
    syncRecordedFlag('dry', next);
    if (editTarget?.kind === 'reading' && editTarget.readingId === id) cancelRailEdit();
    void persistAfterLocalChange('dry');
  };

  const deleteSubjectiveReading = (id: string) => {
    const updated = subjectiveData.readings.filter((r) => r.id !== id);
    const renumbered = updated.map((r, idx) => ({ ...r, entryNumber: idx + 1 }));
    const next = { readings: renumbered };
    setSubjectiveData(next);
    markSectionDirty('subjective');
    syncRecordedFlag('subjective', next);
    if (editTarget?.sectionId === 'subjective' && editTarget.readingId === id) cancelRailEdit();
    void persistAfterLocalChange('subjective');
  };

  const markSubjectiveAsFinal = (id: string) => {
    const next = {
      readings: subjectiveData.readings.map((r) => ({ ...r, isFinal: r.id === id })),
    };
    setSubjectiveData(next);
    markSectionDirty('subjective');
    void persistAfterLocalChange('subjective');
  };

  const handleSidebarNavigate = useCallback((id: RetinoscopySectionId) => {
    setExpandedSections((prev) => new Set(prev).add(id));
  }, []);

  const handleManualExpand = useCallback((id: RetinoscopySectionId, open: boolean) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const priorExamDateLabel = priorVisit?.examinationDate
    ? new Date(String(priorVisit.examinationDate)).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    : undefined;

  const recordedRail = (id: RetinoscopySectionId) => (
    <RetinoscopySectionRecordedRail
      sectionId={id}
      wetData={id === 'wet' ? wetData : undefined}
      dryData={id === 'dry' ? dryData : undefined}
      subjectiveData={id === 'subjective' ? subjectiveData : undefined}
      recordedAt={sectionRecordedAt[id]}
      isEditing={isEditTargetForSection(editTarget, id)}
      canEdit={canEdit}
      onEditOdReading={
        id === 'wet'
          ? (r) => startEditReading('wet', 'od', r)
          : id === 'dry'
            ? (r) => startEditReading('dry', 'od', r)
            : undefined
      }
      onDeleteOdReading={
        id === 'wet' ? deleteWetODReading : id === 'dry' ? deleteDryODReading : undefined
      }
      onEditOsReading={
        id === 'wet'
          ? (r) => startEditReading('wet', 'os', r)
          : id === 'dry'
            ? (r) => startEditReading('dry', 'os', r)
            : undefined
      }
      onDeleteOsReading={
        id === 'wet' ? deleteWetOSReading : id === 'dry' ? deleteDryOSReading : undefined
      }
      onEditSubjectiveReading={id === 'subjective' ? startEditSubjective : undefined}
      onDeleteSubjectiveReading={id === 'subjective' ? deleteSubjectiveReading : undefined}
      onMarkSubjectiveFinal={id === 'subjective' ? markSubjectiveAsFinal : undefined}
      onEditDrug={id === 'wet' ? startEditDrug : undefined}
      onDeleteDrug={id === 'wet' ? deleteWetDrug : undefined}
      patientOptometryHistory={patientOptometryHistory}
      excludeVisitId={excludeVisitId}
      priorExaminationDate={priorExamDateLabel}
    />
  );

  const sectionCardProps = (id: RetinoscopySectionId) => ({
    sectionId: id,
    recordStatus: getSectionStatus(id),
    canEdit,
    saving: savingSection === id,
    showRail: sectionShowRail(id),
    showRecordButton: canAddNew(id),
    showUpdateButton: isEditTargetForSection(editTarget, id),
    onRecord: () => recordSection(id),
    onUpdate: () => updateSection(id),
    onCancelEdit: isEditTargetForSection(editTarget, id) ? cancelRailEdit : undefined,
    isRailEditing: isEditTargetForSection(editTarget, id),
    expanded: expandedSections.has(id),
    onExpandedChange: (open: boolean) => handleManualExpand(id, open),
    recordedRail: recordedRail(id),
  });

  const wetSectionBody = (
    <>
        <div
          id="retinoscopy-wet-drug"
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg scroll-mt-24"
        >
          <ExamSelect
            label="Cycloplegic Drug"
            value={wetData.drug || ''}
            onChange={(value) => handleWetDrugChange(value)}
            disabled={!isDrugFormEditable()}
          >
            <option value="">Select drug</option>
            <option value="Tropicamide 1%">Tropicamide 1%</option>
            <option value="Cyclopentolate 1%">Cyclopentolate 1%</option>
            <option value="Atropine 1%">Atropine 1%</option>
            <option value="Homatropine 2%">Homatropine 2%</option>
          </ExamSelect>

          <ExamSelect
            label="Duration (minutes)"
            value={wetData.duration != null ? String(wetData.duration) : ''}
            onChange={(value) =>
              handleWetDurationChange(value ? parseInt(value, 10) : undefined)
            }
            disabled={!isDrugFormEditable()}
          >
            <option value="">Select duration</option>
            <option value="15">15 min</option>
            <option value="20">20 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
          </ExamSelect>

          <ExamInput
            label="Time Administered"
            type="time"
            value={wetData.timeAdministered || ''}
            onChange={(e) => handleWetTimeChange(e.target.value)}
            disabled={!isDrugFormEditable()}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RetinoscopyNewReadingColumn
            eyeTitle="Right Eye (OD)"
            variant="od"
            form={newWetOD}
            onChange={setNewWetOD}
            canEdit={isWetEyeFormEditable('od')}
          />
          <RetinoscopyNewReadingColumn
            eyeTitle="Left Eye (OS)"
            variant="os"
            form={newWetOS}
            onChange={setNewWetOS}
            canEdit={isWetEyeFormEditable('os')}
          />
        </div>
    </>
  );

  const drySectionBody = (
    <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RetinoscopyNewReadingColumn
            eyeTitle="Right Eye (OD)"
            variant="od"
            form={newDryOD}
            onChange={setNewDryOD}
            canEdit={isDryEyeFormEditable('od')}
          />
          <RetinoscopyNewReadingColumn
            eyeTitle="Left Eye (OS)"
            variant="os"
            form={newDryOS}
            onChange={setNewDryOS}
            canEdit={isDryEyeFormEditable('os')}
          />
        </div>
    </>
  );

  const subjectiveSectionBody = (
    <>
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-xs font-semibold text-purple-900 mb-2">
            Reading #{newSubjReading.entryNumber}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-blue-700 mb-1">OD (Right Eye)</h5>
              <ExamSelect
                label="Sphere (D)"
                value={newSubjReading.odSphere}
                onChange={(value) => setNewSubjReading({ ...newSubjReading, odSphere: value })}
                options={retinoscopySphereOptions()}
                disabled={!isSubjectiveFormEditable()}
              />
              <ExamSelect
                label="Cylinder (D)"
                value={newSubjReading.odCylinder}
                onChange={(value) =>
                  setNewSubjReading({
                    ...newSubjReading,
                    odCylinder: value,
                    odAxis: value ? newSubjReading.odAxis : '',
                  })
                }
                options={retinoscopyCylinderOptions()}
                disabled={!isSubjectiveFormEditable()}
              />
              <ExamSelect
                label="Axis (°)"
                value={newSubjReading.odAxis}
                onChange={(value) => setNewSubjReading({ ...newSubjReading, odAxis: value })}
                options={retinoscopyAxisOptions()}
                disabled={!isSubjectiveFormEditable() || !newSubjReading.odCylinder}
              />
              <ExamInput
                label="VA Achieved"
                value={newSubjReading.vaAchievedOD}
                onChange={(e) =>
                  setNewSubjReading({ ...newSubjReading, vaAchievedOD: e.target.value })
                }
                disabled={!isSubjectiveFormEditable()}
              />
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-emerald-700 mb-1">OS (Left Eye)</h5>
              <ExamSelect
                label="Sphere (D)"
                value={newSubjReading.osSphere}
                onChange={(value) => setNewSubjReading({ ...newSubjReading, osSphere: value })}
                options={retinoscopySphereOptions()}
                disabled={!isSubjectiveFormEditable()}
              />
              <ExamSelect
                label="Cylinder (D)"
                value={newSubjReading.osCylinder}
                onChange={(value) =>
                  setNewSubjReading({
                    ...newSubjReading,
                    osCylinder: value,
                    osAxis: value ? newSubjReading.osAxis : '',
                  })
                }
                options={retinoscopyCylinderOptions()}
                disabled={!isSubjectiveFormEditable()}
              />
              <ExamSelect
                label="Axis (°)"
                value={newSubjReading.osAxis}
                onChange={(value) => setNewSubjReading({ ...newSubjReading, osAxis: value })}
                options={retinoscopyAxisOptions()}
                disabled={!isSubjectiveFormEditable() || !newSubjReading.osCylinder}
              />
              <ExamInput
                label="VA Achieved"
                value={newSubjReading.vaAchievedOS}
                onChange={(e) =>
                  setNewSubjReading({ ...newSubjReading, vaAchievedOS: e.target.value })
                }
                disabled={!isSubjectiveFormEditable()}
              />
            </div>
          </div>
        </div>
    </>
  );

  return (
    <div className="p-2 sm:p-4">
      <RetinoscopyLayout sectionStatus={sectionStatus} onNavigateSection={handleSidebarNavigate}>
        <RetinoscopySectionCard
          {...sectionCardProps('wet')}
          title="Wet Retinoscopy (with Cycloplegic Drug)"
          icon={<Lightbulb className="w-5 h-5" />}
        >
          {wetSectionBody}
        </RetinoscopySectionCard>

        <RetinoscopySectionCard
          {...sectionCardProps('dry')}
          title="Dry Retinoscopy (without Cycloplegic)"
          icon={<Lightbulb className="w-5 h-5" />}
        >
          {drySectionBody}
        </RetinoscopySectionCard>

        <RetinoscopySectionCard
          {...sectionCardProps('subjective')}
          title="Subjective Refraction (after Wet/Dry Retinoscopy)"
          icon={<Lightbulb className="w-5 h-5" />}
        >
          {subjectiveSectionBody}
        </RetinoscopySectionCard>
      </RetinoscopyLayout>
    </div>
  );
}
