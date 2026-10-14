/**
 * Parses the existing POST /api/patients hard-block payload.
 * Server remains authoritative — this only shapes the certified 400 body for UI.
 *
 * Expected shape (camelCase JSON):
 * { error, message, duplicates: PatientDuplicateMatch[] }
 *
 * PatientDuplicateMatch already includes matchType, matchConfidence, differenceReason.
 * UI uses matchType for a safe human label. differenceReason often contains phone/email
 * and is NOT displayed.
 */

export type DuplicateHardBlockCandidate = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  medicalRecordNumber?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: string | null;
  matchType?: string | null;
  matchConfidence?: number | null;
  /** DUP-C3A.2b create-scoped evidence — soft dialog only; never invent client-side. */
  matchedAttributes?: string[] | null;
  differentAttributes?: string[] | null;
};

export type DuplicateHardBlockParseResult = {
  isDuplicateHardBlock: boolean;
  message: string;
  duplicates: DuplicateHardBlockCandidate[];
};

const HARD_BLOCK_ERROR = 'Duplicate patient detected';

/** Certified MatchType → registration step for guided return (no invented fields). */
export const DUPLICATE_MATCH_TYPE_STEP: Record<string, number> = {
  ExactNameDOB: 1,
  FuzzyNameDOB: 1,
  PhoneMatch: 2,
  EmailMatch: 2,
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

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function readAttributeSignals(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(['FirstName', 'LastName', 'DateOfBirth', 'Phone', 'Email']);
  const out: string[] = [];
  for (const item of value) {
    const signal = readString(item);
    if (!signal || !known.has(signal)) continue;
    if (!out.includes(signal)) out.push(signal);
  }
  return out;
}

function normalizeCandidate(raw: unknown): DuplicateHardBlockCandidate | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = readString(row.id) ?? readString(row.Id);
  if (!id) return null;
  return {
    id,
    firstName: readString(row.firstName) ?? readString(row.FirstName),
    lastName: readString(row.lastName) ?? readString(row.LastName),
    medicalRecordNumber:
      readString(row.medicalRecordNumber) ?? readString(row.MedicalRecordNumber),
    dateOfBirth: (row.dateOfBirth ?? row.DateOfBirth ?? null) as string | Date | null,
    gender: readString(row.gender) ?? readString(row.Gender),
    matchType: readString(row.matchType) ?? readString(row.MatchType),
    matchConfidence: readNumber(row.matchConfidence) ?? readNumber(row.MatchConfidence),
    matchedAttributes: readAttributeSignals(row.matchedAttributes ?? row.MatchedAttributes),
    differentAttributes: readAttributeSignals(
      row.differentAttributes ?? row.DifferentAttributes,
    ),
  };
}

/**
 * Detects the existing create hard-block response without inventing a new contract.
 * Accepts axios-style errors (`response.status` / `response.data`) or a bare data object.
 */
export function parseDuplicateHardBlockError(error: unknown): DuplicateHardBlockParseResult {
  const empty: DuplicateHardBlockParseResult = {
    isDuplicateHardBlock: false,
    message: '',
    duplicates: [],
  };

  const err = asRecord(error);
  const response = asRecord(err?.response) ?? asRecord(error);
  const status = typeof response?.status === 'number' ? response.status : null;
  const data = asRecord(response?.data) ?? (status == null ? asRecord(error) : null);
  if (!data) return empty;

  const message =
    readString(data.message) ??
    readString(data.Message) ??
    'A patient with very similar details already exists. Please review before creating.';
  const errorCode = readString(data.error) ?? readString(data.Error);
  const rawList = data.duplicates ?? data.Duplicates ?? data.matches ?? data.Matches;
  const list = Array.isArray(rawList) ? rawList : [];
  const duplicates = list
    .map(normalizeCandidate)
    .filter((row): row is DuplicateHardBlockCandidate => row != null);

  const looksLikeHardBlock =
    errorCode === HARD_BLOCK_ERROR ||
    (status === 400 && duplicates.length > 0 && /duplicate/i.test(message));

  if (!looksLikeHardBlock) {
    return { ...empty, message: status === 400 ? message : '' };
  }

  return {
    isDuplicateHardBlock: true,
    message,
    duplicates,
  };
}

export function formatDuplicateCandidateName(candidate: DuplicateHardBlockCandidate): string {
  const name = [candidate.firstName, candidate.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name || 'Existing patient';
}

export function formatDuplicateCandidateDob(value?: string | Date | null): string | null {
  if (!value) return null;
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export type DuplicateMatchPresentation = {
  /** True only for certified MatchType values. */
  known: boolean;
  /** Short product label for the match basis. */
  label: string;
  /** Compact matched-field chips (empty when unknown). */
  matchedFields: readonly string[];
  /** Staff-facing explanation — never invents algorithm details. */
  explanation: string;
};

const UNKNOWN_MATCH_PRESENTATION: DuplicateMatchPresentation = {
  known: false,
  label: 'Match details unavailable',
  matchedFields: [],
  explanation: 'Match details unavailable',
};

/**
 * Deterministic MatchType → UX presentation.
 * Uses only certified MatchType values; never invents criteria or scores.
 */
export function resolveDuplicateMatchPresentation(
  matchType?: string | null,
): DuplicateMatchPresentation {
  switch (matchType?.trim()) {
    case 'ExactNameDOB':
      return {
        known: true,
        label: 'Exact name + date of birth',
        matchedFields: ['Name', 'Date of birth'],
        explanation: 'Exact name and date of birth match',
      };
    case 'PhoneMatch':
      return {
        known: true,
        label: 'Phone number',
        matchedFields: ['Phone number'],
        explanation: 'Phone number matches an existing patient',
      };
    case 'EmailMatch':
      return {
        known: true,
        label: 'Email address',
        matchedFields: ['Email'],
        explanation: 'Email address matches an existing patient',
      };
    case 'FuzzyNameDOB':
      return {
        known: true,
        label: 'Similar name + date of birth',
        matchedFields: ['Similar name', 'Date of birth'],
        explanation: 'Name is similar and date of birth matches',
      };
    default:
      return UNKNOWN_MATCH_PRESENTATION;
  }
}

/** Safe label from existing MatchType only — never invents reasons. */
export function formatDuplicateMatchReason(matchType?: string | null): string | null {
  const presentation = resolveDuplicateMatchPresentation(matchType);
  return presentation.known ? presentation.label : null;
}

/** Guided return step from MatchType. Null when type unknown. */
export function registrationStepForMatchType(matchType?: string | null): number | null {
  if (!matchType?.trim()) return null;
  return DUPLICATE_MATCH_TYPE_STEP[matchType.trim()] ?? null;
}

/** Prefer first candidate with a known MatchType for guided return. */
export function registrationStepForDuplicates(
  duplicates: DuplicateHardBlockCandidate[],
): number | null {
  for (const row of duplicates) {
    const step = registrationStepForMatchType(row.matchType);
    if (step != null) return step;
  }
  return null;
}
