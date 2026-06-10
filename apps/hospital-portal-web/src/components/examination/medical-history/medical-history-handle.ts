import type { DisplayAllergy } from '@/lib/medical-history/allergy-utils';
import type { Patient } from '@/lib/api/patients.api';

export interface MedicalHistorySnapshot {
  allergies: DisplayAllergy[];
  nkda: boolean;
  chronicConditions: unknown[];
  medications: unknown[];
  allergiesLegacy?: unknown[];
  surgeries: unknown[];
  familyHistory: unknown[];
  immunizations: unknown[];
  smokingStatus: string;
  smokingQuitDate?: string;
  smokingPackYears?: string;
  alcoholUse: string;
  exerciseHabits: string;
  dietType: string;
  lifestyleNotes: string;
  disabilityStatus: string;
  specialNeeds: string;
  disabilityFlags?: string[];
  medicalHistoryReviewedAt?: string;
}

export interface MedicalHistoryHandle {
  /** True after patient + allergies baseline is established (safe to evaluate dirty). */
  isHydrated: () => boolean;
  isDirty: () => boolean;
  save: () => Promise<Patient | null>;
  discard: () => void;
  getSnapshot: () => MedicalHistorySnapshot;
  getDisplayAllergies: () => DisplayAllergy[];
  hydrateFromSnapshot: (snapshot: MedicalHistorySnapshot) => void;
  /** Mark current form state as saved (e.g. after Save exam flushed MH bundle). */
  acknowledgePersisted: () => void;
}
