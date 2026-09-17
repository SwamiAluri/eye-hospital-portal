/**
 * Phase 2Z — Analytics drill-down URL builders.
 * PendingDecision NEVER routes to Active Follow-up Center (surgery-followup).
 */

export type AgingBucketKey = 'bucket_0_3' | 'bucket_4_7' | 'bucket_8_14' | 'bucket_15_plus';

export type SessionListDrillFilters = {
  branchId?: string | null;
  counselorId?: string | null;
  sessionDateFrom?: string;
  sessionDateTo?: string;
  pendingDecision?: boolean;
  patientAgreedToSurgery?: boolean;
  recommendedSurgery?: string;
  /** Display-only chip label — not sent to sessions API */
  analyticsOutcome?: string;
  agingBucket?: AgingBucketKey;
};

export type AnalyticsWindowContext = {
  branchId?: string | null;
  counselorId?: string | null;
  from?: string;
  toExclusive?: string;
};

export type AgingWindowContext = AnalyticsWindowContext & {
  agingFrom?: string;
  agingToExclusive?: string;
};

const SESSIONS_PATH = '/dashboard/counsellors-desk/sessions';
const FOLLOWUP_CENTER_PATH = '/dashboard/counsellors-desk/surgery-followup';

/** UTC calendar date yyyy-MM-dd */
export function formatUtcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function utcToday(): string {
  return formatUtcDate(new Date());
}

export function subtractUtcDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return formatUtcDate(d);
}

/** Analytics half-open [from, toExclusive) → inclusive SessionDateTo (date only). */
export function analyticsWindowToSessionDates(
  from?: string,
  toExclusive?: string,
): Pick<SessionListDrillFilters, 'sessionDateFrom' | 'sessionDateTo'> {
  if (!from || !toExclusive) return {};
  return {
    sessionDateFrom: from.slice(0, 10),
    sessionDateTo: subtractUtcDays(toExclusive.slice(0, 10), 1),
  };
}

function intersectInclusiveRanges(
  aFrom: string,
  aTo: string,
  bFrom?: string,
  bTo?: string,
): { sessionDateFrom: string; sessionDateTo: string } | null {
  const from = bFrom && bFrom > aFrom ? bFrom : aFrom;
  const to = bTo && bTo < aTo ? bTo : aTo;
  if (from > to) return null;
  return { sessionDateFrom: from, sessionDateTo: to };
}

/** Bucket bounds (UTC), intersected with optional aging window. */
export function agingBucketSessionDates(
  bucket: AgingBucketKey,
  agingFrom?: string,
  agingToExclusive?: string,
  today: string = utcToday(),
): Pick<SessionListDrillFilters, 'sessionDateFrom' | 'sessionDateTo'> | null {
  const agingDates = analyticsWindowToSessionDates(agingFrom, agingToExclusive);
  const agingFromDate = agingDates.sessionDateFrom;
  const agingToDate = agingDates.sessionDateTo;

  let bucketFrom: string;
  let bucketTo: string;

  switch (bucket) {
    case 'bucket_0_3':
      bucketFrom = subtractUtcDays(today, 3);
      bucketTo = today;
      break;
    case 'bucket_4_7':
      bucketFrom = subtractUtcDays(today, 7);
      bucketTo = subtractUtcDays(today, 4);
      break;
    case 'bucket_8_14':
      bucketFrom = subtractUtcDays(today, 14);
      bucketTo = subtractUtcDays(today, 8);
      break;
    case 'bucket_15_plus': {
      bucketFrom = agingFromDate ?? '1970-01-01';
      bucketTo = subtractUtcDays(today, 15);
      if (agingFromDate && agingFromDate > bucketTo) return null;
      return intersectInclusiveRanges(bucketFrom, bucketTo, agingFromDate, agingToDate);
    }
    default:
      return null;
  }

  return intersectInclusiveRanges(bucketFrom, bucketTo, agingFromDate, agingToDate);
}

export function buildSessionListHref(filters: SessionListDrillFilters): string {
  const params = new URLSearchParams();
  if (filters.branchId) params.set('branchId', filters.branchId);
  if (filters.counselorId) params.set('counselorId', filters.counselorId);
  if (filters.sessionDateFrom) params.set('sessionDateFrom', filters.sessionDateFrom);
  if (filters.sessionDateTo) params.set('sessionDateTo', filters.sessionDateTo);
  if (filters.pendingDecision != null) {
    params.set('pendingDecision', String(filters.pendingDecision));
  }
  if (filters.patientAgreedToSurgery != null) {
    params.set('patientAgreedToSurgery', String(filters.patientAgreedToSurgery));
  }
  if (filters.recommendedSurgery) params.set('recommendedSurgery', filters.recommendedSurgery);
  if (filters.analyticsOutcome) params.set('analyticsOutcome', filters.analyticsOutcome);
  if (filters.agingBucket) params.set('agingBucket', filters.agingBucket);
  const qs = params.toString();
  return `${SESSIONS_PATH}${qs ? `?${qs}` : ''}`;
}

function withWindow(ctx: AnalyticsWindowContext): SessionListDrillFilters {
  return {
    branchId: ctx.branchId,
    counselorId: ctx.counselorId,
    ...analyticsWindowToSessionDates(ctx.from, ctx.toExclusive),
  };
}

export function buildTotalSessionsHref(ctx: AnalyticsWindowContext): string {
  return buildSessionListHref({ ...withWindow(ctx), analyticsOutcome: 'Total' });
}

/** PD13 Agreed partition = Agreed && !Pending (Pending+Agreed is PendingDecision). */
export function buildAgreedSessionsHref(ctx: AnalyticsWindowContext): string {
  return buildSessionListHref({
    ...withWindow(ctx),
    patientAgreedToSurgery: true,
    pendingDecision: false,
    analyticsOutcome: 'Agreed',
  });
}

export function buildDeclinedSessionsHref(ctx: AnalyticsWindowContext): string {
  return buildSessionListHref({
    ...withWindow(ctx),
    patientAgreedToSurgery: false,
    pendingDecision: false,
    analyticsOutcome: 'Declined',
  });
}

export function buildPendingDecisionSessionsHref(ctx: AnalyticsWindowContext): string {
  return buildSessionListHref({
    ...withWindow(ctx),
    pendingDecision: true,
    analyticsOutcome: 'Pending Decision',
  });
}

/** Conversion KPI drill-down — same population as Agreed; label Conversion for PD15. */
export function buildConversionSessionsHref(ctx: AnalyticsWindowContext): string {
  return buildSessionListHref({
    ...withWindow(ctx),
    patientAgreedToSurgery: true,
    pendingDecision: false,
    analyticsOutcome: 'Conversion',
  });
}

export function buildSurgerySessionsHref(
  ctx: AnalyticsWindowContext,
  recommendedSurgery: string,
): string {
  return buildSessionListHref({
    ...withWindow(ctx),
    recommendedSurgery,
    analyticsOutcome: recommendedSurgery,
  });
}

export function buildAgingPendingSessionsHref(ctx: AgingWindowContext): string {
  const dates = analyticsWindowToSessionDates(ctx.agingFrom ?? ctx.from, ctx.agingToExclusive ?? ctx.toExclusive);
  return buildSessionListHref({
    branchId: ctx.branchId,
    counselorId: ctx.counselorId,
    ...dates,
    pendingDecision: true,
    analyticsOutcome: 'Pending Decision Aging',
  });
}

export function buildAgingBucketSessionsHref(
  ctx: AgingWindowContext,
  bucket: AgingBucketKey,
): string | null {
  const dates = agingBucketSessionDates(
    bucket,
    ctx.agingFrom ?? ctx.from,
    ctx.agingToExclusive ?? ctx.toExclusive,
  );
  if (!dates) return null;
  return buildSessionListHref({
    branchId: ctx.branchId,
    counselorId: ctx.counselorId,
    ...dates,
    pendingDecision: true,
    agingBucket: bucket,
    analyticsOutcome: `Pending ${bucket.replace('bucket_', '').replace('_', '–')}`,
  });
}

/** Follow-up workload only — NOT for PendingDecision aging. */
export function buildFollowupCenterHref(): string {
  return FOLLOWUP_CENTER_PATH;
}
