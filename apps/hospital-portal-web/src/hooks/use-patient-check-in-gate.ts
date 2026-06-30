'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { checkInApi } from '@/lib/check-in-api';
import {
  canEmergencyOverride,
  isCheckInGatedTab,
} from '@/lib/patients/patient-record-gate';
import type { PatientRecordTabKey } from '@/lib/patients/patient-record-tabs';

export function usePatientCheckInGate(
  patientId: string | null | undefined,
  assignedVisitId?: string | null,
) {
  const roles = useAuthStore((s) => s.roles);
  const [statusCheckedIn, setStatusCheckedIn] = useState(false);
  const [overrideGranted, setOverrideGranted] = useState<Set<PatientRecordTabKey>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    checkInApi
      .getStatus(patientId)
      .then((status) => {
        if (!cancelled) setStatusCheckedIn(status.isCheckedIn);
      })
      .catch(() => {
        if (!cancelled) setStatusCheckedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const isCheckedIn = Boolean(assignedVisitId) || statusCheckedIn;
  const canOverride = canEmergencyOverride(roles);

  const isTabAccessible = useCallback(
    (tab: PatientRecordTabKey) => {
      if (!isCheckInGatedTab(tab)) return true;
      if (isCheckedIn) return true;
      return overrideGranted.has(tab);
    },
    [isCheckedIn, overrideGranted],
  );

  const grantOverride = useCallback((tab: PatientRecordTabKey) => {
    setOverrideGranted((prev) => new Set(prev).add(tab));
  }, []);

  return useMemo(
    () => ({
      isCheckedIn,
      canOverride,
      isTabAccessible,
      grantOverride,
    }),
    [isCheckedIn, canOverride, isTabAccessible, grantOverride],
  );
}
