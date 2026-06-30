/** data-testid conventions for Patient Encounter E2E */
export const patientEncounterTestIds = {
  page: 'patient-encounter-page',
  hpiSection: 'patient-encounter-hpi',
  hpiFreeText: 'patient-encounter-hpi-free-text',
  hpiPill: (category: string, pill: string) =>
    `patient-encounter-hpi-${category}-${pill.replace(/\s+/g, '-').toLowerCase()}`,
  vitalsSection: 'patient-encounter-vitals',
  vitalsHeartRate: 'patient-encounter-vitals-hr',
  vitalsTemperature: 'patient-encounter-vitals-temp',
  vitalsBpSystolic: 'patient-encounter-vitals-bp-sys',
  vitalsBpDiastolic: 'patient-encounter-vitals-bp-dia',
  vitalsIopOd: 'patient-encounter-vitals-iop-od',
  vitalsIopOs: 'patient-encounter-vitals-iop-os',
  vitalsVaOd: 'patient-encounter-vitals-va-od',
  vitalsVaOs: 'patient-encounter-vitals-va-os',
  physicalExamSection: 'patient-encounter-pe',
  peTemplate: (id: string) => `patient-encounter-pe-template-${id}`,
  peNotes: 'patient-encounter-pe-notes',
  medicationsSection: 'patient-encounter-meds',
  medSuggestion: (name: string) =>
    `patient-encounter-med-suggestion-${name.replace(/\s+/g, '-').toLowerCase()}`,
  medCustomInput: 'patient-encounter-med-custom-input',
  medCustomAdd: 'patient-encounter-med-custom-add',
  medList: 'patient-encounter-med-list',
  medNotes: 'patient-encounter-med-notes',
  ophthalmicExam: 'patient-encounter-ophthalmic-exam',
  saveButton: 'patient-encounter-save',
} as const;
