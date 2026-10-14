/** Controlled zoom steps for Patient 360 image document preview. */
export const PATIENT_360_DOCUMENT_ZOOM_STEPS = [50, 75, 100, 125, 150, 200] as const;

export type Patient360DocumentZoomPercent = (typeof PATIENT_360_DOCUMENT_ZOOM_STEPS)[number];

export const PATIENT_360_DOCUMENT_FIT_ZOOM: Patient360DocumentZoomPercent = 100;

export function nearestPatient360DocumentZoom(value: number): Patient360DocumentZoomPercent {
  let best: Patient360DocumentZoomPercent = PATIENT_360_DOCUMENT_FIT_ZOOM;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const step of PATIENT_360_DOCUMENT_ZOOM_STEPS) {
    const delta = Math.abs(step - value);
    if (delta < bestDelta) {
      best = step;
      bestDelta = delta;
    }
  }
  return best;
}

export function nextPatient360DocumentZoomIn(current: number): Patient360DocumentZoomPercent {
  const nearest = nearestPatient360DocumentZoom(current);
  const index = PATIENT_360_DOCUMENT_ZOOM_STEPS.indexOf(nearest);
  return PATIENT_360_DOCUMENT_ZOOM_STEPS[Math.min(index + 1, PATIENT_360_DOCUMENT_ZOOM_STEPS.length - 1)]!;
}

export function nextPatient360DocumentZoomOut(current: number): Patient360DocumentZoomPercent {
  const nearest = nearestPatient360DocumentZoom(current);
  const index = PATIENT_360_DOCUMENT_ZOOM_STEPS.indexOf(nearest);
  return PATIENT_360_DOCUMENT_ZOOM_STEPS[Math.max(index - 1, 0)]!;
}

export function isPatient360DocumentZoomed(zoom: number): boolean {
  return nearestPatient360DocumentZoom(zoom) > PATIENT_360_DOCUMENT_FIT_ZOOM;
}

export function patient360DocumentZoomLabel(zoom: number): string {
  return `${nearestPatient360DocumentZoom(zoom)}%`;
}
