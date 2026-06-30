'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  readWorkspacePatients,
  removeWorkspacePatient,
  touchWorkspacePatient,
  type WorkspacePatientTab,
} from '@/lib/patients/patient-workspace';

type PatientWorkspaceContextValue = {
  tabs: WorkspacePatientTab[];
  touchPatient: (patient: Omit<WorkspacePatientTab, 'accessedAt'>) => void;
  closePatient: (patientId: string) => void;
  refresh: () => void;
};

const PatientWorkspaceContext = createContext<PatientWorkspaceContextValue | null>(null);

export function PatientWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<WorkspacePatientTab[]>([]);

  const refresh = useCallback(() => {
    setTabs(readWorkspacePatients());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const touchPatient = useCallback(
    (patient: Omit<WorkspacePatientTab, 'accessedAt'>) => {
      setTabs(touchWorkspacePatient(patient));
    },
    [],
  );

  const closePatient = useCallback((patientId: string) => {
    setTabs(removeWorkspacePatient(patientId));
  }, []);

  const value = useMemo(
    () => ({ tabs, touchPatient, closePatient, refresh }),
    [tabs, touchPatient, closePatient, refresh],
  );

  return (
    <PatientWorkspaceContext.Provider value={value}>{children}</PatientWorkspaceContext.Provider>
  );
}

export function usePatientWorkspace() {
  const ctx = useContext(PatientWorkspaceContext);
  if (!ctx) throw new Error('usePatientWorkspace must be used within PatientWorkspaceProvider');
  return ctx;
}

export function useOptionalPatientWorkspace() {
  return useContext(PatientWorkspaceContext);
}
