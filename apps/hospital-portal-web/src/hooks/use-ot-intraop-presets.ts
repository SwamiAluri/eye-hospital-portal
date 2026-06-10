'use client';

import { useMemo } from 'react';
import { useMasterListOptions } from '@/hooks/use-master-list-options';

export const OT_FIELD_ENTITIES = {
  procedure: 'clinical.surgical_procedure',
  findings: 'clinical.intraop_finding',
  complications: 'clinical.complication',
  anesthesia_notes: 'clinical.anesthesia_technique',
} as const;

export type OtPresetField = keyof typeof OT_FIELD_ENTITIES;

/** B5 — merge master clinical presets with legacy FALLBACK_PRESETS. */
export function useOtIntraOpPresets(fallback: Record<string, string[]>) {
  const procedure = useMasterListOptions(OT_FIELD_ENTITIES.procedure, fallback.procedure ?? []);
  const findings = useMasterListOptions(OT_FIELD_ENTITIES.findings, fallback.findings ?? []);
  const complications = useMasterListOptions(OT_FIELD_ENTITIES.complications, fallback.complications ?? []);
  const anesthesia = useMasterListOptions(OT_FIELD_ENTITIES.anesthesia_notes, fallback.anesthesia_notes ?? []);

  const presets = useMemo(
    () => ({
      procedure: procedure.labels,
      findings: findings.labels,
      complications: complications.labels,
      anesthesia_notes: anesthesia.labels,
    }),
    [procedure.labels, findings.labels, complications.labels, anesthesia.labels],
  );

  const loading = procedure.loading || findings.loading || complications.loading || anesthesia.loading;

  return { presets, loading };
}

/** Merge master + fallback + journey-specific API presets (OT page). */
export function buildOtPresetMap(
  fallback: Record<string, string[]>,
  masterPresets: Record<string, string[]>,
  apiPresets?: { fieldName: string; optionLabel: string }[],
): Record<string, string[]> {
  const pMap: Record<string, string[]> = {};
  for (const key of Object.keys(fallback)) {
    const merged = [...(masterPresets[key] ?? [])];
    const seen = new Set(merged);
    for (const x of fallback[key]) {
      if (!seen.has(x)) {
        merged.push(x);
        seen.add(x);
      }
    }
    pMap[key] = merged;
  }
  if (apiPresets) {
    for (const p of apiPresets) {
      if (!pMap[p.fieldName]) pMap[p.fieldName] = [];
      if (!pMap[p.fieldName].includes(p.optionLabel)) pMap[p.fieldName].push(p.optionLabel);
    }
  }
  return pMap;
}
