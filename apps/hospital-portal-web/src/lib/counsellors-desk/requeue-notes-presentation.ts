/**
 * Phase 3I — separate ReQueue event lines from editable Counsellor working notes.
 *
 * Backend ReQueue appends lines shaped as:
 *   [Re-queue YYYY-MM-DD] <reason>
 * into CounselingSession.AdditionalNotes (FE counsellorNotes).
 *
 * Historical ReQueue reasons stay read-only; working notes remain independently editable.
 * Persistence recomposes event lines + working notes so history is never deleted.
 */

export type RequeueNoteEvent = {
  /** ISO date from the system prefix (yyyy-MM-dd). */
  date: string;
  reason: string;
  /** Exact persisted line (without trailing newline). */
  raw: string;
};

export type ParsedCounsellorAdditionalNotes = {
  requeueEvents: RequeueNoteEvent[];
  /** Counsellor working notes with ReQueue system lines removed. */
  workingNotes: string;
};

const REQUEUE_LINE_RE = /^\[Re-queue (\d{4}-\d{2}-\d{2})\]\s*(.*)$/;

export function parseCounsellorAdditionalNotes(
  raw: string | null | undefined,
): ParsedCounsellorAdditionalNotes {
  if (!raw) {
    return { requeueEvents: [], workingNotes: '' };
  }

  const requeueEvents: RequeueNoteEvent[] = [];
  const workingLines: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(REQUEUE_LINE_RE);
    if (match) {
      requeueEvents.push({
        date: match[1],
        reason: (match[2] ?? '').trim(),
        raw: line,
      });
      continue;
    }
    workingLines.push(line);
  }

  // Trim only outer blank lines so intentional spacing inside working notes is preserved.
  const workingNotes = workingLines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');

  return { requeueEvents, workingNotes };
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Format yyyy-MM-dd for read-only ReQueue presentation (e.g. 21 Sep 2026). */
export function formatRequeueEventDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return isoDate;
  return `${day} ${SHORT_MONTHS[month - 1]} ${year}`;
}

/**
 * Recompose AdditionalNotes for Save / Save Draft.
 * Preserves historical ReQueue lines exactly; appends current working notes.
 */
export function composeCounsellorAdditionalNotes(
  requeueEvents: RequeueNoteEvent[],
  workingNotes: string,
): string {
  const eventBlock = requeueEvents.map((e) => e.raw).join('\n');
  const working = workingNotes.replace(/^\n+/, '').replace(/\n+$/, '');
  if (!eventBlock) return working;
  if (!working) return eventBlock;
  return `${eventBlock}\n${working}`;
}

/**
 * Presentation-only History rows from AdditionalNotes markers when Auth has no
 * OwnershipRequeued trail (e.g. already-unassigned ReQueue). Does not invent Actor.
 */
export function requeueHistoryEntriesFromAdditionalNotes(
  additionalNotes: string | null | undefined,
  existingOwnershipRequeuedReasons: ReadonlySet<string>,
): Array<{
  id: string;
  changeType: 'OwnershipRequeued';
  oldValue: null;
  newValue: null;
  reason: string | null;
  changedAt: string;
  changedBy: string;
}> {
  const { requeueEvents } = parseCounsellorAdditionalNotes(additionalNotes);
  const out: Array<{
    id: string;
    changeType: 'OwnershipRequeued';
    oldValue: null;
    newValue: null;
    reason: string | null;
    changedAt: string;
    changedBy: string;
  }> = [];

  requeueEvents.forEach((event, index) => {
    const reasonKey = (event.reason || '').trim().toLowerCase();
    if (reasonKey && existingOwnershipRequeuedReasons.has(reasonKey)) return;
    out.push({
      id: `requeue-notes-${event.date}-${index}`,
      changeType: 'OwnershipRequeued',
      oldValue: null,
      newValue: null,
      reason: event.reason || null,
      // Date-only marker — midday UTC so History shows the calendar day without inventing a clock time from CounselorId.
      changedAt: `${event.date}T12:00:00.000Z`,
      changedBy: '',
    });
  });

  return out;
}
