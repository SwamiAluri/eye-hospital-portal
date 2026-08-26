'use client';

import type { WardDashboardSummaryDto } from '@/lib/api/ip-management.api';
import type { IpPersona } from '@/lib/ip-management/ip-persona';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

type MetricKey = 'pacPending' | 'criticalLabs' | 'delayed' | 'returnedFromOt' | 'financialPending' | 'rebookRequired';

const ALWAYS: { key: MetricKey; label: string; tone: 'warn' | 'bad' }[] = [
  { key: 'pacPending', label: 'PAC incomplete', tone: 'warn' },
  { key: 'criticalLabs', label: 'Critical lab', tone: 'bad' },
  { key: 'delayed', label: 'Delayed for OT', tone: 'warn' },
  { key: 'returnedFromOt', label: 'Returned from OT', tone: 'bad' },
];

const COORD_ONLY: { key: MetricKey; label: string; tone: 'quiet' }[] = [
  { key: 'financialPending', label: 'Financial hold', tone: 'quiet' },
  { key: 'rebookRequired', label: 'Rebook', tone: 'quiet' },
];

function isCoordinator(persona: IpPersona | undefined): boolean {
  return persona === 'coordinator' || persona === 'admin';
}

/** This-ward exception chips. Values come from the existing board/summary APIs. */
export function WardKpiStrip({
  summary,
  returnedFromOt = 0,
  persona = 'ward',
  activeKey,
  onSelect,
}: {
  summary: WardDashboardSummaryDto | null;
  returnedFromOt?: number;
  persona?: IpPersona;
  activeKey?: string;
  onSelect?: (key: string) => void;
}) {
  if (!summary) return null;

  const coord = isCoordinator(persona);
  const values: Record<MetricKey, number> = {
    pacPending: summary.pacPending ?? 0,
    criticalLabs: summary.criticalLabs ?? 0,
    delayed: summary.delayed ?? 0,
    returnedFromOt,
    financialPending: summary.financialPending ?? 0,
    rebookRequired: summary.rebookRequired ?? 0,
  };

  return (
    <div data-testid={WARD_PREOP_TEST_IDS.kpiStrip} className="attn" role="toolbar" aria-label="This ward exceptions">
      <span className="k">This ward</span>
      {ALWAYS.map(({ key, label, tone }) => {
        const value = values[key];
        const active = activeKey === key;
        return (
          <button
            key={key}
            type="button"
            data-testid={WARD_PREOP_TEST_IDS.kpiTile(key)}
            onClick={() => onSelect?.(key)}
            aria-pressed={active}
            className={`chip ${tone} ${active ? 'on' : ''}`.trim()}
          >
            <span className="n">{value}</span> {label}
          </button>
        );
      })}
      {coord && (
        <>
          <span className="k" style={{ marginLeft: 8 }}>Ops</span>
          {COORD_ONLY.map(({ key, label, tone }) => {
            const value = values[key];
            const active = activeKey === key;
            return (
              <button
                key={key}
                type="button"
                data-testid={WARD_PREOP_TEST_IDS.kpiTile(key)}
                onClick={() => onSelect?.(key)}
                aria-pressed={active}
                className={`chip ${tone} ${active ? 'on' : ''}`.trim()}
              >
                <span className="n">{value}</span> {label}
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
