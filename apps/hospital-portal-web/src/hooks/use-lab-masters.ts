'use client';

import { useMemo } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';

const FALLBACK_SPECIMEN_TYPES = ['Blood', 'Urine', 'Tissue Biopsy', 'Aqueous Fluid', 'Conjunctival Swab', 'Tear Sample'];

const FALLBACK_IMAGING_MODALITIES = ['OCT', 'Fundus Camera', 'Fluorescein Angiography', 'B-Scan Ultrasound'];

const FALLBACK_EP_TYPES = [
  { value: 'ERG', label: 'Electroretinography (ERG)' },
  { value: 'VEP', label: 'Visual Evoked Potential (VEP)' },
  { value: 'EOG', label: 'Electro-oculography (EOG)' },
] as const;

/** B6 — lab specimen types from lab.specimen_type */
export function useSpecimenTypes() {
  const { options, loading, error } = useMasterValues('lab.specimen_type');
  const labels = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_SPECIMEN_TYPES];
    return options.map((o) => o.label);
  }, [options]);
  return { labels, options, loading, error };
}

/** B6 — imaging modalities from lab.imaging_modality */
export function useImagingModalities() {
  const { options, loading, error } = useMasterValues('lab.imaging_modality');
  const choices = useMemo(() => {
    if (options.length === 0) {
      return FALLBACK_IMAGING_MODALITIES.map((label) => ({ value: label, label }));
    }
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);
  return { choices, options, loading, error };
}

/** B6 — electrophysiology test types from lab.ep_type */
export function useEpTypes() {
  const { options, loading, error } = useMasterValues('lab.ep_type');
  const types = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_EP_TYPES];
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);
  return { types, options, loading, error };
}
