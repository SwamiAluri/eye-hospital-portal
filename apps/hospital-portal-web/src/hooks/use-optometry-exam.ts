'use client';



import { useCallback, useState } from 'react';

import { useAuthStore } from '@/lib/auth-store';

import { fetchPriorVisitSnapshot } from '@/lib/optometry/optometry-prior-visit';

import { fetchRemoteExamDraft, persistExamDraft } from '@/lib/optometry/optometry-exam-draft';

import type {

  OptometryExamDraftData,

  OptometryExamTabId,

  PriorVisitSnapshot,

  TabSaveStatus,

} from '@/lib/optometry/optometry-exam-types';



export function useOptometryExam(patientId: string, visitId: string) {

  const { user } = useAuthStore();

  const [priorVisit, setPriorVisit] = useState<PriorVisitSnapshot | null>(null);

  const [priorLoading, setPriorLoading] = useState(false);

  const [tabStatus, setTabStatus] = useState<Partial<Record<OptometryExamTabId, TabSaveStatus>>>({});

  const [isSaving, setIsSaving] = useState(false);

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [draftLoaded, setDraftLoaded] = useState(false);



  const hydratePriorVisit = useCallback((snapshot: PriorVisitSnapshot | null) => {

    setPriorVisit(snapshot);

    setPriorLoading(false);

  }, []);



  const reloadPriorVisit = useCallback(async () => {

    if (!patientId) return;

    setPriorLoading(true);

    try {

      const snapshot = await fetchPriorVisitSnapshot(patientId, visitId || undefined);

      setPriorVisit(snapshot);

    } finally {

      setPriorLoading(false);

    }

  }, [patientId, visitId]);



  const markTabDirty = useCallback((tabId: OptometryExamTabId) => {

    setHasUnsavedChanges(true);

    setTabStatus((prev) => {

      if (prev[tabId] === 'dirty') return prev;

      return { ...prev, [tabId]: 'dirty' };

    });

  }, []);



  const markTabSaved = useCallback((tabId: OptometryExamTabId) => {

    setTabStatus((prev) => {

      if (prev[tabId] === 'saved') return prev;

      return { ...prev, [tabId]: 'saved' };

    });

  }, []);



  const loadDraft = useCallback(async (): Promise<OptometryExamDraftData | null> => {

    if (!patientId || !visitId) return null;

    const draft = await fetchRemoteExamDraft(patientId, visitId);

    setDraftLoaded(true);

    if (draft?.savedAt) {

      setLastSavedAt(new Date(draft.savedAt));

    }

    if (draft?.tabStatus) {

      setTabStatus(draft.tabStatus);

    }

    return draft;

  }, [patientId, visitId]);



  const saveExam = useCallback(

    async (buildPayload: () => OptometryExamDraftData) => {

      if (!patientId || !visitId) {

        throw new Error('Patient and visit are required');

      }

      if (!user?.id) {

        throw new Error('You must be signed in to save');

      }



      setIsSaving(true);

      try {

        const payload = buildPayload();

        payload.visitId = visitId;

        payload.patientId = patientId;

        payload.version = 1;

        payload.tabStatus = tabStatus;



        await persistExamDraft(patientId, user.id, payload);

        setLastSavedAt(new Date());

        setHasUnsavedChanges(false);

        setTabStatus((prev) => {

          const next = { ...prev };

          (Object.keys(next) as OptometryExamTabId[]).forEach((k) => {

            if (next[k] === 'dirty') next[k] = 'saved';

          });

          return next;

        });

      } finally {

        setIsSaving(false);

      }

    },

    [patientId, visitId, user?.id, tabStatus],

  );



  return {

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

    loadDraft,

    draftLoaded,

    reloadPriorVisit,

    hydratePriorVisit,

  };

}


