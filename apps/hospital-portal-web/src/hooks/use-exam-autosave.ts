'use client';

import { useEffect, useRef } from 'react';
import { persistExamDraft } from '@/lib/optometry/optometry-exam-draft';
import type { OptometryExamDraftData } from '@/lib/optometry/optometry-exam-types';

const AUTOSAVE_MS = 45_000;

/**
 * Debounced autosave of visit draft to localStorage + ExaminationDraft API.
 */
export function useExamAutosave(
  enabled: boolean,
  patientId: string,
  visitId: string,
  doctorId: string | undefined,
  hasUnsavedChanges: boolean,
  buildPayload: () => OptometryExamDraftData,
  onAutosaved?: () => void,
) {
  const buildRef = useRef(buildPayload);
  buildRef.current = buildPayload;

  useEffect(() => {
    if (!enabled || !patientId || !visitId || !doctorId || !hasUnsavedChanges) return;

    const timer = setInterval(async () => {
      try {
        const payload = buildRef.current();
        payload.visitId = visitId;
        payload.patientId = patientId;
        payload.version = 1;
        await persistExamDraft(patientId, doctorId, payload);
        onAutosaved?.();
      } catch {
        /* silent — user can still Save exam manually */
      }
    }, AUTOSAVE_MS);

    return () => clearInterval(timer);
  }, [enabled, patientId, visitId, doctorId, hasUnsavedChanges, onAutosaved]);
}
