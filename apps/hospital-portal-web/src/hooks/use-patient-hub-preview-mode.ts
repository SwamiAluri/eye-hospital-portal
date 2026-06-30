'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  isPatientHubDockViewport,
  readStoredPreviewMode,
  resolveEffectivePreviewMode,
  writeStoredPreviewMode,
  type PatientHubPreviewMode,
} from '@/lib/patients/patient-hub-preview-mode';

export function usePatientHubPreviewMode() {
  const [mode, setModeState] = useState<PatientHubPreviewMode>('docked');
  const [canDock, setCanDock] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : PATIENT_HUB_DOCK_FALLBACK_WIDTH,
  );

  useEffect(() => {
    setModeState(readStoredPreviewMode());
  }, []);

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      setViewportWidth(width);
      setCanDock(isPatientHubDockViewport(width));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const setMode = useCallback((next: PatientHubPreviewMode) => {
    setModeState(next);
    writeStoredPreviewMode(next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const next: PatientHubPreviewMode = current === 'docked' ? 'floating' : 'docked';
      writeStoredPreviewMode(next);
      return next;
    });
  }, []);

  const effectiveMode = resolveEffectivePreviewMode(mode, viewportWidth);

  return {
    mode,
    setMode,
    toggleMode,
    canDock,
    effectiveMode,
    isDocked: effectiveMode === 'docked',
    isFloating: effectiveMode === 'floating',
  };
}

const PATIENT_HUB_DOCK_FALLBACK_WIDTH = 1440;
