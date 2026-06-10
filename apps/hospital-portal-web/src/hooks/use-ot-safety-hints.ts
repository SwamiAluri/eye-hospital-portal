'use client';

import { useCallback, useEffect, useState } from 'react';
import biometryApi from '@/lib/api/biometry.api';
import { patientConsentsApi } from '@/lib/api/patient-consents.api';
import { ipManagementApi } from '@/lib/api/ip-management.api';
import {
  buildOtSafetyHints,
  type OtSafetyIntegrationHint,
} from '@/lib/ip-checklist/ward-integration';

const TOPICAL_ANTIBIOTIC_KEYWORDS = [
  'moxifloxacin', 'gatifloxacin', 'ofloxacin', 'ciprofloxacin',
  'topical', 'antibiotic', 'prednisolone', 'tobramycin',
];

function hasTopicalAntibiotics(medicineNames: string[]): boolean {
  const joined = medicineNames.join(' ').toLowerCase();
  return TOPICAL_ANTIBIOTIC_KEYWORDS.some(k => joined.includes(k));
}

export function useOtSafetyHints(ctx: {
  journeyId: string;
  patientId?: string;
  patientName?: string;
  eyeOperated?: string;
  financialState?: string;
  balanceDue?: number;
  emergencyFcApplied?: boolean;
}) {
  const [hints, setHints] = useState<OtSafetyIntegrationHint[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [biometry, consentsRes, medLog] = await Promise.all([
        ctx.patientId
          ? biometryApi.getByPatient(ctx.patientId).catch(() => [])
          : Promise.resolve([]),
        ctx.patientId
          ? patientConsentsApi.getByPatient(ctx.patientId).then(r => r.data ?? []).catch(() => [])
          : Promise.resolve([]),
        ipManagementApi.getMedicationLog(ctx.journeyId).catch(() => null),
      ]);

      const hasBiometry = Array.isArray(biometry) && biometry.some(b => b.axialLength > 0);
      const hasConsent = consentsRes.some(c =>
        c.isGranted && c.status === 'active'
        && /surgery|surgical|procedure|consent/i.test(`${c.consentType} ${c.consentName}`));
      const drugNames = medLog?.drugs?.map(d => d.medicineName ?? '') ?? [];
      const hasTopical = hasTopicalAntibiotics(drugNames);
      const allergyNote = medLog?.xylocaineSensitivityResult?.trim();

      setHints(buildOtSafetyHints({
        patientName: ctx.patientName,
        eyeOperated: ctx.eyeOperated,
        allergies: allergyNote || undefined,
        hasConsent,
        hasBiometry,
        hasTopicalAntibiotics: hasTopical,
        financialState: ctx.financialState,
        balanceDue: ctx.balanceDue,
        emergencyFcApplied: ctx.emergencyFcApplied,
      }));
    } finally {
      setLoading(false);
    }
  }, [
    ctx.journeyId, ctx.patientId, ctx.patientName, ctx.eyeOperated,
    ctx.financialState, ctx.balanceDue, ctx.emergencyFcApplied,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  return { hints, loading, reload: load };
}
