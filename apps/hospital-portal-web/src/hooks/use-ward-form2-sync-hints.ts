'use client';

import { useCallback, useEffect, useState } from 'react';
import { ipManagementApi } from '@/lib/api/ip-management.api';
import { isDilatationMedicine } from '@/lib/ip-checklist/dilatation-meds';
import type { OutpatientIntegrationHint } from '@/lib/ip-checklist/outpatient-integration';

export interface WardForm2SyncContext {
  journeyId: string;
  itemKeys: string[];
}

export function useWardForm2SyncHints({ journeyId, itemKeys }: WardForm2SyncContext) {
  const [hints, setHints] = useState<OutpatientIntegrationHint[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!journeyId || itemKeys.length === 0) {
      setHints([]);
      return;
    }

    setLoading(true);
    try {
      const [investigations, vitals, medLog, pac] = await Promise.all([
        ipManagementApi.getWardInvestigationChecklist(journeyId).catch(() => null),
        ipManagementApi.getVitals(journeyId).catch(() => []),
        ipManagementApi.getMedicationLog(journeyId).catch(() => null),
        ipManagementApi.getPacAssessment(journeyId).catch(() => null),
      ]);

      const next: OutpatientIntegrationHint[] = [];
      const keys = new Set(itemKeys);

      if (keys.has('investigation_reports_available') && investigations) {
        const applicable = investigations.items.filter(i => i.appliesToJourney);
        const ready = applicable.length > 0 && applicable.every(i =>
          i.isBypassed
          || (i.resultValue
            && (!i.isCritical || i.entryStatus === 'verified')));
        if (ready) {
          next.push({
            itemKey: 'investigation_reports_available',
            source: 'lab',
            suggestedComplete: true,
            label: '§1 investigations complete',
          });
        } else if (applicable.some(i => i.resultValue)) {
          next.push({
            itemKey: 'investigation_reports_available',
            source: 'lab',
            suggestedComplete: false,
            label: '§1 investigations in progress',
          });
        }
      }

      if (keys.has('ward_ascan_confirmed') && investigations) {
        const ascan = investigations.items.find(i =>
          i.itemKey === 'ascan_done' && i.appliesToJourney);
        if (ascan?.entryStatus === 'verified' || ascan?.isBypassed) {
          next.push({
            itemKey: 'ward_ascan_confirmed',
            source: 'optometry',
            suggestedComplete: true,
            label: 'A-Scan verified in §1',
          });
        }
      }

      if (keys.has('vitals_checked') && vitals.length > 0) {
        next.push({
          itemKey: 'vitals_checked',
          source: 'lab',
          suggestedComplete: true,
          label: 'Vitals recorded',
        });
      }

      if (keys.has('pac_done_documented') && pac?.assessmentStatus === 'Completed') {
        next.push({
          itemKey: 'pac_done_documented',
          source: 'lab',
          suggestedComplete: true,
          label: 'PAC completed',
        });
      }

      if (keys.has('ward_dilatation_done') && medLog) {
        const dilatationGiven = medLog.drugs.some(drug =>
          isDilatationMedicine(drug.medicineName)
          && drug.doses.some(d => d.administeredAt));
        if (dilatationGiven) {
          next.push({
            itemKey: 'ward_dilatation_done',
            source: 'lab',
            suggestedComplete: true,
            label: 'Dilatation dose in med log — confirm',
            detail: 'Clinical confirmation still required on Form 2',
          });
        }
      }

      if (keys.has('preop_medication_given') && medLog) {
        const anyDose = medLog.drugs.some(d => d.doses.some(x => x.administeredAt));
        if (anyDose) {
          next.push({
            itemKey: 'preop_medication_given',
            source: 'lab',
            suggestedComplete: true,
            label: 'Med log has administered doses',
          });
        }
      }

      setHints(next);
    } finally {
      setLoading(false);
    }
  }, [journeyId, itemKeys.join(',')]);

  useEffect(() => {
    load();
  }, [load]);

  return { hints, loading, reload: load };
}
