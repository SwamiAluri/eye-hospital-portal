'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { UpdateCoverageCaseRequest } from '@/lib/api/ccms/ccms-coverage-cases.api';

interface DraftPayload {
  form: UpdateCoverageCaseRequest;
  savedAt: string;
}

/**
 * Persists coverage draft to localStorage when the CCMS case is editable.
 */
export function useCoverageDraftStorage(
  caseId: string | undefined,
  form: UpdateCoverageCaseRequest,
  allowLocalDraft: boolean,
) {
  const hydrated = useRef(false);
  const draftKey = caseId ? `coverage-draft-${caseId}` : null;

  const restoreDraft = useCallback((): UpdateCoverageCaseRequest | null => {
    if (!draftKey || !allowLocalDraft) return null;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftPayload;
      return parsed.form ?? null;
    } catch {
      return null;
    }
  }, [allowLocalDraft, draftKey]);

  const clearDraft = useCallback(() => {
    if (!draftKey || !allowLocalDraft) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [allowLocalDraft, draftKey]);

  useEffect(() => {
    if (!draftKey || !allowLocalDraft || !hydrated.current) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ form, savedAt: new Date().toISOString() } satisfies DraftPayload),
      );
    } catch {
      /* quota */
    }
  }, [allowLocalDraft, draftKey, form]);

  useEffect(() => {
    hydrated.current = true;
  }, []);

  return { restoreDraft, clearDraft };
}
