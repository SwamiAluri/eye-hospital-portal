export interface EncounterHpiState {
  selectedPills: Record<string, string[]>;
  freeText: string;
}

export interface EncounterVitalsState {
  heartRate?: number | null;
  temperature?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  oxygenSaturation?: number | null;
  iopOd?: number | null;
  iopOs?: number | null;
  visualAcuityOd?: string;
  visualAcuityOs?: string;
  notes?: string;
}

export interface EncounterPhysicalExamState {
  notes: string;
  templateId?: string | null;
}

export interface EncounterMedicationQuickAdd {
  name: string;
  dosage?: string;
  frequency?: string;
  source?: string;
}

export interface EncounterMedicationsState {
  quickAdds: EncounterMedicationQuickAdd[];
  notes?: string;
}

export interface EncounterDocumentation {
  hpi: EncounterHpiState;
  vitals: EncounterVitalsState;
  physicalExam: EncounterPhysicalExamState;
  medications: EncounterMedicationsState;
}

export const EMPTY_ENCOUNTER_DOCUMENTATION: EncounterDocumentation = {
  hpi: { selectedPills: {}, freeText: '' },
  vitals: {},
  physicalExam: { notes: '', templateId: null },
  medications: { quickAdds: [], notes: '' },
};

export const PHYSICAL_EXAM_TEMPLATES = [
  {
    id: 'normal-ophthalmic',
    label: 'Normal ophthalmic exam',
    text: 'Eyes: Lids and adnexa normal. Conjunctiva quiet. Cornea clear. AC deep and quiet. Iris normal. Lens clear. Fundus: disc pink, C/D within normal limits, macula flat, vessels normal, periphery intact.',
  },
  {
    id: 'cataract',
    label: 'Cataract evaluation',
    text: 'Lens: nuclear/cortical/posterior subcapsular changes noted. Fundus view limited. IOP within acceptable range. No acute anterior segment inflammation.',
  },
  {
    id: 'glaucoma',
    label: 'Glaucoma assessment',
    text: 'IOP elevated on review. Optic disc shows increased cupping. RNFL defect suspected. Gonioscopy recommended. Visual field correlation advised.',
  },
  {
    id: 'red-eye',
    label: 'Red eye',
    text: 'Conjunctival injection present. Discharge noted. Cornea clear without epithelial defect. AC quiet. No hypopyon. Pupils equal and reactive.',
  },
] as const;

export function isEncounterDocumentation(value: unknown): value is EncounterDocumentation {
  if (!value || typeof value !== 'object') return false;
  const doc = value as EncounterDocumentation;
  return Boolean(doc.hpi && doc.vitals && doc.physicalExam && doc.medications);
}

export function encounterSectionCompletion(doc: EncounterDocumentation): {
  completed: number;
  total: number;
} {
  let completed = 0;
  const total = 4;

  const hpiDone =
    doc.hpi.freeText.trim().length > 0 ||
    Object.values(doc.hpi.selectedPills).some((pills) => pills.length > 0);
  if (hpiDone) completed++;

  const vitalsDone =
    doc.vitals.heartRate != null ||
    doc.vitals.temperature != null ||
    doc.vitals.bpSystolic != null ||
    doc.vitals.iopOd != null ||
    doc.vitals.iopOs != null ||
    Boolean(doc.vitals.visualAcuityOd || doc.vitals.visualAcuityOs);
  if (vitalsDone) completed++;

  if (doc.physicalExam.notes.trim().length > 0) completed++;
  if (doc.medications.quickAdds.length > 0 || (doc.medications.notes?.trim().length ?? 0) > 0) {
    completed++;
  }

  return { completed, total };
}
