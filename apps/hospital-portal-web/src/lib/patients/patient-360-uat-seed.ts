export const PATIENT_360_UAT_SEED = {
  firstName: 'UAT360',
  lastName: 'Longitudinal',
  dateOfBirth: '1975-04-12',
  gender: 'female',
  contactNumber: '+919360000001',
  email: 'uat360.longitudinal@example.test',
  emergencyContactName: 'UAT Emergency',
  emergencyContactPhone: '+919360000002',
  emergencyContactRelationship: 'Spouse',
  bloodGroup: 'O+',
  allergies: 'Penicillin',
} as const;

export const PATIENT_360_UAT_LOOKUP_QUERY = 'UAT360 Longitudinal';

export function isPatient360UatSeedRecord(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}): boolean {
  const first = input.firstName?.trim() === PATIENT_360_UAT_SEED.firstName;
  const last = input.lastName?.trim() === PATIENT_360_UAT_SEED.lastName;
  const email = input.email?.trim().toLowerCase() === PATIENT_360_UAT_SEED.email;
  const phone = (input.phone ?? '').replace(/\s/g, '') === PATIENT_360_UAT_SEED.contactNumber;
  return first && last && (email || phone);
}
