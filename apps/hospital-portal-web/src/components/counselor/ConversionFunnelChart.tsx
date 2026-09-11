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

/** Funnel stages map 1:1 to GetAnalyticsSummary fields — do not invent stages. */
const STAGES = [
  { key: 'totalSessions' as const, label: 'Total', color: '#0f766e' },
  { key: 'agreedCount' as const, label: 'Agreed', color: '#059669' },
  { key: 'undecidedCount' as const, label: 'Undecided', color: '#d97706' },
  { key: 'declinedCount' as const, label: 'Declined', color: '#b91c1c' },
];

interface TooltipPayload {
  payload?: { stage: string; count: number; pct: number };
}

function FunnelTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.[0]?.payload) return null;
  const { stage, count, pct } = payload[0].payload;
  return (
    <div className="rounded-lg border border-counselling-border bg-counselling-card px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-counselling-foreground">{stage}</p>
      <p className="mt-0.5 text-counselling-muted-foreground">
        {count} sessions&nbsp;
        <span className="font-medium text-counselling-foreground">({pct}%)</span>
      </p>
    </div>
  );
}

interface Props {
  data: AnalyticsSummary;
  className?: string;
}

export function ConversionFunnelChart({ data, className }: Props) {
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

  const chartData = STAGES.map((s) => ({
    stage: s.label,
    count: data[s.key],
    pct: Math.round((data[s.key] / data.totalSessions) * 100),
    color: s.color,
  }));

  return (
    <div className={cn('min-w-0', className)} data-testid="analytics-funnel-chart">
      <ResponsiveContainer width="100%" height={148}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="stage"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<FunnelTooltip />} cursor={{ fill: '#f3f4f6' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={52}>
            {chartData.map((entry) => (
              <Cell key={entry.stage} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-1 flex items-center justify-around">
        {chartData.map((entry) => (
          <div key={entry.stage} className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-semibold tabular-nums" style={{ color: entry.color }}>
              {entry.pct}%
            </span>
            <span className="text-[10px] text-counselling-muted-foreground">{entry.stage}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
