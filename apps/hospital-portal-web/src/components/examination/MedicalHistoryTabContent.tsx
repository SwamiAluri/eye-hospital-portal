'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import toast from 'react-hot-toast';
import { patientApi, type Patient } from '@/lib/api/patients.api';
import type { DisplayAllergy } from '@/lib/medical-history/allergy-utils';
import { syncAllergiesToPatient } from '@/lib/medical-history/sync-patient-allergies';
import type {
  ChronicCondition,
  FamilyCondition,
  Immunization,
  MedicalHistorySectionId,
  Medication,
  Surgery,
} from '@/lib/medical-history/medical-history-constants';
import { MedicalHistoryAllergiesSection } from '@/components/examination/medical-history/MedicalHistoryAllergiesSection';
import { MedicalHistoryLayout } from '@/components/examination/medical-history/MedicalHistoryLayout';
import { LifestyleDisabilitySection } from '@/components/examination/medical-history/LifestyleDisabilitySection';
import {
  ConditionsListSection,
  FamilyListSection,
  ImmunizationsListSection,
  MedicationsListSection,
  SurgeriesListSection,
} from '@/components/examination/medical-history/medical-history-list-sections';
import type {
  MedicalHistoryHandle,
  MedicalHistorySnapshot,
} from '@/components/examination/medical-history/medical-history-handle';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';
import { MhPriorVisitReviewBanner } from '@/components/examination/exam-ui/MhPriorVisitReviewBanner';
import { MhPriorSectionPanel } from '@/components/examination/medical-history/MhPriorSectionPanel';
import { MhSectionRow } from '@/components/examination/medical-history/MhSectionRow';
import {
  medicalHistoryFromPriorVisit,
  medicalHistorySnapshotHasClinicalData,
  serializeMedicalHistorySnapshot,
  serializeMedicalHistorySnapshotFromRecord,
} from '@/lib/medical-history/medical-history-snapshot';

export interface MedicalHistoryTabContentProps {
  patientId: string;
  canEdit?: boolean;
  patientDetails?: Patient | null;
  patientLoading?: boolean;
  priorVisit?: PriorVisitSnapshot | null;
  patientOptometryHistory?: OptometryVisitExamRecord[];
  excludeVisitId?: string;
  visitId?: string;
  /** Snapshot from visit segment `medical_history_bundle`. */
  visitSnapshot?: MedicalHistorySnapshot | null;
  draftSnapshot?: MedicalHistorySnapshot | null;
  /** Parent finished loading draft + visit segment (defer empty baseline). */
  hydrationReady?: boolean;
  onUpdate?: (updatedPatient: Patient) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onAllergiesUpdated?: (allergies: DisplayAllergy[], nkda: boolean) => void;
  onMhReviewed?: () => void;
  /** Keeps parent in sync so segment flush works after leaving this tab. */
  onSnapshotChange?: (snapshot: MedicalHistorySnapshot) => void;
  /** After patient + allergies save, upsert visit `medical_history_bundle` (Phase 2). */
  onPersistVisitBundle?: (snapshot: MedicalHistorySnapshot) => Promise<boolean>;
}

const ACCOMMODATIONS_PREFIX = 'Accommodations:';

function parseSpecialNeeds(raw: string): { flags: string[]; needs: string } {
  if (!raw?.startsWith(ACCOMMODATIONS_PREFIX)) {
    return { flags: [], needs: raw || '' };
  }
  const [first, ...rest] = raw.split('\n');
  const flags = first
    .replace(ACCOMMODATIONS_PREFIX, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { flags, needs: rest.join('\n').trim() };
}

function buildSpecialNeeds(flags: string[], needs: string): string {
  const parts: string[] = [];
  if (flags.length) {
    parts.push(`${ACCOMMODATIONS_PREFIX} ${flags.join(', ')}`);
  }
  if (needs.trim()) parts.push(needs.trim());
  return parts.join('\n');
}

function applySnapshotToState(
  snap: MedicalHistorySnapshot,
  setters: {
    setDisplayAllergies: (v: DisplayAllergy[]) => void;
    setNkda: (v: boolean) => void;
    setChronicConditions: (v: ChronicCondition[]) => void;
    setMedications: (v: Medication[]) => void;
    setSurgeries: (v: Surgery[]) => void;
    setFamilyHistory: (v: FamilyCondition[]) => void;
    setImmunizations: (v: Immunization[]) => void;
    setSmokingStatus: (v: string) => void;
    setSmokingQuitDate: (v: string) => void;
    setSmokingPackYears: (v: string) => void;
    setAlcoholUse: (v: string) => void;
    setExerciseHabits: (v: string) => void;
    setDietType: (v: string) => void;
    setLifestyleNotes: (v: string) => void;
    setDisabilityStatus: (v: string) => void;
    setSpecialNeeds: (v: string) => void;
    setDisabilityFlags: (v: string[]) => void;
  },
  options?: { fullReplace?: boolean },
) {
  const full = options?.fullReplace ?? false;

  if (typeof snap.nkda === 'boolean') {
    setters.setNkda(snap.nkda);
    if (snap.nkda) {
      setters.setDisplayAllergies([]);
    } else if (Array.isArray(snap.allergies) && (full || snap.allergies.length > 0)) {
      setters.setDisplayAllergies(snap.allergies as DisplayAllergy[]);
    }
  } else if (Array.isArray(snap.allergies) && (full || snap.allergies.length > 0)) {
    setters.setDisplayAllergies(snap.allergies as DisplayAllergy[]);
  }

  if (Array.isArray(snap.chronicConditions) && (full || snap.chronicConditions.length > 0)) {
    setters.setChronicConditions(snap.chronicConditions as ChronicCondition[]);
  }
  if (Array.isArray(snap.medications) && (full || snap.medications.length > 0)) {
    setters.setMedications(snap.medications as Medication[]);
  }
  if (Array.isArray(snap.surgeries) && (full || snap.surgeries.length > 0)) {
    setters.setSurgeries(snap.surgeries as Surgery[]);
  }
  if (Array.isArray(snap.familyHistory) && (full || snap.familyHistory.length > 0)) {
    setters.setFamilyHistory(snap.familyHistory as FamilyCondition[]);
  }
  if (Array.isArray(snap.immunizations) && (full || snap.immunizations.length > 0)) {
    setters.setImmunizations(snap.immunizations as Immunization[]);
  }

  const smokingStatus = snap.smokingStatus ?? '';
  if (full || smokingStatus.trim()) setters.setSmokingStatus(smokingStatus);
  const smokingQuitDate = (snap as { smokingQuitDate?: string }).smokingQuitDate ?? '';
  if (full || smokingQuitDate.trim()) setters.setSmokingQuitDate(smokingQuitDate);
  const smokingPackYears = (snap as { smokingPackYears?: string }).smokingPackYears ?? '';
  if (full || smokingPackYears.trim()) setters.setSmokingPackYears(smokingPackYears);
  const alcoholUse = snap.alcoholUse ?? '';
  if (full || alcoholUse.trim()) setters.setAlcoholUse(alcoholUse);
  const exerciseHabits = snap.exerciseHabits ?? '';
  if (full || exerciseHabits.trim()) setters.setExerciseHabits(exerciseHabits);
  const dietType = snap.dietType ?? '';
  if (full || dietType.trim()) setters.setDietType(dietType);
  const lifestyleNotes = snap.lifestyleNotes ?? '';
  if (full || lifestyleNotes.trim()) setters.setLifestyleNotes(lifestyleNotes);
  const disabilityStatus = snap.disabilityStatus ?? '';
  if (full || disabilityStatus.trim()) setters.setDisabilityStatus(disabilityStatus);

  const flags = (snap as { disabilityFlags?: string[] }).disabilityFlags;
  const specialNeedsRaw = snap.specialNeeds ?? '';
  if (flags && (full || flags.length > 0)) {
    setters.setDisabilityFlags(flags);
    if (full || specialNeedsRaw.trim()) setters.setSpecialNeeds(specialNeedsRaw);
  } else if (full || specialNeedsRaw.trim()) {
    const parsed = parseSpecialNeeds(specialNeedsRaw);
    setters.setDisabilityFlags(parsed.flags);
    setters.setSpecialNeeds(parsed.needs);
  }
}

export const MedicalHistoryTabContent = forwardRef<MedicalHistoryHandle, MedicalHistoryTabContentProps>(
function MedicalHistoryTabContent(
  {
    patientId,
    canEdit = true,
    patientDetails,
    patientLoading = false,
    priorVisit = null,
    patientOptometryHistory = [],
    excludeVisitId,
    visitId: visitIdProp,
    visitSnapshot = null,
    draftSnapshot = null,
    hydrationReady = true,
    onUpdate,
    onDirtyChange,
    onAllergiesUpdated,
    onMhReviewed,
    onSnapshotChange,
    onPersistVisitBundle,
  },
  ref,
) {
  const [chronicConditions, setChronicConditions] = useState<ChronicCondition[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [displayAllergies, setDisplayAllergies] = useState<DisplayAllergy[]>([]);
  const [nkda, setNkda] = useState(false);
  const allergyBaselineIds = useRef<Set<string>>(new Set());
  const savedSnapshotRef = useRef<string>('');
  const allergiesReadyRef = useRef(false);
  const patientBaselineRef = useRef<string>('');
  const draftAppliedRef = useRef(false);
  const visitAppliedRef = useRef(false);
  const visitSnapshotKeyRef = useRef<string>('');
  const pendingBaselineSyncRef = useRef(false);
  const onDirtyChangeRef = useRef(onDirtyChange);
  const onSnapshotChangeRef = useRef(onSnapshotChange);
  const lastReportedDirtyRef = useRef<boolean | null>(null);
  const [baselineReady, setBaselineReady] = useState(false);
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [familyHistory, setFamilyHistory] = useState<FamilyCondition[]>([]);
  const [immunizations, setImmunizations] = useState<Immunization[]>([]);
  
  const [smokingStatus, setSmokingStatus] = useState('');
  const [smokingQuitDate, setSmokingQuitDate] = useState('');
  const [smokingPackYears, setSmokingPackYears] = useState('');
  const [alcoholUse, setAlcoholUse] = useState('');
  const [exerciseHabits, setExerciseHabits] = useState('');
  const [dietType, setDietType] = useState('');
  const [lifestyleNotes, setLifestyleNotes] = useState('');
  const [disabilityStatus, setDisabilityStatus] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState('');
  const [disabilityFlags, setDisabilityFlags] = useState<string[]>([]);
  const [eyeDropsOnly, setEyeDropsOnly] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localPatient, setLocalPatient] = useState<Patient | null>(null);

  useEffect(() => {
    allergiesReadyRef.current = false;
    draftAppliedRef.current = false;
    visitAppliedRef.current = false;
    visitSnapshotKeyRef.current = '';
    pendingBaselineSyncRef.current = false;
    patientBaselineRef.current = '';
    savedSnapshotRef.current = '';
    lastReportedDirtyRef.current = null;
    setBaselineReady(false);
  }, [patientId, visitIdProp]);

  // Load patient data (skip when parent is already fetching)
  useEffect(() => {
    if (patientDetails) {
      setLocalPatient(patientDetails);
      setLoading(false);
      return;
    }

    if (patientLoading) {
      setLoading(true);
      return;
    }

    let cancelled = false;

    const loadPatientData = async () => {
      setLoading(true);
      try {
        const response = await patientApi.getById(patientId);
        if (!cancelled) setLocalPatient(response.data);
      } catch (error) {
        console.error('Failed to load patient:', error);
        if (!cancelled) toast.error('Failed to load patient details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPatientData();

    return () => {
      cancelled = true;
    };
  }, [patientId, patientDetails, patientLoading]);

  // Parse JSON data from patient record
  useEffect(() => {
    if (localPatient) {
      try {
        const parseJSON = (field: any) => {
          if (!field) return [];
          try {
            return typeof field === 'string' ? JSON.parse(field) : Array.isArray(field) ? field : [];
          } catch {
            return [];
          }
        };

        setChronicConditions(parseJSON((localPatient as any).chronicConditions));
        setMedications(parseJSON((localPatient as any).currentMedications));
        setNkda(
          Array.isArray(localPatient.allergies) &&
            localPatient.allergies.some((a) => a.toUpperCase() === 'NKDA'),
        );
        setSurgeries(parseJSON((localPatient as any).pastSurgeries));
        setFamilyHistory(parseJSON((localPatient as any).familyMedicalHistory));
        setImmunizations(parseJSON((localPatient as any).immunizationRecords));
        
        setSmokingStatus((localPatient as any).smokingStatus || '');
        setAlcoholUse((localPatient as any).alcoholUse || '');
        setExerciseHabits((localPatient as any).exerciseHabits || '');
        setDietType((localPatient as any).dietType || '');
        setLifestyleNotes((localPatient as any).lifestyleNotes || '');
        setDisabilityStatus((localPatient as any).disabilityStatus || '');
        const parsedNeeds = parseSpecialNeeds((localPatient as any).specialNeeds || '');
        setDisabilityFlags(parsedNeeds.flags);
        setSpecialNeeds(parsedNeeds.needs);

      } catch (error) {
        console.error('Error parsing medical history:', error);
      }
    }
  }, [localPatient]);

  const lifestyleFields = useMemo(
    () => ({
      smokingStatus,
      smokingQuitDate,
      smokingPackYears,
      alcoholUse,
      exerciseHabits,
      dietType,
      lifestyleNotes,
      disabilityStatus,
      specialNeeds: buildSpecialNeeds(disabilityFlags, specialNeeds),
      disabilityFlags,
    }),
    [
      smokingStatus,
      smokingQuitDate,
      smokingPackYears,
      alcoholUse,
      exerciseHabits,
      dietType,
      lifestyleNotes,
      disabilityStatus,
      disabilityFlags,
      specialNeeds,
    ],
  );

  const currentSnapshot = useMemo(
    () =>
      serializeMedicalHistorySnapshot(
        displayAllergies,
        nkda,
        chronicConditions,
        medications,
        surgeries,
        familyHistory,
        immunizations,
        lifestyleFields,
      ),
    [
      displayAllergies,
      nkda,
      chronicConditions,
      medications,
      surgeries,
      familyHistory,
      immunizations,
      lifestyleFields,
    ],
  );

  const liveSnapshot = useMemo(
    (): MedicalHistorySnapshot => ({
      allergies: displayAllergies,
      nkda,
      chronicConditions,
      medications,
      allergiesLegacy: [],
      surgeries,
      familyHistory,
      immunizations,
      smokingStatus,
      alcoholUse,
      exerciseHabits,
      dietType,
      lifestyleNotes,
      disabilityStatus,
      specialNeeds: lifestyleFields.specialNeeds,
      disabilityFlags: lifestyleFields.disabilityFlags,
      smokingQuitDate,
      smokingPackYears,
    }),
    [
      displayAllergies,
      nkda,
      chronicConditions,
      medications,
      surgeries,
      familyHistory,
      immunizations,
      smokingStatus,
      alcoholUse,
      exerciseHabits,
      dietType,
      lifestyleNotes,
      disabilityStatus,
      lifestyleFields,
      smokingQuitDate,
      smokingPackYears,
    ],
  );

  const liveSnapshotRef = useRef(liveSnapshot);
  liveSnapshotRef.current = liveSnapshot;
  const currentSnapshotRef = useRef(currentSnapshot);
  currentSnapshotRef.current = currentSnapshot;

  const snapshotSetters = useMemo(
    () => ({
      setDisplayAllergies,
      setNkda,
      setChronicConditions,
      setMedications,
      setSurgeries,
      setFamilyHistory,
      setImmunizations,
      setSmokingStatus,
      setSmokingQuitDate,
      setSmokingPackYears,
      setAlcoholUse,
      setExerciseHabits,
      setDietType,
      setLifestyleNotes,
      setDisabilityStatus,
      setSpecialNeeds,
      setDisabilityFlags,
    }),
    [],
  );

  const handleCopyFromPrior = useCallback(() => {
    if (!priorVisit) return;
    const partial = medicalHistoryFromPriorVisit(priorVisit);
    if (!partial) {
      toast.error('No medical history data available from the last visit');
      return;
    }
    applySnapshotToState(
      {
        allergies: displayAllergies,
        nkda,
        chronicConditions,
        medications,
        surgeries,
        familyHistory,
        immunizations,
        smokingStatus,
        alcoholUse,
        exerciseHabits,
        dietType,
        lifestyleNotes,
        disabilityStatus,
        specialNeeds: buildSpecialNeeds(disabilityFlags, specialNeeds),
        disabilityFlags,
        smokingQuitDate,
        smokingPackYears,
        ...partial,
      } as MedicalHistorySnapshot,
      snapshotSetters,
      { fullReplace: true },
    );
    toast.success('Medical history copied from last visit');
  }, [
    priorVisit,
    displayAllergies,
    nkda,
    chronicConditions,
    medications,
    surgeries,
    familyHistory,
    immunizations,
    smokingStatus,
    alcoholUse,
    exerciseHabits,
    dietType,
    lifestyleNotes,
    disabilityStatus,
    disabilityFlags,
    specialNeeds,
    smokingQuitDate,
    smokingPackYears,
    snapshotSetters,
  ]);

  const isDirty = baselineReady && currentSnapshot !== savedSnapshotRef.current;

  onDirtyChangeRef.current = onDirtyChange;
  onSnapshotChangeRef.current = onSnapshotChange;

  useEffect(() => {
    if (lastReportedDirtyRef.current === isDirty) return;
    lastReportedDirtyRef.current = isDirty;
    onDirtyChangeRef.current?.(isDirty);
  }, [isDirty]);

  useEffect(() => {
    return () => {
      onSnapshotChangeRef.current?.(liveSnapshotRef.current);
    };
  }, []);

  useEffect(() => {
    if (!localPatient) return;
    onSnapshotChangeRef.current?.(liveSnapshot);
  }, [localPatient, liveSnapshot]);

  const snapshotFingerprint = useCallback((snap: MedicalHistorySnapshot) => {
    return serializeMedicalHistorySnapshotFromRecord(
      snap,
      buildSpecialNeeds,
      parseSpecialNeeds,
    );
  }, []);

  const applyExternalSnapshot = useCallback(
    (snap: MedicalHistorySnapshot, source: 'visit' | 'draft') => {
      if (!medicalHistorySnapshotHasClinicalData(snap)) return false;
      const key = snapshotFingerprint(snap);
      if (source === 'visit') {
        if (visitSnapshotKeyRef.current === key && visitAppliedRef.current) return false;
        visitSnapshotKeyRef.current = key;
        visitAppliedRef.current = true;
      } else {
        if (draftAppliedRef.current) return false;
        draftAppliedRef.current = true;
      }
      if (!patientBaselineRef.current) {
        patientBaselineRef.current = currentSnapshot;
      }
      applySnapshotToState(snap, snapshotSetters);
      pendingBaselineSyncRef.current = true;
      return true;
    },
    [currentSnapshot, snapshotFingerprint, snapshotSetters],
  );

  useEffect(() => {
    if (loading || !localPatient || !allergiesReadyRef.current || !hydrationReady) return;

    const applyCanonicalSnapshots = (): boolean => {
      // Visit segment wins over draft on load (Rule 2).
      if (visitSnapshot && applyExternalSnapshot(visitSnapshot, 'visit')) {
        return true;
      }
      if (draftSnapshot && applyExternalSnapshot(draftSnapshot, 'draft')) {
        return true;
      }
      return false;
    };

    if (!baselineReady) {
      if (applyCanonicalSnapshots()) {
        return;
      }

      const patientBaseline = patientBaselineRef.current || currentSnapshot;
      savedSnapshotRef.current = currentSnapshot;
      patientBaselineRef.current = patientBaseline;
      setBaselineReady(true);
      return;
    }

    applyCanonicalSnapshots();
  }, [
    loading,
    localPatient,
    baselineReady,
    hydrationReady,
    visitSnapshot,
    draftSnapshot,
    currentSnapshot,
    applyExternalSnapshot,
  ]);

  useEffect(() => {
    if (!pendingBaselineSyncRef.current || !baselineReady) return;
    pendingBaselineSyncRef.current = false;
    savedSnapshotRef.current = currentSnapshot;
    if (lastReportedDirtyRef.current !== false) {
      lastReportedDirtyRef.current = false;
      onDirtyChangeRef.current?.(false);
    }
  }, [currentSnapshot, baselineReady]);

  const handleSave = async (): Promise<Patient | null> => {
    if (!canEdit) {
      toast.error('You do not have permission to edit patient records');
      return null;
    }

    setSaving(true);
    try {
      const { allergies: syncedAllergies, jsonSnapshot } = await syncAllergiesToPatient(
        patientId,
        nkda ? [] : displayAllergies,
        allergyBaselineIds.current,
      );
      setDisplayAllergies(syncedAllergies);
      allergyBaselineIds.current = new Set(syncedAllergies.map((a) => a.id));
      onAllergiesUpdated?.(syncedAllergies, nkda);

      const allergyLabels = nkda
        ? ['NKDA']
        : syncedAllergies.map((a) => a.allergenName);

      const updatePayload = {
        ...localPatient,
        allergies: allergyLabels,
        chronicConditions: JSON.stringify(chronicConditions),
        currentMedications: JSON.stringify(medications),
        knownAllergiesDetails: jsonSnapshot,
        pastSurgeries: JSON.stringify(surgeries),
        familyMedicalHistory: JSON.stringify(familyHistory),
        immunizationRecords: JSON.stringify(immunizations),
        smokingStatus,
        alcoholUse,
        exerciseHabits,
        dietType,
        lifestyleNotes,
        disabilityStatus,
        specialNeeds: buildSpecialNeeds(disabilityFlags, specialNeeds),
      };

      const response = await patientApi.update(patientId, updatePayload as any);
      const savedSnap: MedicalHistorySnapshot = {
        nkda,
        allergies: syncedAllergies,
        chronicConditions,
        medications,
        surgeries,
        familyHistory,
        immunizations,
        smokingStatus,
        smokingQuitDate,
        smokingPackYears,
        alcoholUse,
        exerciseHabits,
        dietType,
        lifestyleNotes,
        disabilityStatus,
        disabilityFlags,
        specialNeeds: buildSpecialNeeds(disabilityFlags, specialNeeds),
      };
      savedSnapshotRef.current = serializeMedicalHistorySnapshot(
        syncedAllergies,
        nkda,
        chronicConditions,
        medications,
        surgeries,
        familyHistory,
        immunizations,
        lifestyleFields,
      );
      setLocalPatient(response.data);

      if (onPersistVisitBundle) {
        const segmentOk = await onPersistVisitBundle(savedSnap);
        if (!segmentOk) {
          return null;
        }
      }

      toast.success('Medical history saved');

      if (onUpdate && response.data) {
        onUpdate(response.data);
      }
      return response.data;
    } catch (error: any) {
      console.error('Failed to update medical history:', error);
      toast.error(error?.response?.data?.message || 'Failed to update medical history');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = useCallback(() => {
    try {
      const snap = JSON.parse(savedSnapshotRef.current || '{}');
      if (snap.chronicConditions) setChronicConditions(snap.chronicConditions);
      if (snap.medications) setMedications(snap.medications);
      if (snap.allergies) setDisplayAllergies(snap.allergies);
      if (snap.surgeries) setSurgeries(snap.surgeries);
      if (snap.familyHistory) setFamilyHistory(snap.familyHistory);
      if (snap.immunizations) setImmunizations(snap.immunizations);
      if (typeof snap.nkda === 'boolean') setNkda(snap.nkda);
      setSmokingStatus(snap.smokingStatus ?? '');
      setSmokingQuitDate(snap.smokingQuitDate ?? '');
      setSmokingPackYears(snap.smokingPackYears ?? '');
      setAlcoholUse(snap.alcoholUse ?? '');
      setExerciseHabits(snap.exerciseHabits ?? '');
      setDietType(snap.dietType ?? '');
      setLifestyleNotes(snap.lifestyleNotes ?? '');
      setDisabilityStatus(snap.disabilityStatus ?? '');
      if (snap.disabilityFlags) {
        setDisabilityFlags(snap.disabilityFlags);
        setSpecialNeeds(snap.specialNeeds ?? '');
      } else {
        const parsed = parseSpecialNeeds(snap.specialNeeds ?? '');
        setDisabilityFlags(parsed.flags);
        setSpecialNeeds(parsed.needs);
      }
    } catch {
      /* reload from patient */
    }
  }, []);

  const acknowledgePersisted = useCallback(() => {
    pendingBaselineSyncRef.current = true;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      isHydrated: () => baselineReady,
      isDirty: () => baselineReady && currentSnapshot !== savedSnapshotRef.current,
      save: handleSave,
      discard: handleDiscard,
      getSnapshot: () => liveSnapshot,
      getDisplayAllergies: () => displayAllergies,
      acknowledgePersisted,
      hydrateFromSnapshot: (snap: MedicalHistorySnapshot) => {
        applySnapshotToState(snap, snapshotSetters);
        pendingBaselineSyncRef.current = true;
      },
    }),
    [
      baselineReady,
      currentSnapshot,
      handleSave,
      handleDiscard,
      acknowledgePersisted,
      liveSnapshot,
      displayAllergies,
    ],
  );

  useEffect(() => {
    onAllergiesUpdated?.(displayAllergies, nkda);
  }, [displayAllergies, nkda, onAllergiesUpdated]);

  const handleAllergiesHydrated = useCallback(
    (next: DisplayAllergy[]) => {
      setDisplayAllergies((prev) => {
        if (next.length === 0 && prev.length > 0) return prev;
        return next;
      });
      allergiesReadyRef.current = true;
      if (baselineReady) {
        pendingBaselineSyncRef.current = true;
      }
    },
    [baselineReady],
  );

  const handleAllergiesChange = useCallback((next: DisplayAllergy[]) => {
    setDisplayAllergies(next);
  }, []);

  const handleBaselineIdsReady = useCallback((ids: Set<string>) => {
    allergyBaselineIds.current = ids;
  }, []);

  const sectionCounts: Partial<Record<MedicalHistorySectionId, number>> = {
    allergies: nkda ? 0 : displayAllergies.length,
    conditions: chronicConditions.length,
    medications: medications.length,
    surgeries: surgeries.length,
    family: familyHistory.length,
    immunizations: immunizations.length,
    lifestyle: smokingStatus || alcoholUse ? 1 : 0,
    disability: disabilityFlags.length + (disabilityStatus ? 1 : 0) + (specialNeeds ? 1 : 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Loading medical history...</span>
      </div>
    );
  }

  return (
    <MedicalHistoryLayout
      sectionCounts={sectionCounts}
      hasUnsavedChanges={isDirty}
      priorVisitBanner={
        <MhPriorVisitReviewBanner
          priorVisit={priorVisit}
          onMarkReviewed={onMhReviewed}
          onCopyFromPrior={priorVisit ? handleCopyFromPrior : undefined}
        />
      }
      patientOptometryHistory={patientOptometryHistory}
    >
      <MhPriorSectionPanel
        sectionId="allergies"
        patientOptometryHistory={patientOptometryHistory}
        excludeVisitId={excludeVisitId}
      />
      <MedicalHistoryAllergiesSection
        patientId={patientId}
        knownAllergiesDetails={(localPatient as Patient | null)?.knownAllergiesDetails}
        canEdit={canEdit}
        nkda={nkda}
        onNkdaChange={setNkda}
        allergies={displayAllergies}
        onAllergiesHydrated={handleAllergiesHydrated}
        onAllergiesChange={handleAllergiesChange}
        onBaselineIdsReady={handleBaselineIdsReady}
      />

      <MhSectionRow>
        <div className="flex flex-col gap-2 min-w-0">
          <MhPriorSectionPanel
            sectionId="conditions"
            patientOptometryHistory={patientOptometryHistory}
            excludeVisitId={excludeVisitId}
          />
          <ConditionsListSection
          items={chronicConditions}
          canEdit={canEdit}
          onAdd={(d) => {
            setChronicConditions([...chronicConditions, { ...d, id: Date.now().toString() }]);
          }}
          onEdit={(item) => {
            setChronicConditions(chronicConditions.map((c) => (c.id === item.id ? item : c)));
          }}
          onDelete={(id) => {
            setChronicConditions(chronicConditions.filter((c) => c.id !== id));
          }}
        />
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <MhPriorSectionPanel
            sectionId="medications"
            patientOptometryHistory={patientOptometryHistory}
            excludeVisitId={excludeVisitId}
          />
          <MedicationsListSection
          items={medications}
          canEdit={canEdit}
          eyeDropsOnly={eyeDropsOnly}
          onEyeDropsOnlyChange={setEyeDropsOnly}
          onAdd={(d) => {
            setMedications([...medications, { ...d, id: Date.now().toString() }]);
          }}
          onEdit={(item) => {
            setMedications(medications.map((m) => (m.id === item.id ? item : m)));
          }}
          onDelete={(id) => {
            setMedications(medications.filter((m) => m.id !== id));
          }}
        />
        </div>
      </MhSectionRow>

      <MhSectionRow>
        <div className="flex flex-col gap-2 min-w-0">
          <MhPriorSectionPanel
            sectionId="surgeries"
            patientOptometryHistory={patientOptometryHistory}
            excludeVisitId={excludeVisitId}
          />
          <SurgeriesListSection
          items={surgeries}
          canEdit={canEdit}
          onAdd={(d) => {
            setSurgeries([...surgeries, { ...d, id: Date.now().toString() }]);
          }}
          onEdit={(item) => {
            setSurgeries(surgeries.map((s) => (s.id === item.id ? item : s)));
          }}
          onDelete={(id) => {
            setSurgeries(surgeries.filter((s) => s.id !== id));
          }}
        />
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <MhPriorSectionPanel
            sectionId="family"
            patientOptometryHistory={patientOptometryHistory}
            excludeVisitId={excludeVisitId}
          />
          <FamilyListSection
          items={familyHistory}
          canEdit={canEdit}
          onAdd={(d) => {
            setFamilyHistory([...familyHistory, { ...d, id: Date.now().toString() }]);
          }}
          onEdit={(item) => {
            setFamilyHistory(familyHistory.map((f) => (f.id === item.id ? item : f)));
          }}
          onDelete={(id) => {
            setFamilyHistory(familyHistory.filter((f) => f.id !== id));
          }}
        />
        </div>
      </MhSectionRow>

      <MhPriorSectionPanel
        sectionId="immunizations"
        patientOptometryHistory={patientOptometryHistory}
        excludeVisitId={excludeVisitId}
      />
      <ImmunizationsListSection
        items={immunizations}
        canEdit={canEdit}
        onAdd={(d) => {
          setImmunizations([...immunizations, { ...d, id: Date.now().toString() }]);
        }}
        onEdit={(item) => {
          setImmunizations(immunizations.map((i) => (i.id === item.id ? item : i)));
        }}
        onDelete={(id) => {
          setImmunizations(immunizations.filter((i) => i.id !== id));
        }}
      />

      <LifestyleDisabilitySection
        canEdit={canEdit}
        smokingStatus={smokingStatus}
        smokingQuitDate={smokingQuitDate}
        smokingPackYears={smokingPackYears}
        alcoholUse={alcoholUse}
        exerciseHabits={exerciseHabits}
        dietType={dietType}
        lifestyleNotes={lifestyleNotes}
        disabilityStatus={disabilityStatus}
        specialNeeds={specialNeeds}
        disabilityFlags={disabilityFlags}
        onSmokingStatusChange={setSmokingStatus}
        onSmokingQuitDateChange={setSmokingQuitDate}
        onSmokingPackYearsChange={setSmokingPackYears}
        onAlcoholUseChange={setAlcoholUse}
        onExerciseHabitsChange={setExerciseHabits}
        onDietTypeChange={setDietType}
        onLifestyleNotesChange={setLifestyleNotes}
        onDisabilityStatusChange={setDisabilityStatus}
        onSpecialNeedsChange={setSpecialNeeds}
        onDisabilityFlagsChange={setDisabilityFlags}
        onChange={() => {}}
      />

      {canEdit && isDirty && (
        <p className="lg:hidden text-xs text-amber-700 flex items-center gap-1.5 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Unsaved changes — save via prompt or autosave
        </p>
      )}
    </MedicalHistoryLayout>
  );
});
MedicalHistoryTabContent.displayName = 'MedicalHistoryTabContent';
