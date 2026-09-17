'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { AnalyticsSummary } from '@/hooks/use-counselor-analytics';
import {
  funnelStagePercentage,
  type FunnelPctStage,
} from '@/lib/counsellors-desk/analytics-funnel-pct';

/** PD13 mutually exclusive outcome stages — do not imply overlapping counts. */
const OUTCOME_STAGES = [
  { key: 'agreedCount' as const, label: 'Agreed', color: '#059669' },
  { key: 'declinedCount' as const, label: 'Declined', color: '#b91c1c' },
  { key: 'pendingDecisionCount' as const, label: 'Pending Decision', color: '#d97706' },
  { key: 'exceptionCount' as const, label: 'Exception', color: '#7c3aed' },
  { key: 'otherUnclassifiedCount' as const, label: 'Other/Unclassified', color: '#6b7280' },
] as const;

interface TooltipPayload {
  payload?: {
    stage: string;
    count: number;
    pct: number | null;
    denominator: string;
    showEligiblePct: boolean;
  };
}

function FunnelTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.[0]?.payload) return null;
  const { stage, count, pct, denominator, showEligiblePct } = payload[0].payload;
  return (
    <div className="rounded-lg border border-counselling-border bg-counselling-card px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-counselling-foreground">{stage}</p>
      <p className="mt-0.5 text-counselling-muted-foreground">
        {count} sessions
        {showEligiblePct && pct != null && (
          <>
            &nbsp;
            <span className="font-medium text-counselling-foreground">({pct}%)</span>
          </>
        )}
      </p>
      <p className="mt-0.5 text-[10px] text-counselling-muted-foreground">vs {denominator}</p>
    </div>
  );
}

export type FunnelStageKey =
  | 'total'
  | 'agreedCount'
  | 'declinedCount'
  | 'pendingDecisionCount'
  | 'exceptionCount'
  | 'otherUnclassifiedCount';

interface Props {
  data: AnalyticsSummary;
  className?: string;
  onStageClick?: (stage: FunnelStageKey) => void;
}

function resolvePendingCount(data: AnalyticsSummary): number {
  return data.pendingDecisionCount ?? data.undecidedCount ?? 0;
}

export function ConversionFunnelChart({ data, className, onStageClick }: Props) {
  if (data.totalSessions === 0) {
    return (
      <div
        className={cn(
          'flex h-36 items-center justify-center text-sm text-counselling-muted-foreground',
          className,
        )}
        data-testid="analytics-funnel-empty"
      >
        No session data for this period
      </div>
    );
  }

  const eligible = data.eligibleOutcomeSessions ?? 0;
  const pendingCount = resolvePendingCount(data);

  const totalPct = funnelStagePercentage('total', data.totalSessions, data.totalSessions, eligible);
  const totalEntry = {
    stageKey: 'total' as const,
    stage: 'Total',
    count: data.totalSessions,
    pct: totalPct.pct,
    showEligiblePct: totalPct.showEligiblePct,
    color: '#0f766e',
    denominator: totalPct.denominatorLabel,
    clickable: !!onStageClick,
  };

  const outcomeEntries = OUTCOME_STAGES.map((s) => {
    const count =
      s.key === 'pendingDecisionCount' ? pendingCount : (data[s.key] ?? 0);
    const pctResult = funnelStagePercentage(
      s.key as FunnelPctStage,
      count,
      data.totalSessions,
      eligible,
    );
    return {
      stageKey: s.key,
      stage: s.label,
      count,
      pct: pctResult.pct,
      showEligiblePct: pctResult.showEligiblePct,
      color: s.color,
      denominator: pctResult.denominatorLabel,
      clickable: !!onStageClick && s.key !== 'exceptionCount' && s.key !== 'otherUnclassifiedCount',
    };
  });

  const chartData = [totalEntry, ...outcomeEntries];

  return (
    <div className={cn('min-w-0', className)} data-testid="analytics-funnel-chart">
      <ResponsiveContainer width="100%" height={168}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="stage"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={48}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<FunnelTooltip />} cursor={{ fill: '#f3f4f6' }} />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            onClick={(entry) => {
              if (!onStageClick || !entry?.stageKey) return;
              if (entry.clickable) onStageClick(entry.stageKey as FunnelStageKey);
            }}
            style={{ cursor: onStageClick ? 'pointer' : undefined }}
          >
            {chartData.map((entry) => (
              <Cell key={entry.stage} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="mt-1 text-[10px] text-counselling-muted-foreground">
        Mutually exclusive outcomes. Agreed / Declined / Pending % use eligible ({eligible} = Total −
        Exception − Other). Exception and Other are counts only (included in Total).
      </p>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {chartData.map((entry) => (
          <button
            key={entry.stage}
            type="button"
            disabled={!entry.clickable}
            onClick={() => {
              if (entry.clickable && onStageClick) onStageClick(entry.stageKey);
            }}
            className={cn(
              'flex flex-col items-center gap-0.5',
              entry.clickable && 'cursor-pointer hover:opacity-80',
              !entry.clickable && 'cursor-default',
            )}
            data-testid={`analytics-funnel-stage-${entry.stageKey}`}
          >
            <span className="text-[10px] font-semibold tabular-nums" style={{ color: entry.color }}>
              {entry.showEligiblePct && entry.pct != null ? `${entry.pct}%` : `${entry.count}`}
            </span>
            <span className="text-[10px] text-counselling-muted-foreground">{entry.stage}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
