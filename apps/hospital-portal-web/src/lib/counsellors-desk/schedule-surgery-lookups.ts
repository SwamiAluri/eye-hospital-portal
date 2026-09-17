/**
 * Schedule Surgery lookup helpers — counselling-scoped endpoints only.
 * Surgeons and theaters load independently so one failure cannot blank both.
 */

export type ScheduleLookupOption = { id: string; name: string };

export type ScheduleLookupResult = {
  surgeons: ScheduleLookupOption[];
  theaters: ScheduleLookupOption[];
  surgeonError: string | null;
  theaterError: string | null;
};

function normalizeOption(raw: { id?: string; name?: string }): ScheduleLookupOption | null {
  const id = (raw.id ?? '').trim();
  const name = (raw.name ?? '').trim();
  if (!id || !name) return null;
  return { id, name };
}

export function normalizeScheduleLookupOptions(
  rows: { id?: string; name?: string }[],
): ScheduleLookupOption[] {
  return rows.map(normalizeOption).filter((o): o is ScheduleLookupOption => o != null);
}

/** Map axios/network failures to honest counsellor-facing messages. */
export function classifyScheduleLookupError(
  error: unknown,
  resource: 'theatres' | 'doctors',
): string {
  const status =
    error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;

  if (resource === 'theatres') {
    if (status === 403) {
      return "You don't have access to operation theatres for this branch.";
    }
    if (status === 404) {
      return 'Operation theatre lookup is unavailable on the server. Ask IT to restart AuthService with the counselling theaters endpoint.';
    }
    if (status === 401) {
      return 'Session expired — please sign in again.';
    }
    return 'Could not load operation theatres. Retry.';
  }

  if (status === 403) {
    return "You don't have access to the doctor list.";
  }
  if (status === 404) {
    return 'Doctor lookup is unavailable on the server. Retry or contact support.';
  }
  if (status === 401) {
    return 'Session expired — please sign in again.';
  }
  return 'Could not load doctors. Retry.';
}

export async function loadScheduleSurgeryLookups(loaders: {
  getSurgeons: () => Promise<{ id: string; name: string }[]>;
  getOtTheaters: () => Promise<{ id: string; name: string }[]>;
}): Promise<ScheduleLookupResult> {
  const [surgeonSettled, theaterSettled] = await Promise.allSettled([
    loaders.getSurgeons(),
    loaders.getOtTheaters(),
  ]);

  const surgeons =
    surgeonSettled.status === 'fulfilled'
      ? normalizeScheduleLookupOptions(surgeonSettled.value)
      : [];
  const theaters =
    theaterSettled.status === 'fulfilled'
      ? normalizeScheduleLookupOptions(theaterSettled.value)
      : [];

  return {
    surgeons,
    theaters,
    surgeonError:
      surgeonSettled.status === 'rejected'
        ? classifyScheduleLookupError(surgeonSettled.reason, 'doctors')
        : null,
    theaterError:
      theaterSettled.status === 'rejected'
        ? classifyScheduleLookupError(theaterSettled.reason, 'theatres')
        : null,
  };
}

/** Forbidden endpoints for Schedule Surgery counsellor path. */
export const SCHEDULE_SURGERY_FORBIDDEN_PATHS = [
  '/otbooking/theaters',
  '/users/with-details',
] as const;
