/**
 * Counselling Sessions register — drill-down chip and empty-state presentation.
 * Query parameters stay filters. Removing a chip does not change ownership.
 */

import { format, isValid, parseISO } from 'date-fns';
import { formatSessionListStatus } from './sessions-list-presentation';
import { setSessionsPageInSearchParams } from './sessions-pagination';

export const SESSIONS_STATUS_VALUES = [
  'Scheduled',
  'InProgress',
  'Completed',
  'Cancelled',
  'NoShow',
] as const;

export type SessionsStatusValue = (typeof SESSIONS_STATUS_VALUES)[number];

export type SessionsDecisionFilter = '' | 'Pending' | 'Agreed' | 'Declined';

/** Query keys Clear removes, including Reassignment Required now that it is a filter. */
export const SESSIONS_CLEAR_KEYS = [
  'analyticsOutcome',
  'agingBucket',
  'pendingDecision',
  'patientAgreedToSurgery',
  'sessionDateFrom',
  'sessionDateTo',
  'recommendedSurgery',
  'counselorId',
  'branchId',
  'status',
  'search',
  'reassignmentRequired',
] as const;

/** @deprecated Use SESSIONS_CLEAR_KEYS. Kept so older imports still name the drill-down set. */
export const SESSIONS_DRILLDOWN_KEYS = [
  'analyticsOutcome',
  'agingBucket',
  'pendingDecision',
  'patientAgreedToSurgery',
  'sessionDateFrom',
  'sessionDateTo',
  'recommendedSurgery',
  'counselorId',
  'branchId',
] as const;

const ORDINARY_FILTER_KEYS = [
  'pendingDecision',
  'patientAgreedToSurgery',
  'sessionDateFrom',
  'sessionDateTo',
  'recommendedSurgery',
  'counselorId',
  'branchId',
  'status',
  'search',
] as const;

export type SessionsRegisterDraft = {
  counselorId: string;
  status: '' | SessionsStatusValue;
  decision: SessionsDecisionFilter;
  sessionDateFrom: string;
  sessionDateTo: string;
  recommendedSurgery: string;
  reassignmentRequired: boolean;
  branchId: string;
};

export type SessionsFilterChipModel = {
  id: string;
  label: string;
  removeAriaLabel: string;
  removeKeys: readonly string[];
};

function parseBoolParam(value: string | null): boolean | undefined {
  if (value == null || value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function asParams(search: URLSearchParams | string): URLSearchParams {
  return typeof search === 'string' ? new URLSearchParams(search) : new URLSearchParams(search.toString());
}

export function shouldShowAnalyticsContext(analyticsOutcome: string | null | undefined): boolean {
  return Boolean(analyticsOutcome && analyticsOutcome.trim());
}

function hasParam(params: URLSearchParams, key: string): boolean {
  const value = params.get(key);
  return value != null && value !== '';
}

export function hasSessionsOrdinaryFilters(search: URLSearchParams | string): boolean {
  const params = asParams(search);
  return ORDINARY_FILTER_KEYS.some((key) => hasParam(params, key));
}

export function hasSessionsDrilldownFilters(search: URLSearchParams | string): boolean {
  return hasSessionsOrdinaryFilters(search);
}

export function readSessionsDecision(search: URLSearchParams | string): SessionsDecisionFilter {
  const params = asParams(search);
  const pending = parseBoolParam(params.get('pendingDecision'));
  const agreed = parseBoolParam(params.get('patientAgreedToSurgery'));
  if (pending === true && agreed == null) return 'Pending';
  if (pending === false && agreed === true) return 'Agreed';
  if (pending === false && agreed === false) return 'Declined';
  if (pending === true) return 'Pending';
  if (agreed === true) return 'Agreed';
  if (agreed === false) return 'Declined';
  return '';
}

export function readSessionsRegisterDraft(search: URLSearchParams | string): SessionsRegisterDraft {
  const params = asParams(search);
  const statusRaw = params.get('status') ?? '';
  const status = (SESSIONS_STATUS_VALUES as readonly string[]).includes(statusRaw)
    ? (statusRaw as SessionsStatusValue)
    : '';
  return {
    counselorId: params.get('counselorId')?.trim() ?? '',
    status,
    decision: readSessionsDecision(params),
    sessionDateFrom: params.get('sessionDateFrom')?.slice(0, 10) ?? '',
    sessionDateTo: params.get('sessionDateTo')?.slice(0, 10) ?? '',
    recommendedSurgery: params.get('recommendedSurgery')?.trim() ?? '',
    reassignmentRequired: params.get('reassignmentRequired') === 'true' || params.get('reassignmentRequired') === '1',
    branchId: params.get('branchId')?.trim() ?? '',
  };
}

const OUTCOME_LABELS = new Set([
  'Agreed',
  'Declined',
  'Conversion',
  'Pending Decision',
  'Pending Decision Aging',
  'Total',
]);

/** Writes sheet fields onto the list query. Does not assign ownership. */
export function applySessionsRegisterDraft(
  current: URLSearchParams,
  draft: SessionsRegisterDraft,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  const previousDecision = readSessionsDecision(current);
  const previousSurgery = current.get('recommendedSurgery');
  const previousOutcome = current.get('analyticsOutcome');

  if (draft.counselorId) next.set('counselorId', draft.counselorId);
  else next.delete('counselorId');

  if (draft.status) next.set('status', draft.status);
  else next.delete('status');

  if (draft.sessionDateFrom) next.set('sessionDateFrom', draft.sessionDateFrom);
  else next.delete('sessionDateFrom');
  if (draft.sessionDateTo) next.set('sessionDateTo', draft.sessionDateTo);
  else next.delete('sessionDateTo');
  if (!draft.sessionDateFrom && !draft.sessionDateTo) next.delete('agingBucket');

  if (draft.recommendedSurgery) next.set('recommendedSurgery', draft.recommendedSurgery.trim());
  else next.delete('recommendedSurgery');
  if (previousOutcome && previousOutcome === previousSurgery && draft.recommendedSurgery.trim() !== previousSurgery) {
    next.delete('analyticsOutcome');
  }

  if (draft.decision === 'Pending') {
    next.set('pendingDecision', 'true');
    next.delete('patientAgreedToSurgery');
  } else if (draft.decision === 'Agreed') {
    next.set('pendingDecision', 'false');
    next.set('patientAgreedToSurgery', 'true');
  } else if (draft.decision === 'Declined') {
    next.set('pendingDecision', 'false');
    next.set('patientAgreedToSurgery', 'false');
  } else {
    next.delete('pendingDecision');
    next.delete('patientAgreedToSurgery');
  }
  if (draft.decision !== previousDecision && previousOutcome && isOutcomeLabel(previousOutcome)) {
    next.delete('analyticsOutcome');
  }

  if (draft.reassignmentRequired) next.set('reassignmentRequired', 'true');
  else next.delete('reassignmentRequired');

  if (draft.branchId) next.set('branchId', draft.branchId);
  else next.delete('branchId');

  return setSessionsPageInSearchParams(next, 1);
}

function isOutcomeLabel(value: string): boolean {
  if (OUTCOME_LABELS.has(value)) return true;
  return value.startsWith('Pending ');
}

function formatDay(iso: string): string {
  const parsed = parseISO(iso.slice(0, 10));
  if (!isValid(parsed)) return iso;
  return format(parsed, 'MMM d');
}

export function buildSessionsFilterChips(input: {
  search: URLSearchParams | string;
  counselorLabel?: string | null;
  branchLabel?: string | null;
}): SessionsFilterChipModel[] {
  const params = asParams(input.search);
  const chips: SessionsFilterChipModel[] = [];
  const analyticsOutcome = params.get('analyticsOutcome')?.trim() || undefined;
  const pending = parseBoolParam(params.get('pendingDecision'));
  const agreed = parseBoolParam(params.get('patientAgreedToSurgery'));
  const surgery = params.get('recommendedSurgery')?.trim() || undefined;

  const collapsedOutcome =
    (pending === false && agreed === true) ||
    (pending === false && agreed === false) ||
    (pending === true && agreed == null);

  if (pending === false && agreed === true) {
    const label = 'Decision: Agreed';
    chips.push({
      id: 'outcome',
      label,
      removeAriaLabel: `Remove ${label.replace('Decision: ', 'Decision ')} filter`,
      removeKeys: ['pendingDecision', 'patientAgreedToSurgery', 'analyticsOutcome'],
    });
  } else if (pending === false && agreed === false) {
    chips.push({
      id: 'outcome',
      label: 'Decision: Declined',
      removeAriaLabel: 'Remove Decision Declined filter',
      removeKeys: ['pendingDecision', 'patientAgreedToSurgery', 'analyticsOutcome'],
    });
  } else if (pending === true && agreed == null) {
    chips.push({
      id: 'outcome',
      label: 'Decision: Pending',
      removeAriaLabel: 'Remove Decision Pending filter',
      removeKeys: ['pendingDecision', 'analyticsOutcome'],
    });
  } else {
    if (pending === true || agreed === true || agreed === false || pending === false) {
      const label =
        pending === true
          ? 'Decision: Pending'
          : agreed === true
            ? 'Decision: Agreed'
            : agreed === false
              ? 'Decision: Declined'
              : 'Decision: Not pending';
      const removeKeys = ['pendingDecision', 'patientAgreedToSurgery', 'analyticsOutcome'];
      chips.push({
        id: 'outcome',
        label,
        removeAriaLabel: `Remove ${label.replace('Decision: ', 'Decision ')} filter`,
        removeKeys,
      });
    }
  }

  const status = params.get('status')?.trim();
  if (status) {
    const statusLabel = formatSessionListStatus(status) ?? status;
    chips.push({
      id: 'status',
      label: `Status: ${statusLabel}`,
      removeAriaLabel: `Remove Status ${statusLabel} filter`,
      removeKeys: ['status'],
    });
  }

  if (surgery) {
    const removeKeys = ['recommendedSurgery'];
    if (analyticsOutcome === surgery && !collapsedOutcome) {
      removeKeys.push('analyticsOutcome');
    }
    chips.push({
      id: 'surgery',
      label: `Surgery: ${surgery}`,
      removeAriaLabel: 'Remove surgery filter',
      removeKeys,
    });
  }

  const from = params.get('sessionDateFrom')?.trim() || '';
  const to = params.get('sessionDateTo')?.trim() || '';
  if (from || to) {
    const label = formatSessionsDateChip(from, to);
    const removeKeys = ['sessionDateFrom', 'sessionDateTo'];
    if (params.get('agingBucket')) removeKeys.push('agingBucket');
    chips.push({
      id: 'dates',
      label,
      removeAriaLabel: 'Remove date range filter',
      removeKeys,
    });
  }

  const counselorId = params.get('counselorId')?.trim();
  if (counselorId) {
    const name = input.counselorLabel?.trim();
    chips.push({
      id: 'counselor',
      label: name ? `Owner: ${name}` : 'Owner: Counselor filtered',
      removeAriaLabel: name ? `Remove Owner ${name} filter` : 'Remove owner filter',
      removeKeys: ['counselorId'],
    });
  }

  const branchId = params.get('branchId')?.trim();
  if (branchId) {
    const name = input.branchLabel?.trim();
    chips.push({
      id: 'branch',
      label: name ? `Branch: ${name}` : 'Branch: Branch filtered',
      removeAriaLabel: name ? `Remove Branch ${name} filter` : 'Remove branch filter',
      removeKeys: ['branchId'],
    });
  }

  const sessionNumber = params.get('search')?.trim();
  if (sessionNumber) {
    chips.push({
      id: 'search',
      label: `Session: ${sessionNumber}`,
      removeAriaLabel: 'Remove session number filter',
      removeKeys: ['search'],
    });
  }

  if (params.get('reassignmentRequired') === 'true' || params.get('reassignmentRequired') === '1') {
    chips.push({
      id: 'reassignment',
      label: 'Reassignment required',
      removeAriaLabel: 'Remove Reassignment required filter',
      removeKeys: ['reassignmentRequired'],
    });
  }

  return chips;
}

export function formatSessionsDateChip(from: string, to: string): string {
  if (from && to) {
    const start = parseISO(from.slice(0, 10));
    const end = parseISO(to.slice(0, 10));
    if (isValid(start) && isValid(end)) {
      const sameYear = start.getFullYear() === end.getFullYear();
      const left = format(start, sameYear ? 'MMM d' : 'MMM d, yyyy');
      const right = format(end, sameYear ? 'MMM d' : 'MMM d, yyyy');
      return `Date: ${left} – ${right}`;
    }
    return `Date: ${from} – ${to}`;
  }
  if (from) return `Date: From ${formatDay(from)}`;
  return `Date: Through ${formatDay(to)}`;
}

export function removeSessionsFilterChip(
  current: URLSearchParams,
  removeKeys: readonly string[],
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const key of removeKeys) next.delete(key);
  return setSessionsPageInSearchParams(next, 1);
}

export function clearSessionsDrilldownFilters(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const key of SESSIONS_CLEAR_KEYS) next.delete(key);
  return setSessionsPageInSearchParams(next, 1);
}

export function resolveSessionsEmptyCopy(input: {
  reassignmentRequired: boolean;
  hasDrilldownFilters: boolean;
}): { title: string; hint: string } {
  if (input.reassignmentRequired && input.hasDrilldownFilters) {
    return {
      title: 'No sessions require reassignment for these filters',
      hint: 'Clear filters to see every reassignment in your authorized branches.',
    };
  }
  if (input.reassignmentRequired) {
    return {
      title: 'No sessions require reassignment',
      hint: 'This list shows open sessions whose owner is inactive, removed, or no longer authorized for the branch.',
    };
  }
  if (input.hasDrilldownFilters) {
    return {
      title: 'No sessions match these filters',
      hint: 'Clear filters to see sessions in your authorized branches.',
    };
  }
  return {
    title: 'No counselling sessions',
    hint: 'Sessions in your authorized branches will show here.',
  };
}
