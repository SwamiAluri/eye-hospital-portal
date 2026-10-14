/** PRD discipline codes — availability is deployment configuration. */
export const LMS_CATALOGUE_DISCIPLINES = [
  { code: 'CLINICAL_CHEMISTRY', label: 'Clinical Chemistry' },
  { code: 'HEMATOLOGY_COAGULATION', label: 'Hematology and Coagulation' },
  { code: 'IMMUNOLOGY_SEROLOGY', label: 'Immunology and Serology' },
  { code: 'MICROBIOLOGY', label: 'Microbiology' },
  { code: 'MOLECULAR_DIAGNOSTICS', label: 'Molecular Diagnostics' },
  { code: 'HISTOPATHOLOGY_CYTOPATHOLOGY', label: 'Histopathology and Cytopathology' },
  { code: 'TRANSFUSION_IMMUNOHEMATOLOGY', label: 'Transfusion and Immunohematology' },
  { code: 'URINALYSIS_CLINICAL_PATHOLOGY', label: 'Urinalysis and Clinical Pathology' },
  { code: 'TOXICOLOGY_TDM', label: 'Toxicology and Therapeutic Drug Monitoring' },
  { code: 'POCT', label: 'Point of Care Testing' },
] as const;

export const LMS_CATALOGUE_TYPES = [
  { code: 'TEST', label: 'Test' },
  { code: 'PANEL', label: 'Panel / Profile' },
  { code: 'REFERRAL_TEST', label: 'Referral Test' },
] as const;

export function disciplineLabel(code: string): string {
  return LMS_CATALOGUE_DISCIPLINES.find((d) => d.code === code)?.label ?? code;
}
