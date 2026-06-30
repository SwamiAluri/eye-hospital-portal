import type { PatientRecentViewEntry } from '@/types/patient-lookup';

const STORAGE_KEY = 'hp-recent-patients-v1';
const MAX_ENTRIES = 20;

function readAll(): PatientRecentViewEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PatientRecentViewEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: PatientRecentViewEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function readRecentPatientsLocal(limit = 6): PatientRecentViewEntry[] {
  return readAll()
    .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
    .slice(0, limit);
}

export function recordRecentPatientLocal(entry: Omit<PatientRecentViewEntry, 'viewedAt'>) {
  const viewedAt = new Date().toISOString();
  const next: PatientRecentViewEntry = { ...entry, viewedAt };
  const without = readAll().filter((e) => e.patientId !== entry.patientId);
  writeAll([next, ...without]);
}
