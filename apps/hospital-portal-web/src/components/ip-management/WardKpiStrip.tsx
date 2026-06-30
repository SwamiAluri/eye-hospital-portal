'use client';

import type { WardDashboardSummaryDto } from '@/lib/api/ip-management.api';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

type MetricKey = keyof Pick<
  WardDashboardSummaryDto,
  'otLoadToday' | 'pacPending' | 'criticalLabs' | 'financialPending' | 'delayed' | 'rebookRequired'
>;

const METRICS: { key: MetricKey; label: string; attention?: boolean }[] = [
  { key: 'otLoadToday', label: 'OT Today' },
  { key: 'pacPending', label: 'PAC Pending' },
  { key: 'criticalLabs', label: 'Critical Labs', attention: true },
  { key: 'financialPending', label: 'Financial' },
  { key: 'delayed', label: 'Delayed', attention: true },
  { key: 'rebookRequired', label: 'Rebook', attention: true },
];

/** One compact row of at-a-glance ward counts; each tile toggles a list filter. */
export function WardKpiStrip({
  summary,
  activeKey,
  onSelect,
}: {
  summary: WardDashboardSummaryDto | null;
  activeKey?: string;
  onSelect?: (key: string) => void;
}) {
  if (!summary) return null;

  return (
    <div
      data-testid={WARD_PREOP_TEST_IDS.kpiStrip}
      className="bg-white rounded-xl shadow-sm border border-gray-100 grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-gray-100 overflow-hidden"
    >
      {METRICS.map(({ key, label, attention }) => {
        const value = summary[key] ?? 0;
        const alert = !!attention && value > 0;
        const active = activeKey === key;
        return (
          <button
            key={key}
            type="button"
            data-testid={WARD_PREOP_TEST_IDS.kpiTile(key)}
            onClick={() => onSelect?.(key)}
            aria-pressed={active}
            className={`px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
              active ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            <p className={`text-2xl font-bold leading-none ${alert ? 'text-rose-600' : 'text-gray-900'}`}>{value}</p>
            <p className={`text-[11px] font-medium mt-1.5 whitespace-nowrap ${active ? 'text-blue-700' : 'text-gray-500'}`}>{label}</p>
          </button>
        );
      })}
    </div>
  );
}
