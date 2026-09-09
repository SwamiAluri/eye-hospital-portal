import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OutpatientChecklistRollup } from '@/components/counsellors-desk/OutpatientChecklistRollup';
import type { RollupCardState } from '@/lib/ip-checklist/outpatient-integration';

const SAMPLE: RollupCardState[] = [
  { key: 'investigations', label: 'Investigations', status: 'Pending', completed: 0, total: 11 },
  { key: 'payment', label: 'Patient Payment Status', status: 'Pending', completed: 0, total: 1 },
  { key: 'consent', label: 'Consent', status: 'Pending', completed: 0, total: 2 },
  { key: 'preAuth', label: 'Authorization Status', status: 'Pending', completed: 0, total: 1 },
];

describe('OutpatientChecklistRollup', () => {
  it('default cards variant keeps bordered status tiles', () => {
    const html = renderToStaticMarkup(<OutpatientChecklistRollup cards={SAMPLE} />);
    expect(html).toContain('bg-amber-50');
    expect(html).toContain('border-amber-200');
    expect(html).toContain('py-2.5');
  });

  it('readback variant is a compact status strip without KPI tile chrome', () => {
    const html = renderToStaticMarkup(
      <OutpatientChecklistRollup cards={SAMPLE} variant="readback" />,
    );
    expect(html).toContain('Investigations');
    expect(html).toContain('Pending');
    expect(html).toContain('0/11');
    expect(html).not.toContain('bg-amber-50');
    expect(html).not.toContain('py-2.5');
    expect(html).toContain('data-rollup-variant="readback"');
  });

  it('readback still supports drilldown click targets', () => {
    const onCardClick = vi.fn();
    const html = renderToStaticMarkup(
      <OutpatientChecklistRollup
        cards={SAMPLE}
        variant="readback"
        onCardClick={onCardClick}
      />,
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('Investigations');
  });
});
