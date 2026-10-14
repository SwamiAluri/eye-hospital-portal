/**
 * DUP Review navigation — maps server attribute signals to Review field keys.
 * Does not infer matches; only maps identifiers already returned by the server.
 */

export type DuplicateReviewFieldKey =
  | 'firstName'
  | 'lastName'
  | 'dateOfBirth'
  | 'phone'
  | 'email';

export type DuplicateReviewEvidenceKind = 'matched' | 'different';

/** Creation gate severity — derived from the review *source* / server MatchType, never field counts. */
export type DuplicateReviewSeverity = 'hard' | 'soft';

export type DuplicateReviewContext = {
  candidateId: string;
  firstName?: string | null;
  lastName?: string | null;
  medicalRecordNumber?: string | null;
  /** Server MatchType for the selected candidate (informational). */
  matchType?: string | null;
  /**
   * Creation gate for this Review visit.
   * - hard: ExactNameDOB / hard dialog path — Confirm & Create must not create
   * - soft: soft dialog path — Continue Registration remains the create acknowledgement
   * Never derived from matchedAttributes length or client value comparison.
   */
  severity: DuplicateReviewSeverity;
  /** Server-authored only */
  matchedAttributes: string[];
  /** Server-authored only */
  differentAttributes: string[];
};

const SIGNAL_TO_FIELD: Record<string, DuplicateReviewFieldKey> = {
  FirstName: 'firstName',
  LastName: 'lastName',
  DateOfBirth: 'dateOfBirth',
  Phone: 'phone',
  Email: 'email',
};

/** ExactNameDOB is the certified hard MatchType for registration create blocking. */
export function isExactNameDobMatchType(matchType?: string | null): boolean {
  return (matchType ?? '').trim() === 'ExactNameDOB';
}

/**
 * Severity for a Review visit opened from a duplicate dialog.
 * Hard dialog / ExactNameDOB → hard (terminal create block).
 * Soft dialog → soft (Continue Registration remains available).
 * Does not count matchedAttributes.
 */
export function resolveDuplicateReviewSeverity(input: {
  source: 'hard' | 'soft';
  matchType?: string | null;
}): DuplicateReviewSeverity {
  if (input.source === 'hard') return 'hard';
  if (isExactNameDobMatchType(input.matchType)) return 'hard';
  return 'soft';
}

/** True when Review holds an active hard create block for the current identity. */
export function isHardDuplicateReviewBlocking(
  context: DuplicateReviewContext | null | undefined,
): boolean {
  return context?.severity === 'hard';
}

/** Resolve server signal → review field evidence kind (matched wins over different). */
export function duplicateEvidenceForField(
  field: DuplicateReviewFieldKey,
  context: DuplicateReviewContext | null | undefined,
): DuplicateReviewEvidenceKind | null {
  if (!context) return null;
  for (const signal of context.matchedAttributes) {
    if (SIGNAL_TO_FIELD[signal] === field) return 'matched';
  }
  for (const signal of context.differentAttributes) {
    if (SIGNAL_TO_FIELD[signal] === field) return 'different';
  }
  return null;
}

export function formatDuplicateReviewCandidateLabel(context: DuplicateReviewContext): string {
  const name = [context.firstName, context.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  const mrn = context.medicalRecordNumber?.trim();
  if (name && mrn) return `${name} · ${mrn}`;
  return name || mrn || 'Selected existing patient';
}
