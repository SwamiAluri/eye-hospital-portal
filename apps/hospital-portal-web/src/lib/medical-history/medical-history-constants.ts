export const CHRONIC_CONDITIONS_LIST = [
  'Diabetes Type 1', 'Diabetes Type 2', 'Hypertension', 'Asthma', 'COPD',
  'Heart Disease', 'Coronary Artery Disease', 'Arthritis', 'Osteoarthritis', 'Rheumatoid Arthritis',
  'Thyroid Disorder', 'Hypothyroidism', 'Hyperthyroidism', 'Kidney Disease', 'Liver Disease',
  'Cancer', 'Epilepsy', 'Migraine', 'Depression', 'Anxiety Disorder', 'Bipolar Disorder',
  'Glaucoma', 'Cataracts', 'Macular Degeneration', 'Diabetic Retinopathy', 'Other',
] as const;

export const EYE_RELEVANT_CONDITIONS = new Set([
  'Glaucoma', 'Cataracts', 'Macular Degeneration', 'Diabetic Retinopathy',
]);

export const MEDICATIONS_LIST = [
  'Metformin', 'Lisinopril', 'Atorvastatin', 'Levothyroxine', 'Amlodipine',
  'Metoprolol', 'Omeprazole', 'Losartan', 'Gabapentin', 'Hydrochlorothiazide',
  'Aspirin', 'Ibuprofen', 'Acetaminophen', 'Insulin', 'Warfarin',
  'Prednisone', 'Albuterol', 'Simvastatin', 'Furosemide', 'Other',
] as const;

export const EYE_MEDICATION_ROUTES = new Set(['Eye Drops', 'Topical']);

export const SURGERIES_LIST = [
  'Appendectomy', 'Cholecystectomy', 'Hernia Repair', 'Cesarean Section', 'Hysterectomy',
  'Knee Replacement', 'Hip Replacement', 'Cataract Surgery', 'LASIK', 'Bypass Surgery',
  'Angioplasty', 'Tonsillectomy', 'Gallbladder Removal', 'Spinal Fusion', 'Vitrectomy', 'Other',
] as const;

export const EYE_SURGERIES = new Set(['Cataract Surgery', 'LASIK', 'Vitrectomy']);

export const FAMILY_CONDITIONS_LIST = [
  'Diabetes', 'Hypertension', 'Heart Disease', 'Stroke', 'Cancer',
  "Alzheimer's Disease", 'Glaucoma', 'Macular Degeneration', 'Asthma',
  'Kidney Disease', 'Mental Health Disorders', 'Other',
] as const;

export const IMMUNIZATIONS_LIST = [
  'COVID-19', 'Influenza', 'Tetanus', 'Hepatitis A', 'Hepatitis B',
  'MMR', 'Varicella', 'Pneumococcal', 'HPV', 'Shingles',
  'Meningococcal', 'Polio', 'Other',
] as const;

export const FAMILY_RELATIONSHIPS = [
  'Mother', 'Father', 'Sister', 'Brother',
  'Maternal Grandmother', 'Maternal Grandfather',
  'Paternal Grandmother', 'Paternal Grandfather', 'Aunt', 'Uncle', 'Other',
] as const;

export const SEVERITY_LEVELS = ['Mild', 'Moderate', 'Severe', 'Life-threatening'] as const;
export const CONDITION_STATUS = ['Active', 'Controlled', 'In Remission', 'Resolved'] as const;
export const MEDICATION_ROUTES = ['Oral', 'Injection', 'Topical', 'Inhalation', 'Eye Drops', 'Other'] as const;

export const SMOKING_SEGMENTS = [
  { value: 'Never', label: 'Never' },
  { value: 'Former', label: 'Former' },
  { value: 'Current - Light (<10/day)', label: 'Current (light)' },
  { value: 'Current - Moderate (10-20/day)', label: 'Current (moderate)' },
  { value: 'Current - Heavy (>20/day)', label: 'Current (heavy)' },
] as const;

export const ALCOHOL_SEGMENTS = [
  { value: 'None', label: 'None' },
  { value: 'Occasional (1-2 drinks/week)', label: 'Occasional' },
  { value: 'Moderate (3-7 drinks/week)', label: 'Moderate' },
  { value: 'Heavy (>7 drinks/week)', label: 'Heavy' },
] as const;

export const DISABILITY_CHECKBOXES = [
  { id: 'wheelchair', label: 'Wheelchair access' },
  { id: 'hearing', label: 'Hearing impaired' },
  { id: 'visual', label: 'Visual impairment' },
  { id: 'interpreter', label: 'Interpreter needed' },
] as const;

export type MedicalHistorySectionId =
  | 'allergies'
  | 'conditions'
  | 'medications'
  | 'surgeries'
  | 'family'
  | 'lifestyle'
  | 'immunizations'
  | 'disability';

export const MEDICAL_HISTORY_SECTIONS: {
  id: MedicalHistorySectionId;
  label: string;
  group: 'clinical' | 'surgical' | 'social' | 'admin';
}[] = [
  { id: 'allergies', label: 'Allergies', group: 'clinical' },
  { id: 'conditions', label: 'Conditions', group: 'clinical' },
  { id: 'medications', label: 'Medications', group: 'clinical' },
  { id: 'surgeries', label: 'Surgeries', group: 'surgical' },
  { id: 'family', label: 'Family history', group: 'social' },
  { id: 'lifestyle', label: 'Lifestyle', group: 'social' },
  { id: 'immunizations', label: 'Immunizations', group: 'admin' },
  { id: 'disability', label: 'Disability & needs', group: 'admin' },
];

export type ChronicCondition = {
  id: string;
  name: string;
  diagnosedYear?: string;
  severity?: string;
  status?: string;
  notes?: string;
};

export type Medication = {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  startDate?: string;
  route?: string;
  notes?: string;
};

export type Surgery = {
  id: string;
  name: string;
  date?: string;
  outcome?: string;
  notes?: string;
};

export type FamilyCondition = {
  id: string;
  condition: string;
  relationship?: string;
  ageOfOnset?: string;
  notes?: string;
};

export type Immunization = {
  id: string;
  vaccine: string;
  date?: string;
  doseNumber?: string;
  notes?: string;
};
