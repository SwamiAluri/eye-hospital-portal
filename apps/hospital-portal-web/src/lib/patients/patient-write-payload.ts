/**
 * Patient create/update payload helpers.
 * ASP.NET [EmailAddress] rejects empty string — omit blanks instead.
 */

const EMAIL_KEYS = [
  'email',
  'emergencyContactEmail',
  'guardianEmail',
] as const;

const OMIT_IF_BLANK = [
  ...EMAIL_KEYS,
  'contactNumber',
  'phone',
  'address',
  'bloodGroup',
  'emergencyContactName',
  'emergencyContactNumber',
  'emergencyContactPhone',
  'insuranceProvider',
  'insuranceNumber',
  'insurancePolicyNumber',
  'notes',
  'idProofType',
  'idProofNumber',
  'allergies',
  'medicalConditions',
  'medications',
] as const;

export function sanitizePatientWritePayload<T extends Record<string, unknown>>(
  data: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };

  // FE form uses emergencyContactNumber; API DTO expects emergencyContactPhone.
  if (
    typeof out.emergencyContactNumber === 'string' &&
    out.emergencyContactNumber.trim() &&
    !out.emergencyContactPhone
  ) {
    out.emergencyContactPhone = out.emergencyContactNumber.trim();
  }
  if (
    typeof out.insuranceNumber === 'string' &&
    out.insuranceNumber.trim() &&
    !out.insurancePolicyNumber
  ) {
    out.insurancePolicyNumber = out.insuranceNumber.trim();
  }

  for (const key of OMIT_IF_BLANK) {
    const value = out[key];
    if (value == null) {
      delete out[key];
      continue;
    }
    if (typeof value === 'string' && !value.trim()) {
      delete out[key];
    }
  }

  return out;
}

export function formatPatientApiError(err: unknown): string {
  const axiosLike = err as {
    response?: { data?: { message?: string; title?: string; error?: string; errors?: Record<string, string[]> } };
    message?: string;
  };
  const data = axiosLike.response?.data;
  if (data?.errors && typeof data.errors === 'object') {
    const parts = Object.entries(data.errors).flatMap(([field, msgs]) =>
      (msgs ?? []).map((m) => `${field}: ${m}`),
    );
    if (parts.length) return parts.join(' ');
  }
  return (
    data?.message ||
    data?.title ||
    data?.error ||
    axiosLike.message ||
    'Failed to save patient'
  );
}
