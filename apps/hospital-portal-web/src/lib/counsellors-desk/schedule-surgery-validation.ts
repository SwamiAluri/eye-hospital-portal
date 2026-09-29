export interface ScheduleSurgerySubmissionInput {
  selectedDate: string;
  operationTheatre: string;
  doctor: string;
  surgeryStartTime: string;
}

export interface ScheduleSurgerySubmissionResult {
  ok: boolean;
  errors: Partial<Record<'date' | 'doctor', string>>;
}

/**
 * Counselling surgery plan: date and doctor are required.
 * Operation theatre and start time are optional and are not an OT booking.
 */
export function validateScheduleSurgerySubmission(
  input: ScheduleSurgerySubmissionInput,
): ScheduleSurgerySubmissionResult {
  const errors: ScheduleSurgerySubmissionResult['errors'] = {};
  if (!input.selectedDate.trim()) errors.date = 'Please select a date';
  if (!input.doctor.trim()) errors.doctor = 'Doctor is required';
  return { ok: Object.keys(errors).length === 0, errors };
}
