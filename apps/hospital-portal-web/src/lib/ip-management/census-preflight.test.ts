import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(__dirname, '../..');

describe('IP-010: census clinical actions are preflighted', () => {
  it('PatientQuickPanel does not blindly acknowledgeWarnings on clinical mutations', () => {
    const text = readFileSync(join(src, 'components/ip-management/PatientQuickPanel.tsx'), 'utf8');
    expect(text).not.toMatch(/admitPatient\([^)]*acknowledgeWarnings:\s*true/);
    expect(text).not.toMatch(/acknowledgeWarnings:\s*true\s*,/);
    expect(text).toContain('censusOpensWorkspace');
    expect(text).toContain('useTransitionGatesQuery');
    expect(text).toContain('acknowledgeWarnings ? { acknowledgeWarnings: true }');
  });
});
