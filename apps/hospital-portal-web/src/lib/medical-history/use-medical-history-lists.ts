'use client';

import { useMasterListOptions } from '@/hooks/use-master-list-options';
import {
  ALCOHOL_SEGMENTS,
  CHRONIC_CONDITIONS_LIST,
  FAMILY_CONDITIONS_LIST,
  FAMILY_RELATIONSHIPS,
  IMMUNIZATIONS_LIST,
  MEDICATIONS_LIST,
  MEDICATION_ROUTES,
  SMOKING_SEGMENTS,
  SURGERIES_LIST,
} from '@/lib/medical-history/medical-history-constants';

/** B8 — medical history picklists from master with constant fallback. */
export function useChronicConditionOptions() {
  return useMasterListOptions('medical_history.chronic_condition', CHRONIC_CONDITIONS_LIST);
}

export function useMedicationOptions() {
  return useMasterListOptions('medical_history.medication', MEDICATIONS_LIST);
}

export function useSurgeryHistoryOptions() {
  return useMasterListOptions('medical_history.surgery', SURGERIES_LIST);
}

export function useFamilyConditionOptions() {
  return useMasterListOptions('medical_history.family_condition', FAMILY_CONDITIONS_LIST);
}

export function useImmunizationOptions() {
  return useMasterListOptions('medical_history.immunization', IMMUNIZATIONS_LIST);
}

export function useMedicationRouteOptions() {
  return useMasterListOptions('medical_history.medication_route', MEDICATION_ROUTES);
}

export function useFamilyRelationshipOptions() {
  return useMasterListOptions('medical_history.family_relationship', FAMILY_RELATIONSHIPS);
}

export function useSmokingSegmentOptions() {
  const { labels, loading, error, fromMaster } = useMasterListOptions(
    'medical_history.smoking_status',
    SMOKING_SEGMENTS.map((s) => s.label),
  );
  return {
    segments: fromMaster
      ? labels.map((label) => ({ value: label, label }))
      : [...SMOKING_SEGMENTS],
    loading,
    error,
  };
}

export function useAlcoholSegmentOptions() {
  const { labels, loading, error, fromMaster } = useMasterListOptions(
    'medical_history.alcohol_use',
    ALCOHOL_SEGMENTS.map((s) => s.label),
  );
  return {
    segments: fromMaster
      ? labels.map((label) => ({ value: label, label }))
      : [...ALCOHOL_SEGMENTS],
    loading,
    error,
  };
}
