'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useBranchContext } from '@/hooks/use-branch-context';
import { usePatientRecentVisitsQuery, usePatientSummaryQuery } from '@/hooks/use-patient-lookup-queries';

type PatientRecordContextValue = {
  patientId: string;
  branchId: string | null;
  summary: ReturnType<typeof usePatientSummaryQuery>['data'] | undefined;
  recentVisits: ReturnType<typeof usePatientRecentVisitsQuery>['data'] | undefined;
  summaryQuery: ReturnType<typeof usePatientSummaryQuery>;
  recentVisitsQuery: ReturnType<typeof usePatientRecentVisitsQuery>;
};

const PatientRecordContext = createContext<PatientRecordContextValue | null>(null);

export function PatientRecordProvider({
  patientId,
  children,
}: {
  patientId: string;
  children: React.ReactNode;
}) {
  const { branchId, isReady } = useBranchContext();

  const summaryQuery = usePatientSummaryQuery(isReady ? patientId : null, isReady ? branchId : null);
  const recentVisitsQuery = usePatientRecentVisitsQuery(isReady ? patientId : null, isReady ? branchId : null);

  const value = useMemo<PatientRecordContextValue>(
    () => ({
      patientId,
      branchId,
      summary: summaryQuery.data,
      recentVisits: recentVisitsQuery.data,
      summaryQuery,
      recentVisitsQuery,
    }),
    [patientId, branchId, summaryQuery, recentVisitsQuery],
  );

  return <PatientRecordContext.Provider value={value}>{children}</PatientRecordContext.Provider>;
}

export function usePatientRecord() {
  const ctx = useContext(PatientRecordContext);
  if (!ctx) throw new Error('usePatientRecord must be used within PatientRecordProvider');
  return ctx;
}

