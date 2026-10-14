/**
 * Canonical Add Patient is the existing wizard at /dashboard/patients/new.
 * Other modules navigate here and may return after identity creation.
 * This does not create visits, appointments, or counselling sessions.
 */

export const CANONICAL_ADD_PATIENT_PATH = '/dashboard/patients/new';

/** Query carrying the newly created patient.id back to an operational workflow. */
export const CREATED_PATIENT_QUERY = 'createdPatientId';

const ALLOWED_RETURN_PATHS = [
  '/dashboard/patients',
  '/dashboard/frontdesk',
  '/dashboard/counsellors-desk/waiting-list',
  '/dashboard/appointments',
  '/dashboard/appointments/book',
  '/dashboard/patients/book',
  '/dashboard/frontdesk/book',
  '/admin/patients',
] as const;

export function sanitizeAddPatientReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://') || trimmed.includes('\\')) {
    return null;
  }
  const hashless = trimmed.split('#')[0] ?? '';
  const path = (hashless.split('?')[0] ?? '').replace(/\/+$/, '') || '/';
  if (path === CANONICAL_ADD_PATIENT_PATH) return null;
  const allowed = ALLOWED_RETURN_PATHS.some((entry) => path === entry);
  return allowed ? hashless : null;
}

export function buildCanonicalAddPatientHref(returnTo: string): string {
  const safe = sanitizeAddPatientReturnTo(returnTo);
  if (!safe) return CANONICAL_ADD_PATIENT_PATH;
  return `${CANONICAL_ADD_PATIENT_PATH}?returnTo=${encodeURIComponent(safe)}`;
}

function shouldCarryCreatedPatient(path: string): boolean {
  return (
    path === '/dashboard/counsellors-desk/waiting-list' ||
    path.endsWith('/book')
  );
}

export function continuationHref(returnTo: string, patientId: string): string {
  const id = patientId.trim();
  const [path, query = ''] = returnTo.split('?');
  const params = new URLSearchParams(query);
  if (id && shouldCarryCreatedPatient(path)) {
    params.set(CREATED_PATIENT_QUERY, id);
  } else {
    params.delete(CREATED_PATIENT_QUERY);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export type CreatedPatientNavigation =
  | { kind: 'iframe' }
  | { kind: 'record'; href: string }
  | { kind: 'return'; href: string };

/**
 * Default success stays on the existing record navigation.
 * A validated returnTo is used only when the caller arrived from another workflow.
 * Iframe postMessage remains when the wizard is embedded and no return path was supplied.
 */
export function resolveCreatedPatientNavigation(options: {
  returnTo: string | null | undefined;
  patientId: string;
  inIframe: boolean;
}): CreatedPatientNavigation {
  const safe = sanitizeAddPatientReturnTo(options.returnTo);
  if (safe) {
    return { kind: 'return', href: continuationHref(safe, options.patientId) };
  }
  if (options.inIframe) return { kind: 'iframe' };
  return { kind: 'record', href: `/dashboard/patients/${options.patientId}` };
}

/** Booking pages resume on their own route. The appointments modal host uses the existing book route. */
export function bookingAddPatientReturnPath(pathname: string): string {
  const path = pathname.split('?')[0] ?? '';
  if (path.endsWith('/book')) return path;
  return '/dashboard/appointments/book';
}
