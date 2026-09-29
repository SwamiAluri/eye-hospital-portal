/**
 * FollowupAgingTable — pending-decision sessions bucketed by days since session.
 * Population: PendingDecision == true (NOT the Follow-up Center Active intention allowlist).
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cgx1WorklistHeaderClass } from '@/lib/counsellors-desk/sessions-list-presentation';
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
import {
  buildAgingBucketSessionsHref,
  buildAgingPendingSessionsHref,
  buildFollowupCenterHref,
  type AgingBucketKey,
} from '@/lib/counsellors-desk/analytics-drilldown';

export const AGING_ANALYTICS_PERIODS = [
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 180, label: '180d' },
  { value: 365, label: '365d' },
] as const;

const BUCKET_CONFIG: {
  key: AgingBucketKey;
  label: string;
  pill: string;
  borderClass: string;
}[] = [
  {
    key: 'bucket_15_plus',
    label: '15+ days',
    pill: counsellingSessionTokens.statusPillDanger,
    borderClass: 'border-red-200',
  },
  {
    key: 'bucket_8_14',
    label: '8–14 days',
    pill: 'bg-orange-100 text-orange-900',
    borderClass: 'border-orange-200',
  },
  {
    key: 'bucket_4_7',
    label: '4–7 days',
    pill: counsellingSessionTokens.statusPillRequired,
    borderClass: 'border-amber-200',
  },
  {
    key: 'bucket_0_3',
    label: '0–3 days',
    pill: counsellingSessionTokens.statusPillComplete,
    borderClass: 'border-emerald-200',
  },
];

function BucketPanel({
  config,
  sessions,
  count,
  truncated,
  onOpenSession,
  onOpenBucketList,
}: {
  config: (typeof BUCKET_CONFIG)[number];
  sessions: AgingSession[];
  count: number;
  truncated: boolean;
  onOpenSession: (id: string) => void;
  onOpenBucketList: () => void;
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
      <div className="flex w-full items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:bg-counselling-muted/40',
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
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-counselling-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-counselling-muted-foreground" />
          )}
        </button>
        <CounsellingButton
          type="button"
          variant="ghost"
          size="sm"
          className="!min-h-7 h-7 shrink-0 px-2 text-xs"
          onClick={onOpenBucketList}
          data-testid={`analytics-aging-bucket-list-${config.key}`}
        >
          List
        </CounsellingButton>
      </div>

      {open && sessions.length > 0 && (
        <div className="overflow-x-auto border-t border-counselling-border/40">
          <table className="w-full min-w-[28rem] text-xs" aria-label={`${config.label} pending decisions`}>
            <thead>
              <tr className="bg-counselling-muted/20">
                <th scope="col" className={cn('px-3 py-1.5 text-left', cgx1WorklistHeaderClass)}>
                  Patient
                </th>
                <th scope="col" className={cn('px-3 py-1.5 text-left', cgx1WorklistHeaderClass)}>
                  Surgery
                </th>
                <th scope="col" className={cn('px-3 py-1.5 text-left', cgx1WorklistHeaderClass)}>
                  Phone
                </th>
                <th scope="col" className={cn('px-3 py-1.5 text-right', cgx1WorklistHeaderClass)}>
                  Days
                </th>
                <th scope="col" className={cn('px-3 py-1.5 text-right', cgx1WorklistHeaderClass)}>
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
  agingPeriod,
  onAgingPeriodChange,
}: {
  filters: CounselorAnalyticsFilters;
  agingPeriod: number;
  onAgingPeriodChange: (period: number) => void;
}) {
  const router = useRouter();
  const agingFilters = { ...filters, period: agingPeriod };
  const { data, isLoading, isError, refetch } = useCounselorFollowupAging(agingFilters);

  const agingContext = {
    branchId: filters.branchId,
    counselorId: filters.counselorId,
    agingFrom: data?.from?.slice(0, 10),
    agingToExclusive: data?.toExclusive?.slice(0, 10),
  };

  const openSession = (id: string) => {
    router.push(`/dashboard/counsellors-desk/${id}?from=analytics`);
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
        <div className="min-w-0">
          <h2 className={counsellingSessionTokens.sessionWidgetTitle}>
            <Clock className="h-4 w-4 text-amber-600" aria-hidden />
            PendingDecision Aging
            {data.totalPending > 0 && (
              <span className="ml-1 flex items-center gap-1 text-xs font-normal text-amber-800">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {data.totalPending} pending decision
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-[10px] text-counselling-muted-foreground">
            Separate pending-decision backlog — not Follow-up Center Active queue
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Aging period"
            className={cn(counsellingSessionTokens.pillTabTrack, 'flex-nowrap')}
            data-testid="analytics-aging-period"
          >
            {AGING_ANALYTICS_PERIODS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onAgingPeriodChange(o.value)}
                className={cn(
                  counsellingSessionTokens.pillTab,
                  'shrink-0 text-xs',
                  agingPeriod === o.value && counsellingSessionTokens.pillTabCurrent,
                )}
                data-testid={`analytics-aging-period-${o.value}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <CounsellingButton
            type="button"
            variant="outline"
            size="sm"
            className="!min-h-7 h-7 text-xs"
            onClick={() => router.push(buildAgingPendingSessionsHref(agingContext))}
            data-testid="analytics-aging-open-pending-list"
          >
            Pending list
          </CounsellingButton>
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            className="!min-h-7 h-7 text-xs text-counselling-muted-foreground"
            onClick={() => router.push(buildFollowupCenterHref())}
            data-testid="analytics-aging-open-followup-center"
          >
            Follow-up workload
          </CounsellingButton>
        </div>
      </div>

      <div className="space-y-2">
        {BUCKET_CONFIG.map((cfg) => {
          const sessions = data.buckets[cfg.key as keyof AgingBuckets];
          const count = data.counts?.[cfg.key as keyof AgingBuckets] ?? sessions.length;
          return (
            <BucketPanel
              key={cfg.key}
              config={cfg}
              sessions={sessions}
              count={count}
              truncated={truncated}
              onOpenSession={openSession}
              onOpenBucketList={() => {
                const href = buildAgingBucketSessionsHref(agingContext, cfg.key);
                if (href) router.push(href);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
