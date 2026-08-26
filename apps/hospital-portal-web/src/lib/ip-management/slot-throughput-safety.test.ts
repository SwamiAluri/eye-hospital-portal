import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const webRoot = join(__dirname, '../../..');

describe('Slot throughput safety KPIs', () => {
  it('surfaces vitals-override and IOL-mismatch counts on the existing page', () => {
    const page = readFileSync(
      join(webRoot, 'src/app/dashboard/ip-management/throughput/page.tsx'),
      'utf8',
    );
    expect(page).toContain('throughput-kpi-vitals-override');
    expect(page).toContain('throughput-kpi-iol-mismatch');
    expect(page).toContain('vitalsOverrideCount');
    expect(page).toContain('iolMismatchOverrideCount');
    expect(page).toContain('VitalsOutOfRangeAcknowledged');
    expect(page).toContain('IolMismatchOverridden');
  });

  it('DTO includes optional safety counts without a second ledger', () => {
    const api = readFileSync(join(webRoot, 'src/lib/api/ip-management.api.ts'), 'utf8');
    expect(api).toContain('vitalsOverrideCount?: number');
    expect(api).toContain('iolMismatchOverrideCount?: number');
  });
});
