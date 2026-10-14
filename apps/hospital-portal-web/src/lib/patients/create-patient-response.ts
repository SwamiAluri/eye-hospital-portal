/**
 * Canonical parse of POST /api/patients create body.
 * Success UI + Registration Card must be driven from this payload — not Directory lookup.
 */

export type ParsedCreatePatientResponse = {
  id: string;
  medicalRecordNumber: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Extract patient.id (required) and MRN (preferred) from create JSON.
 * Accepts camelCase / PascalCase / mrn alias. Does not invent identity.
 */
export function parseCreatePatientResponse(data: unknown): ParsedCreatePatientResponse {
  const row = asRecord(data);
  if (!row) {
    throw new Error('Create patient response was empty or invalid');
  }

  const id = readString(row.id) ?? readString(row.Id);
  if (!id) {
    throw new Error('Create patient response did not include patient id');
  }

  const medicalRecordNumber =
    readString(row.medicalRecordNumber) ??
    readString(row.MedicalRecordNumber) ??
    readString(row.mrn) ??
    readString(row.Mrn);

  return { id, medicalRecordNumber };
}

/** User-visible message for axios/network create failures (no PHI). */
export function formatPatientCreateError(err: unknown): string {
  const axiosLike = err as {
    message?: string;
    response?: { status?: number; data?: { message?: string; error?: string; title?: string } };
  };
  const status = axiosLike?.response?.status;
  const body = axiosLike?.response?.data;
  const serverMessage =
    (typeof body?.message === 'string' && body.message.trim()) ||
    (typeof body?.error === 'string' && body.error.trim()) ||
    (typeof body?.title === 'string' && body.title.trim()) ||
    '';

  if (status === 400) {
    return serverMessage || 'Patient could not be created. Check the details and try again.';
  }
  if (status === 401) {
    return 'Your session expired. Sign in again, then retry registration.';
  }
  if (status === 403) {
    return serverMessage || 'You do not have permission to create patients.';
  }
  if (status === 409) {
    return serverMessage || 'This patient conflicts with an existing record.';
  }
  if (status === 500 || (typeof status === 'number' && status >= 500)) {
    return 'Server error while creating the patient. Please try again.';
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return 'Failed to create patient. Please try again.';
}
