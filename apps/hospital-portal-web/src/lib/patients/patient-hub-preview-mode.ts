export const PATIENT_HUB_PREVIEW_MODE_KEY = 'patient-hub-preview-mode';

export type PatientHubPreviewMode = 'docked' | 'floating';

export const PATIENT_HUB_DOCK_MIN_WIDTH_PX = 1280;

export function isPatientHubDockViewport(width: number): boolean {
  return width >= PATIENT_HUB_DOCK_MIN_WIDTH_PX;
}

export function readStoredPreviewMode(): PatientHubPreviewMode {
  if (typeof window === 'undefined') return 'docked';
  try {
    const raw = window.localStorage.getItem(PATIENT_HUB_PREVIEW_MODE_KEY);
    return raw === 'floating' ? 'floating' : 'docked';
  } catch {
    return 'docked';
  }
}

export function writeStoredPreviewMode(mode: PatientHubPreviewMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PATIENT_HUB_PREVIEW_MODE_KEY, mode);
  } catch {
    // ignore quota / private mode
  }
}

export function resolveEffectivePreviewMode(
  mode: PatientHubPreviewMode,
  viewportWidth: number,
): PatientHubPreviewMode {
  if (!isPatientHubDockViewport(viewportWidth)) return 'floating';
  return mode;
}
