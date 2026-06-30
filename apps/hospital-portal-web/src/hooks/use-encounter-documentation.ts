'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import {
  examinationDraftApi,
  parseExaminationDraftData,
} from '@/lib/api/examinationDraft.api';
import { useAutoSave } from '@/hooks/useAutoSave';
import {
  EMPTY_ENCOUNTER_DOCUMENTATION,
  isEncounterDocumentation,
  type EncounterDocumentation,
} from '@/lib/patients/encounter-types';

const ENCOUNTER_VISIT_KEY = 'encounterVisitId';

function mergeDraftData(
  existing: unknown,
  encounterDocumentation: EncounterDocumentation,
  visitId: string,
): Record<string, unknown> {
  const prior =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...prior, [ENCOUNTER_VISIT_KEY]: visitId, encounterDocumentation };
}

function draftMatchesVisit(data: unknown, visitId: string): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return true;
  const scopedVisitId = (data as Record<string, unknown>)[ENCOUNTER_VISIT_KEY];
  return scopedVisitId == null || scopedVisitId === visitId;
}

function readEncounterDocumentation(data: unknown): EncounterDocumentation | null {
  const encounterDoc = (data as { encounterDocumentation?: unknown })?.encounterDocumentation;
  if (isEncounterDocumentation(encounterDoc)) return encounterDoc;
  if (isEncounterDocumentation(data)) return data;
  return null;
}

async function loadEncounterDraft(patientId: string, visitId: string) {
  const scoped = await examinationDraftApi.getDraft(patientId, visitId);
  if (scoped) return scoped;

  const fallback = await examinationDraftApi.getDraft(patientId);
  if (!fallback) return null;

  const data = parseExaminationDraftData(fallback.data);
  return draftMatchesVisit(data, visitId) ? fallback : null;
}

function axiosStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export function useEncounterDocumentation(patientId: string, visitId: string, canEdit: boolean) {
  const { user } = useAuthStore();
  const [documentation, setDocumentation] = useState<EncounterDocumentation>(EMPTY_ENCOUNTER_DOCUMENTATION);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const draft = await loadEncounterDraft(patientId, visitId);
        if (cancelled) return;
        const doc = readEncounterDocumentation(parseExaminationDraftData(draft?.data));
        if (doc) setDocumentation(doc);
      } catch (error) {
        console.error('Failed to load encounter documentation:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [patientId, visitId, user?.id]);

  const persist = useCallback(
    async (next: EncounterDocumentation) => {
      if (!user?.id) return;

      const existing = await loadEncounterDraft(patientId, visitId);
      const payload = mergeDraftData(parseExaminationDraftData(existing?.data), next, visitId);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      try {
        await examinationDraftApi.saveDraft({
          patientId,
          doctorId: user.id,
          visitId,
          data: payload,
          expiresAt,
        });
        return;
      } catch (error) {
        const status = axiosStatus(error);
        // Visit FK may reject unknown visit ids — store visit id inside JSON instead.
        if (status !== 400 && status !== 500) throw error;
      }

      await examinationDraftApi.saveDraft({
        patientId,
        doctorId: user.id,
        data: payload,
        expiresAt,
      });
    },
    [patientId, visitId, user?.id],
  );

  const { saveNow, lastSaved, isSaving, hasUnsavedChanges } = useAutoSave({
    delay: 30000,
    debounceChanges: true,
    debounceDelay: 2000,
    enabled: canEdit && !isLoading,
    showToast: false,
    data: documentation,
    onSave: persist,
  });

  const updateDocumentation = useCallback((patch: Partial<EncounterDocumentation>) => {
    setDocumentation((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateHpi = useCallback((hpi: EncounterDocumentation['hpi']) => {
    setDocumentation((prev) => ({ ...prev, hpi }));
  }, []);

  const updateVitals = useCallback((vitals: EncounterDocumentation['vitals']) => {
    setDocumentation((prev) => ({ ...prev, vitals }));
  }, []);

  const updatePhysicalExam = useCallback((physicalExam: EncounterDocumentation['physicalExam']) => {
    setDocumentation((prev) => ({ ...prev, physicalExam }));
  }, []);

  const updateMedications = useCallback((medications: EncounterDocumentation['medications']) => {
    setDocumentation((prev) => ({ ...prev, medications }));
  }, []);

  return useMemo(
    () => ({
      documentation,
      isLoading,
      updateDocumentation,
      updateHpi,
      updateVitals,
      updatePhysicalExam,
      updateMedications,
      saveNow,
      lastSaved,
      isSaving,
      hasUnsavedChanges,
    }),
    [
      documentation,
      isLoading,
      updateDocumentation,
      updateHpi,
      updateVitals,
      updatePhysicalExam,
      updateMedications,
      saveNow,
      lastSaved,
      isSaving,
      hasUnsavedChanges,
    ],
  );
}
