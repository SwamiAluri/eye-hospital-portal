/**
 * Follow-up Center presentation helpers.
 * Phase2Y (PD5/PD6): no generic DueDate/SLA; no formal priority / AlertLevel urgency chrome.
 * Due-date heuristics (+7 / +30 / +14) are intentionally not used —
 * server populations and stats are authoritative (Phase 2B / 2F / 2X / 2Y).
 */

import type { PatientIntention } from '@/types/counsellors-desk';

/** Active-tab intentions supported by GET /Counseling/followups/active (backend allowlist). */
export const ACTIVE_FOLLOWUP_INTENTIONS = [
  { value: '', label: 'All intentions' },
  { value: 'WillingWeek', label: 'Willing — This Week' },
  { value: 'WillingMonth', label: 'Willing — This Month' },
  { value: 'WillingQuarter', label: 'Willing — This Quarter' },
  { value: 'WillingCallToConfirm', label: 'Pending Call' },
  { value: 'Undecided', label: 'Undecided' },
  { value: 'WaitingFinancial', label: 'Waiting — Finance' },
  { value: 'WaitingFear', label: 'Waiting — Fear' },
] as const;

export const FOLLOWUP_TABS = [
  { id: 'active' as const, label: 'Active' },
  { id: 'cold' as const, label: 'Cold Leads' },
  { id: 'post-surgery' as const, label: 'Post-Surgery' },
] as const;

/** Phase2Y: factual discharge aging KPI — not due/SLA/overdue/priority. */
export const POST_DISCHARGE_AGING_KPI_LABEL = 'Discharged ≥30 days';

export type FollowupTabId = (typeof FOLLOWUP_TABS)[number]['id'];

export const INTENTION_LABEL: Record<string, string> = {
  WillingWeek: 'Willing — This Week',
  WillingMonth: 'Willing — This Month',
  WillingQuarter: 'Willing — This Quarter',
  WillingCallToConfirm: 'Pending Call',
  Undecided: 'Undecided',
  WaitingFinancial: 'Waiting — Finance',
  WaitingFear: 'Waiting — Fear',
  Declined: 'Declined',
  ReferredElsewhere: 'Referred Elsewhere',
};

/** Map intention → counselling statusPill family (no marketing blues). */
export function intentionPillClass(intention: string | null | undefined): string {
  switch (intention as PatientIntention | string) {
    case 'Declined':
    case 'ReferredElsewhere':
      return 'bg-red-100 text-red-900';
    case 'WaitingFinancial':
    case 'WaitingFear':
    case 'Undecided':
      return 'bg-amber-100 text-amber-900';
    case 'WillingWeek':
    case 'WillingMonth':
    case 'WillingQuarter':
    case 'WillingCallToConfirm':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-counselling-muted/70 text-counselling-foreground';
  }
}

/** Fluid worklist grid — Patient | Context | Status | Contact | Action */
export const FOLLOWUP_WORK_GRID =
  'grid w-full min-w-0 grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto] gap-x-2 items-center';

export function formatFollowupShortDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/** Format nullable averageAttempts from /followups/stats (null when population empty). */
export function formatFollowupAverage(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
