/**
 * DUP-C.3 / DUP-C3A.2c — Create-scoped registration duplicate pre-check helpers.
 * Consumes minimized create-scoped response only. No client-side matching rules.
 */

import type { DuplicateHardBlockCandidate } from '@/lib/patients/duplicate-hard-block';

/** Server-authored attribute signals (DUP-C3A.2b). */
export type RegistrationDuplicateAttributeSignal =
  | 'FirstName'
  | 'LastName'
  | 'DateOfBirth'
  | 'Phone'
  | 'Email';

export type RegistrationDuplicateCandidate = {
  id: string;
  medicalRecordNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: string | null;
  matchType?: string | null;
  matchedAttributes?: string[];
  differentAttributes?: string[];
};

export type RegistrationDuplicateCheckResult = {
  isDuplicate: boolean;
  message?: string | null;
  matches: RegistrationDuplicateCandidate[];
};

/** Local wizard identity shown in the soft dialog NEW REGISTRATION panel. */
export type SoftMatchRegistrationDraft = {
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: string | null;
  /** Form phone only — never candidate phone. Used for masked ending display. */
  phone?: string | null;
};

const ATTRIBUTE_LABELS: Record<RegistrationDuplicateAttributeSignal, string> = {
  FirstName: 'First name',
  LastName: 'Last name',
  DateOfBirth: 'Date of birth',
  Phone: 'Phone number',
  Email: 'Email',
};

const KNOWN_ATTRIBUTE_SIGNALS = new Set<string>(Object.keys(ATTRIBUTE_LABELS));

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readAttributeSignals(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const signal = readString(item);
    if (!signal || !KNOWN_ATTRIBUTE_SIGNALS.has(signal)) continue;
    if (!out.includes(signal)) out.push(signal);
  }
  return out;
}

function normalizeCandidate(raw: unknown): RegistrationDuplicateCandidate | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = readString(row.id) ?? readString(row.Id);
  if (!id) return null;
  return {
    id,
    medicalRecordNumber:
      readString(row.medicalRecordNumber) ?? readString(row.MedicalRecordNumber),
    firstName: readString(row.firstName) ?? readString(row.FirstName),
    lastName: readString(row.lastName) ?? readString(row.LastName),
    dateOfBirth: (row.dateOfBirth ?? row.DateOfBirth ?? null) as string | Date | null,
    gender: readString(row.gender) ?? readString(row.Gender),
    matchType: readString(row.matchType) ?? readString(row.MatchType),
    matchedAttributes: readAttributeSignals(row.matchedAttributes ?? row.MatchedAttributes),
    differentAttributes: readAttributeSignals(
      row.differentAttributes ?? row.DifferentAttributes,
    ),
  };
}

/** Parse minimized registration/check-duplicates body (camelCase or PascalCase). */
export function parseRegistrationDuplicateCheckResult(
  data: unknown,
): RegistrationDuplicateCheckResult {
  const row = asRecord(data);
  if (!row) {
    return { isDuplicate: false, matches: [] };
  }
  const rawList = row.matches ?? row.Matches;
  const list = Array.isArray(rawList) ? rawList : [];
  const matches = list
    .map(normalizeCandidate)
    .filter((m): m is RegistrationDuplicateCandidate => Boolean(m));
  return {
    isDuplicate: row.isDuplicate === true || row.IsDuplicate === true,
    message: readString(row.message) ?? readString(row.Message),
    matches,
  };
}

/**
 * Soft review when server reports possible matches that are not ExactNameDOB.
 * ExactNameDOB (always 1.00) skips soft UI — final create + hard-block remain authoritative.
 * FuzzyNameDOB may still hard-block after Continue if server confidence ≥ 0.95.
 */
export function hasExactNameDobMatch(
  result: RegistrationDuplicateCheckResult,
): boolean {
  return result.matches.some((m) => (m.matchType ?? '').trim() === 'ExactNameDOB');
}

export function shouldShowSoftDuplicateReview(
  result: RegistrationDuplicateCheckResult,
): boolean {
  if (!result.isDuplicate || result.matches.length === 0) return false;
  // ExactNameDOB (always 1.00) → hard review gate; soft Continue must not appear.
  return !hasExactNameDobMatch(result);
}

/** Identity fingerprint for soft-review acknowledgement invalidation. */
export function registrationIdentityFingerprint(fields: {
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  contactNumber?: string | null;
  email?: string | null;
}): string {
  const phone = (fields.contactNumber ?? fields.phone ?? '').trim().toLowerCase();
  return [
    (fields.firstName ?? '').trim().toLowerCase(),
    (fields.lastName ?? '').trim().toLowerCase(),
    (fields.dateOfBirth ?? '').trim(),
    phone,
    (fields.email ?? '').trim().toLowerCase(),
  ].join('\u001f');
}

export function toSoftMatchCandidates(
  matches: RegistrationDuplicateCandidate[],
): DuplicateHardBlockCandidate[] {
  return matches.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    medicalRecordNumber: m.medicalRecordNumber,
    dateOfBirth: m.dateOfBirth,
    gender: m.gender,
    matchType: m.matchType,
    matchConfidence: null,
    matchedAttributes: m.matchedAttributes ?? [],
    differentAttributes: m.differentAttributes ?? [],
  }));
}

/** Map server signal → concise matched label. Unknown signals omitted. */
export function formatMatchedAttributeLabel(signal: string): string | null {
  const key = signal.trim() as RegistrationDuplicateAttributeSignal;
  return ATTRIBUTE_LABELS[key] ?? null;
}

/**
 * Server matchedAttributes → display labels.
 * FirstName+LastName collapse to "Name"; other known signals keep 1:1 labels.
 * Does not invent evidence — unknown signals omitted.
 */
export function formatMatchedEvidenceLabels(
  matchedAttributes?: string[] | null,
): string[] {
  return buildMatchedEvidenceRows(matchedAttributes).map((row) => row.label);
}

/** Rows with stable signal ids for testids / aria (Name when First+Last both matched). */
export function buildMatchedEvidenceRows(
  matchedAttributes?: string[] | null,
): Array<{ signal: string; label: string }> {
  const signals = (matchedAttributes ?? [])
    .map((s) => s.trim())
    .filter((s) => KNOWN_ATTRIBUTE_SIGNALS.has(s));
  const unique = [...new Set(signals)];
  const hasFirst = unique.includes('FirstName');
  const hasLast = unique.includes('LastName');
  const rows: Array<{ signal: string; label: string }> = [];

  if (hasFirst && hasLast) {
    rows.push({ signal: 'Name', label: 'Name' });
  } else {
    if (hasFirst) rows.push({ signal: 'FirstName', label: ATTRIBUTE_LABELS.FirstName });
    if (hasLast) rows.push({ signal: 'LastName', label: ATTRIBUTE_LABELS.LastName });
  }
  if (unique.includes('DateOfBirth')) {
    rows.push({ signal: 'DateOfBirth', label: ATTRIBUTE_LABELS.DateOfBirth });
  }
  if (unique.includes('Phone')) {
    rows.push({ signal: 'Phone', label: ATTRIBUTE_LABELS.Phone });
  }
  if (unique.includes('Email')) {
    rows.push({ signal: 'Email', label: ATTRIBUTE_LABELS.Email });
  }
  return rows;
}

/**
 * Prefer server matchedAttributes; fall back to MatchType presentation only when
 * attributes are absent (legacy hard-block payloads).
 */
export function resolveMatchedEvidenceLabels(
  matchedAttributes?: string[] | null,
  matchType?: string | null,
): string[] {
  const fromAttrs = formatMatchedEvidenceLabels(matchedAttributes);
  if (fromAttrs.length > 0) return fromAttrs;
  // Lazy import avoided — MatchType fallback labels mirror hard-block presentation.
  switch ((matchType ?? '').trim()) {
    case 'ExactNameDOB':
      return ['Name', 'Date of birth'];
    case 'PhoneMatch':
      return ['Phone number'];
    case 'EmailMatch':
      return ['Email'];
    case 'FuzzyNameDOB':
      return ['Similar name', 'Date of birth'];
    default:
      return [];
  }
}

/** Map server signal → concise difference label. Unknown signals omitted. */
export function formatDifferentAttributeLabel(signal: string): string | null {
  const label = formatMatchedAttributeLabel(signal);
  return label ? `${label} differs` : null;
}

/**
 * Masked ending for the NEW REGISTRATION form phone only.
 * Returns null when fewer than 4 digits are available (omit from summary).
 */
export function formatRegistrationPhoneEnding(phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `Phone ending ${digits.slice(-4)}`;
}
