/**
 * FollowupAgingTable — pending-decision sessions bucketed by days since session.
 * Population: PendingDecision == true (NOT the Follow-up Center Active intention allowlist).
 * Fetches GET /counseling/analytics/followup-aging (Phase 2D).
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import {
  useCounselorFollowupAging,
  type AgingSession,
  type AgingBuckets,
  type CounselorAnalyticsFilters,
} from '@/hooks/use-counselor-analytics';

const BUCKET_CONFIG = [
  {
    key: 'bucket_15_plus' as keyof AgingBuckets,
    label: '15+ days',
    urgency: 'Critical',
    pill: counsellingSessionTokens.statusPillDanger,
    borderClass: 'border-red-200',
  },
  {
    key: 'bucket_8_14' as keyof AgingBuckets,
    label: '8–14 days',
    urgency: 'High',
    pill: 'bg-orange-100 text-orange-900',
    borderClass: 'border-orange-200',
  },
  {
    key: 'bucket_4_7' as keyof AgingBuckets,
    label: '4–7 days',
    urgency: 'Medium',
    pill: counsellingSessionTokens.statusPillRequired,
    borderClass: 'border-amber-200',
  },
  {
    key: 'bucket_0_3' as keyof AgingBuckets,
    label: '0–3 days',
    urgency: 'Normal',
    pill: counsellingSessionTokens.statusPillComplete,
    borderClass: 'border-emerald-200',
  },
] as const;

function BucketPanel({
  config,
  sessions,
  count,
  truncated,
  onOpenSession,
}: {
  config: (typeof BUCKET_CONFIG)[number];
  sessions: AgingSession[];
  count: number;
  truncated: boolean;
  onOpenSession: (id: string) => void;
}) {
  const [open, setOpen] = useState(config.key === 'bucket_15_plus');

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-counselling-border/70',
        config.borderClass,
      )}
      data-testid={`analytics-aging-bucket-${config.key}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-counselling-muted/40',
          open && 'bg-counselling-muted/30',
        )}
      >
        <span className="flex-1 text-sm font-semibold text-counselling-foreground">
          {config.label}
        </span>
        <span className={cn(counsellingSessionTokens.statusPill, config.pill)}>
          {count}
          {truncated && count > sessions.length ? '+' : ''}
        </span>
        <span className="w-14 flex-shrink-0 text-right text-xs text-counselling-muted-foreground">
          {config.urgency}
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-counselling-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-counselling-muted-foreground" />
        )}
      </button>

      {open && sessions.length > 0 && (
        <div className="overflow-x-auto border-t border-counselling-border/40">
          <table className="w-full min-w-[28rem] text-xs" aria-label={`${config.label} pending decisions`}>
            <thead>
              <tr className="bg-counselling-muted/20">
                <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                  Patient
                </th>
                <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                  Surgery
                </th>
                <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                  Phone
                </th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                  Days
                </th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-counselling-border/40">
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-counselling-muted/20"
                  data-testid="analytics-aging-row"
                >
                  <td className="max-w-[160px] truncate px-3 py-2 font-medium text-counselling-foreground">
                    {s.patientName}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 text-counselling-muted-foreground">
                    {s.recommendedSurgery ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-counselling-muted-foreground">
                    {s.phone ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn(counsellingSessionTokens.statusPill, config.pill)}>
                      {s.daysSinceSession}d
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CounsellingButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!min-h-7 h-7 px-2 text-xs"
                      onClick={() => onOpenSession(s.id)}
                      data-testid="analytics-aging-open-session"
                    >
                      Open
                    </CounsellingButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && sessions.length === 0 && (
        <p className="border-t border-counselling-border/40 py-3 text-center text-xs text-counselling-muted-foreground">
          No patients in this range
        </p>
      )}
    </div>
  );
}

export function FollowupAgingTable({
  filters,
}: {
  filters: CounselorAnalyticsFilters;
}) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useCounselorFollowupAging(filters);

  const openSession = (id: string) => {
    router.push(`/dashboard/counsellors-desk/${id}`);
  };

  if (isLoading) {
    return (
      <div
        className={cn(counsellingSessionTokens.sessionWidget, 'p-4')}
        data-testid="analytics-aging-loading"
        aria-hidden
      >
        <div className="mb-3 h-5 w-48 animate-pulse rounded bg-counselling-muted" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-counselling-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={cn(counsellingSessionTokens.sessionWidget, 'p-4 text-center')}
        data-testid="analytics-aging-error"
        role="alert"
      >
        <p className="text-sm text-counselling-muted-foreground">
          Failed to load follow-up aging data
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-1 text-xs font-medium text-counselling-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const truncated = data.truncated === true;

  return (
    <div
      className={cn(counsellingSessionTokens.sessionWidget, 'p-3 min-[1600px]:p-4')}
      data-testid="analytics-aging"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className={counsellingSessionTokens.sessionWidgetTitle}>
          <Clock className="h-4 w-4 text-amber-600" aria-hidden />
          Follow-up Aging
          {data.totalPending > 0 && (
            <span className="ml-1 flex items-center gap-1 text-xs font-normal text-amber-800">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {data.totalPending} pending decision
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] text-counselling-muted-foreground">
            PendingDecision only — not Follow-up Center Active queue
          </p>
          <CounsellingButton
            type="button"
            variant="outline"
            size="sm"
            className="!min-h-7 h-7 text-xs"
            onClick={() => router.push('/dashboard/counsellors-desk/surgery-followup')}
            data-testid="analytics-aging-open-followup-center"
          >
            Follow-up Center
          </CounsellingButton>
        </div>
      </div>

      <div className="space-y-2">
        {BUCKET_CONFIG.map((cfg) => {
          const sessions = data.buckets[cfg.key];
          const count = data.counts?.[cfg.key] ?? sessions.length;
          return (
            <BucketPanel
              key={cfg.key}
              config={cfg}
              sessions={sessions}
              count={count}
              truncated={truncated}
              onOpenSession={openSession}
            />
          );
        })}
      </div>
    </div>
  );
}
