import { describe, expect, it } from 'vitest';
import { sortTimelineEvents, timelineEmptyMessage, timelineUnavailableMessage, type Patient360TimelineEvent } from '@/lib/patients/patient-360-timeline';

function row(partial: Partial<Patient360TimelineEvent> & Pick<Patient360TimelineEvent, 'id' | 'sortAt'>): Patient360TimelineEvent {
  return {
    at: null,
    type: 'Visit',
    description: 'Visit',
    source: 'Front desk',
    actor: null,
    href: null,
    ...partial,
  };
}

describe('patient 360 timeline aggregation', () => {
  it('orders dated events newest first without inventing rows', () => {
    const events = sortTimelineEvents([
      row({ id: 'a', sortAt: 100, description: 'older', at: '2026-01-01 08:00' }),
      row({ id: 'b', sortAt: 200, description: 'newer', at: '2026-02-01 08:00' }),
    ]);
    expect(events.map((event) => event.id)).toEqual(['b', 'a']);
    expect(timelineUnavailableMessage()).toBe('Timeline is not available in Patient 360.');
    expect(timelineEmptyMessage()).toMatch(/No dated events/);
    expect(timelineEmptyMessage()).not.toMatch(/fake|sample|coming soon/i);
  });
});
