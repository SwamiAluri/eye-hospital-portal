import type {
  IopBundle,
  MedicalHistoryBundle,
  VisualAcuityBundle,
} from './optometry-history.types';

/** UI-only keys stored in draft / in-memory extended state — not persisted to visit segments. */
export const VA_SEGMENT_UI_ONLY_KEYS = ['sectionDirty', 'sectionViewMode'] as const;
export const IOP_SEGMENT_UI_ONLY_KEYS = ['sectionDirty', 'sectionViewMode'] as const;

function stripKeys(raw: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out = { ...raw };
  for (const key of keys) {
    delete out[key];
  }
  return out;
}

/** Visit-segment payload for visual_acuity_bundle (version 1, no UI-only fields). */
export function sanitizeVisualAcuityBundle(raw: unknown): VisualAcuityBundle {
  if (raw == null || typeof raw !== 'object') {
    return { version: 1 };
  }
  const cleaned = stripKeys(raw as Record<string, unknown>, [...VA_SEGMENT_UI_ONLY_KEYS]);
  return { version: 1, ...cleaned } as VisualAcuityBundle;
}

/** Visit-segment payload for iop_bundle (version 1, no UI-only fields). */
export function sanitizeIopBundle(raw: unknown): IopBundle {
  if (raw == null || typeof raw !== 'object') {
    return { version: 1 };
  }
  const cleaned = stripKeys(raw as Record<string, unknown>, [...IOP_SEGMENT_UI_ONLY_KEYS]);
  return { version: 1, ...cleaned } as IopBundle;
}

/** Visit-segment payload for medical_history_bundle. */
export function sanitizeMedicalHistoryBundle(raw: unknown): MedicalHistoryBundle {
  if (raw == null || typeof raw !== 'object') {
    return { version: 1 } as MedicalHistoryBundle;
  }
  const record = raw as Record<string, unknown>;
  const { version: _v, ...rest } = record;
  return { version: 1, ...rest } as MedicalHistoryBundle;
}
