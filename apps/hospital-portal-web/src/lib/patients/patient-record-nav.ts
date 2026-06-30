const STORAGE_KEY = 'patient_hub_record_nav';
const MAX_AGE_MS = 30 * 60_000;

export type PatientRecordNavState = {
  patientIds: string[];
  currentIndex: number;
  savedAt: number;
};

export function savePatientRecordNav(patientIds: string[], currentPatientId: string): void {
  if (typeof window === 'undefined' || patientIds.length === 0) return;
  const currentIndex = patientIds.indexOf(currentPatientId);
  const state: PatientRecordNavState = {
    patientIds,
    currentIndex: currentIndex >= 0 ? currentIndex : 0,
    savedAt: Date.now(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function readPatientRecordNav(currentPatientId: string): {
  prevId: string | null;
  nextId: string | null;
  positionLabel: string | null;
} {
  if (typeof window === 'undefined') {
    return { prevId: null, nextId: null, positionLabel: null };
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { prevId: null, nextId: null, positionLabel: null };

    const state = JSON.parse(raw) as PatientRecordNavState;
    if (Date.now() - state.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return { prevId: null, nextId: null, positionLabel: null };
    }

    const index = state.patientIds.indexOf(currentPatientId);
    if (index < 0) {
      return { prevId: null, nextId: null, positionLabel: null };
    }

    return {
      prevId: index > 0 ? state.patientIds[index - 1]! : null,
      nextId: index < state.patientIds.length - 1 ? state.patientIds[index + 1]! : null,
      positionLabel: `${index + 1} of ${state.patientIds.length}`,
    };
  } catch {
    return { prevId: null, nextId: null, positionLabel: null };
  }
}
