import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const srcRoot = join(__dirname, '../..');

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

describe('FE-005: journey billing projection write path retired from UI', () => {
  it('no component or page calls ipManagementApi.addBilling', () => {
    const allowedSuffixes = [
      'lib/api/ip-management.api.ts',
      'lib/ip-management/add-billing-ui-retired.test.ts',
    ];
    const offenders: string[] = [];
    for (const file of walk(srcRoot)) {
      const normalised = file.replace(/\\/g, '/');
      if (allowedSuffixes.some(s => normalised.endsWith(s))) continue;
      const src = readFileSync(file, 'utf8');
      if (src.includes('addBilling(') || src.includes('.addBilling')) {
        offenders.push(normalised.slice(srcRoot.replace(/\\/g, '/').length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});
