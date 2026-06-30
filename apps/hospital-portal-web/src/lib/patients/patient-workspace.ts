export type WorkspacePatientTab = {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  accessedAt: number;
};

const STORAGE_KEY = 'patient_workspace_tabs';
const MAX_TABS = 8;

function readRaw(): WorkspacePatientTab[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkspacePatientTab[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(tabs: WorkspacePatientTab[]): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
}

export function readWorkspacePatients(): WorkspacePatientTab[] {
  return readRaw().sort((a, b) => b.accessedAt - a.accessedAt);
}

export function touchWorkspacePatient(patient: Omit<WorkspacePatientTab, 'accessedAt'>): WorkspacePatientTab[] {
  const now = Date.now();
  const without = readRaw().filter((p) => p.id !== patient.id);
  const next: WorkspacePatientTab[] = [
    { ...patient, accessedAt: now },
    ...without,
  ].slice(0, MAX_TABS);
  writeRaw(next);
  return next;
}

export function removeWorkspacePatient(patientId: string): WorkspacePatientTab[] {
  const next = readRaw().filter((p) => p.id !== patientId);
  writeRaw(next);
  return next;
}
