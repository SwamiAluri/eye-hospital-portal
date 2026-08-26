import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const panel = readFileSync(
  join(__dirname, '../../components/ip-management/PatientQuickPanel.tsx'),
  'utf8',
);
const page = readFileSync(
  join(__dirname, '../../app/dashboard/ip-management/page.tsx'),
  'utf8',
);

describe('IP-001: census overlay retired', () => {
  it('PatientQuickPanel is layout-agnostic and does not mount a blur scrim', () => {
    expect(panel).not.toContain('backdrop-blur');
    expect(panel).not.toContain('fixed inset-0');
    expect(panel).not.toContain('fixed right-0 top-0 bottom-0');
    expect(panel).toContain("presentation = 'docked'");
  });

  it('census page docks the rail and keeps selection in the URL', () => {
    expect(page).toContain('parseIpCensusSearchParams');
    expect(page).toContain('CENSUS_RAIL_WIDTH_PX');
    expect(page).toContain("presentation === 'docked'");
    expect(page).not.toContain('backdrop-blur');
  });

  it('shows an assigned slot on the census row (IP-013)', () => {
    expect(page).toContain('journey.slotLabel');
    expect(page).toContain('matchesSlotSession');
    expect(page).toContain('sortIpCensusRows');
  });

  it('PatientQuickPanel no longer ships MiniStepper or billing jargon', () => {
    expect(panel).not.toContain('MiniStepper');
    expect(panel).not.toContain('OpdBill');
    expect(panel).not.toContain('AddTransactionForm');
  });
});
