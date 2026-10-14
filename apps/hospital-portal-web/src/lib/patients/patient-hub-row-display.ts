import { calcPatientAge, formatPatientSex } from '@/lib/patients/patient-display-utils';
import type { PatientDisambiguationInput } from '@/lib/patients/patient-disambiguation';
import type { PatientActiveEngagement } from '@/types/patient-lookup';

/**
 * Directory identity sex label (presentation only).
 * male/female → MALE/FEMALE; other values use formatPatientSex without inventing mappings.
 */
export function formatDirectorySexLabel(sex?: string | null): string | null {
  const raw = sex?.trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (key === 'm' || key === 'male') return 'MALE';
  if (key === 'f' || key === 'female') return 'FEMALE';
  return formatPatientSex(raw);
}

/** Compact identity line: MRN · age · sex (Directory uppercase for male/female). */
export function formatPatientHubIdentityLine(patient: PatientDisambiguationInput): string {
  const parts: string[] = [];
  const mrn = patient.mrn?.trim();
  if (mrn) parts.push(mrn);

  const age = calcPatientAge(patient.dateOfBirth);
  if (age != null) parts.push(`${age}Y`);

  const sex = formatDirectorySexLabel(patient.gender);
  if (sex) parts.push(sex);

  return parts.join(' · ');
}

/**
 * Directory phone display (presentation only).
 * Indian 10-digit forms → +91-XXXXXXXXXX. Ambiguous values preserved as-is.
 * Does not mutate stored values or search/duplicate normalization.
 */
export function formatDirectoryPhoneDisplay(phone?: string | null): string {
  const raw = phone?.trim() ?? '';
  if (!raw) return '';
  if (/^\+91-\d{10}$/.test(raw)) return raw;

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91-${digits.slice(2)}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91-${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+91-${digits}`;
  }
  return raw;
}

export function formatHubSchedule(value?: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const VISIT_TYPE_PRIORITY = [
  'ip',
  'queue',
  'opd',
  'counselling',
  'insurance',
  'ccms',
  'billing',
  'camp',
] as const;

export type DirectoryVisitCheckInInput = {
  primaryOpenVisitId?: string | null;
  assignedVisitId?: string | null;
  waitingMinutes?: number | null;
  scheduledAt?: string | null;
};

/**
 * Existing directory checked-in predicate: an open/assigned visit with
 * waiting minutes recorded (same rule as formatHubVisitWhen).
 */
export function isDirectoryVisitCheckedIn(input: DirectoryVisitCheckInInput): boolean {
  const openVisit = input.primaryOpenVisitId ?? input.assignedVisitId;
  return Boolean(openVisit) && input.waitingMinutes != null && input.waitingMinutes >= 0;
}

/**
 * Offer Front Office check-in only when visit/appointment context exists and
 * the visit is not already checked in. Presentation only — no new API.
 */
export function canDirectoryOfferCheckIn(input: DirectoryVisitCheckInInput): boolean {
  if (isDirectoryVisitCheckedIn(input)) return false;
  return Boolean(
    input.primaryOpenVisitId?.trim() ||
      input.assignedVisitId?.trim() ||
      input.scheduledAt?.trim(),
  );
}

/** Merge lookup row + optional summary fields for directory check-in presentation. */
export function resolveDirectoryVisitCheckInState(input: {
  primaryOpenVisitId?: string | null;
  waitingMinutes?: number | null;
  scheduledAt?: string | null;
  assignedVisitId?: string | null;
  summary?: {
    assignedVisitId?: string | null;
    scheduledAt?: string | null;
  } | null;
}): DirectoryVisitCheckInInput {
  return {
    primaryOpenVisitId: input.primaryOpenVisitId,
    assignedVisitId: input.summary?.assignedVisitId ?? input.assignedVisitId,
    waitingMinutes: input.waitingMinutes,
    scheduledAt: input.summary?.scheduledAt ?? input.scheduledAt,
  };
}

/**
 * scheduledAt is the open visit's check-in time when that visit has been
 * checked in (waiting minutes are recorded only then). Otherwise it is the
 * next appointment. Presentation only — no new timestamp rule.
 */
export function formatHubVisitWhen(
  input: {
    scheduledAt?: string | null;
    primaryOpenVisitId?: string | null;
    waitingMinutes?: number | null;
  },
  now: Date = new Date(),
): string | null {
  const raw = input.scheduledAt;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (isDirectoryVisitCheckedIn(input)) return `Checked in · ${time}`;

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `Today · ${time}`;

  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${day} · ${time}`;
}

/**
 * Presentation-only gate for wait duration. Backend waitingMinutes is unchanged.
 * Values above one day (or non-finite / non-positive) are treated as unusable for display
 * (e.g. stale clocks producing 180733 min).
 */
export const MAX_DISPLAYABLE_WAITING_MINUTES = 24 * 60;

export function isDisplayableWaitingMinutes(value?: number | null): boolean {
  if (value == null) return false;
  if (!Number.isFinite(value)) return false;
  if (value <= 0) return false;
  return value <= MAX_DISPLAYABLE_WAITING_MINUTES;
}

/** Station, room, or IP ward. Omits empty values and unusable waits. */
export function formatHubLocationLines(row: {
  currentStation?: string | null;
  roomNumber?: string | null;
  waitingMinutes?: number | null;
  ipAdmission?: { isAdmitted?: boolean; wardName?: string | null } | null;
}): string[] {
  const ward = row.ipAdmission?.isAdmitted ? row.ipAdmission.wardName?.trim() ?? '' : '';
  const station = row.currentStation?.trim() ?? '';
  const room = row.roomNumber?.trim() ?? '';
  const wait = isDisplayableWaitingMinutes(row.waitingMinutes)
    ? `${row.waitingMinutes} min`
    : '';

  if (ward) {
    return room ? [ward, `Rm ${room}`] : [ward];
  }
  if (!station && !room) return [];

  const lines: string[] = [];
  if (station) lines.push(station);
  else lines.push(`Rm ${room}`);

  const detail = [
    station && room ? `Rm ${room}` : '',
    wait,
  ].filter(Boolean);
  if (detail.length > 0) lines.push(detail.join(' · '));
  return lines;
}

/**
 * Next appointment column: scheduledAt only when it is NOT an open-visit check-in time.
 * Same overloaded field semantics — no new DTO.
 */
export function formatHubNextAppointment(
  input: {
    scheduledAt?: string | null;
    primaryOpenVisitId?: string | null;
    waitingMinutes?: number | null;
  },
  now: Date = new Date(),
): string | null {
  if (isDirectoryVisitCheckedIn(input)) return null;
  return formatHubVisitWhen(input, now);
}

/**
 * Offer Book appointment when appointment.view is present AND the lookup row
 * does not already surface an upcoming appointment in Next Appointment.
 * Reuses formatHubNextAppointment — no new appointment semantics.
 *
 * Limitation: when checked in, scheduledAt is the check-in time, so a separate
 * future appointment cannot be detected from the lookup row alone.
 */
export function canDirectoryOfferBookAppointment(
  input: DirectoryVisitCheckInInput,
): boolean {
  return formatHubNextAppointment(input) == null;
}

/**
 * Compact Current Visit secondary line: when + optional engagement (+N).
 * Presentation only — max two visual lines with reason on the primary line.
 */
export function formatHubCurrentVisitStatusLine(
  input: {
    scheduledAt?: string | null;
    primaryOpenVisitId?: string | null;
    waitingMinutes?: number | null;
    activeEngagements?: PatientActiveEngagement[] | null;
  },
  now: Date = new Date(),
): string | null {
  const when = formatHubVisitWhen(input, now);
  const primary = pickPrimaryVisitEngagement(input.activeEngagements ?? []);
  const extra = countAdditionalEngagements(input.activeEngagements);
  const engagement = primary
    ? extra > 0
      ? `${primary.label} +${extra}`
      : primary.label
    : '';
  if (when && engagement) return `${when} · ${engagement}`;
  return when ?? (engagement || null);
}

/** Mobile: reason, otherwise place, otherwise the visit time. */
export function formatHubMobileContextLine(
  row: {
    reasonForVisit?: string | null;
    scheduledAt?: string | null;
    primaryOpenVisitId?: string | null;
    waitingMinutes?: number | null;
    currentStation?: string | null;
    roomNumber?: string | null;
    ipAdmission?: { isAdmitted?: boolean; wardName?: string | null } | null;
  },
  now: Date = new Date(),
): string | null {
  const reason = row.reasonForVisit?.trim();
  if (reason) return reason;
  const place = formatHubLocationLines(row)[0];
  if (place) return place;
  return formatHubVisitWhen(row, now);
}

export function countAdditionalEngagements(
  engagements: PatientActiveEngagement[] | null | undefined,
): number {
  const list = engagements ?? [];
  if (!pickPrimaryVisitEngagement(list)) return 0;
  return Math.max(0, list.length - 1);
}

export function pickPrimaryVisitEngagement(
  engagements: PatientActiveEngagement[],
): PatientActiveEngagement | null {
  if (!engagements?.length) return null;
  for (const type of VISIT_TYPE_PRIORITY) {
    const match = engagements.find((e) => e.type.toLowerCase() === type);
    if (match) return match;
  }
  return engagements[0];
}

export const HUB_ENGAGEMENT_STYLES: Record<string, string> = {
  opd: 'bg-blue-50 text-blue-800 ring-blue-100',
  queue: 'bg-violet-50 text-violet-800 ring-violet-100',
  ip: 'bg-indigo-50 text-indigo-800 ring-indigo-100',
  counselling: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  insurance: 'bg-cyan-50 text-cyan-800 ring-cyan-100',
  ccms: 'bg-sky-50 text-sky-900 ring-sky-100',
  billing: 'bg-amber-50 text-amber-800 ring-amber-100',
  camp: 'bg-teal-50 text-teal-800 ring-teal-100',
};

export const HUB_PROGRAM_STYLES: Record<string, string> = {
  CATARACT: 'bg-violet-50 text-violet-900 ring-violet-100',
  GLAUCOMA: 'bg-indigo-50 text-indigo-900 ring-indigo-100',
  RETINA: 'bg-sky-50 text-sky-900 ring-sky-100',
  CORNEA: 'bg-cyan-50 text-cyan-900 ring-cyan-100',
  REFRACTIVE: 'bg-fuchsia-50 text-fuchsia-900 ring-fuchsia-100',
};
