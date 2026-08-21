import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Phase 3 — ensure legacy finance insurance entry points redirect / deep-link to CCMS.
 * (Static source checks; runtime e2e covered separately.)
 */
describe('legacy insurance route retirement (Phase 3)', () => {
  const webRoot = join(__dirname, '../../..');

  it('finance page redirects tab=insurance to CCMS claims', () => {
    const src = readFileSync(join(webRoot, 'src/app/dashboard/finance/page.tsx'), 'utf8');
    expect(src).toContain("tab === 'insurance'");
    expect(src).toContain("/dashboard/ccms/claims");
    expect(src).not.toContain('mockInsuranceClaims');
    expect(src).not.toContain("activeTab === 'insurance'");
  });

  it('finance/insurance catch-all redirects to CCMS', () => {
    const src = readFileSync(
      join(webRoot, 'src/app/dashboard/finance/insurance/[[...slug]]/page.tsx'),
      'utf8',
    );
    expect(src).toContain("/dashboard/ccms/claims");
  });

  it('next.config permanently redirects /dashboard/insurance', () => {
    const src = readFileSync(join(webRoot, 'next.config.js'), 'utf8');
    expect(src).toContain("source: '/dashboard/insurance'");
    expect(src).toContain("destination: '/dashboard/ccms'");
  });

  it('standalone insurance page still targets CCMS', () => {
    const src = readFileSync(join(webRoot, 'src/app/dashboard/insurance/page.tsx'), 'utf8');
    expect(src).toContain("/dashboard/ccms");
  });
});
