/** F2.3 seed rows — keep in sync with migrations/64_f23_master_entity_types.sql and MasterValueService.cs */
export type F23SeedRow = {
  entityType: string;
  code: string;
  label: string;
  sortOrder: number;
  metadata?: Record<string, string>;
};

export const F23_MASTER_SEEDS: F23SeedRow[] = [
  // appointment.status
  { entityType: 'appointment.status', code: 'scheduled', label: 'Scheduled', sortOrder: 1, metadata: { color: 'blue' } },
  { entityType: 'appointment.status', code: 'confirmed', label: 'Confirmed', sortOrder: 2, metadata: { color: 'green' } },
  { entityType: 'appointment.status', code: 'in-progress', label: 'In Progress', sortOrder: 3, metadata: { color: 'yellow' } },
  { entityType: 'appointment.status', code: 'completed', label: 'Completed', sortOrder: 4, metadata: { color: 'gray' } },
  { entityType: 'appointment.status', code: 'cancelled', label: 'Cancelled', sortOrder: 5, metadata: { color: 'red' } },
  { entityType: 'appointment.status', code: 'no-show', label: 'No Show', sortOrder: 6, metadata: { color: 'red' } },

  // counsellor.patient_intention
  { entityType: 'counsellor.patient_intention', code: 'WillingNow', label: 'Ready Now — Schedule Today', sortOrder: 1, metadata: { category: 'willing' } },
  { entityType: 'counsellor.patient_intention', code: 'WillingWeek', label: 'Within 1 Week', sortOrder: 2, metadata: { category: 'willing' } },
  { entityType: 'counsellor.patient_intention', code: 'WillingTwoWeeks', label: 'Within 2 Weeks', sortOrder: 3, metadata: { category: 'willing' } },
  { entityType: 'counsellor.patient_intention', code: 'WillingMonth', label: 'Within 1 Month', sortOrder: 4, metadata: { category: 'willing' } },
  { entityType: 'counsellor.patient_intention', code: 'WillingQuarter', label: 'Within 3 Months', sortOrder: 5, metadata: { category: 'willing' } },
  { entityType: 'counsellor.patient_intention', code: 'WillingSixMonths', label: 'After 6 Months', sortOrder: 6, metadata: { category: 'willing' } },
  { entityType: 'counsellor.patient_intention', code: 'WillingCallToConfirm', label: 'Will Call to Confirm', sortOrder: 7, metadata: { category: 'willing' } },
  { entityType: 'counsellor.patient_intention', code: 'Undecided', label: 'Undecided', sortOrder: 8, metadata: { category: 'not_ready' } },
  { entityType: 'counsellor.patient_intention', code: 'WaitingFinancial', label: 'Financial Hold', sortOrder: 9, metadata: { category: 'not_ready' } },
  { entityType: 'counsellor.patient_intention', code: 'WaitingFear', label: 'Fear / Hesitant', sortOrder: 10, metadata: { category: 'not_ready' } },
  { entityType: 'counsellor.patient_intention', code: 'SecondOpinion', label: 'Second Opinion', sortOrder: 11, metadata: { category: 'not_ready' } },
  { entityType: 'counsellor.patient_intention', code: 'Declined', label: 'Declined Surgery', sortOrder: 12, metadata: { category: 'not_ready' } },
  { entityType: 'counsellor.patient_intention', code: 'ReferredElsewhere', label: 'Referred Elsewhere', sortOrder: 13, metadata: { category: 'not_ready' } },

  // insurance.accommodation_class
  { entityType: 'insurance.accommodation_class', code: 'general', label: 'General', sortOrder: 1 },
  { entityType: 'insurance.accommodation_class', code: 'semi-private', label: 'Semi-Private', sortOrder: 2 },
  { entityType: 'insurance.accommodation_class', code: 'private', label: 'Private', sortOrder: 3 },
  { entityType: 'insurance.accommodation_class', code: 'icu', label: 'ICU', sortOrder: 4 },
];

export const F23_ENTITY_TYPES = [
  'appointment.status',
  'counsellor.patient_intention',
  'insurance.accommodation_class',
] as const;

export const F23_EXPECTED_COUNTS: Record<(typeof F23_ENTITY_TYPES)[number], number> = {
  'appointment.status': 6,
  'counsellor.patient_intention': 13,
  'insurance.accommodation_class': 4,
};
