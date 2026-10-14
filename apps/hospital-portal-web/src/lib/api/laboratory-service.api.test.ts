import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = join(__dirname, '../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

describe('Laboratory Service API client — L-CAT-01B', () => {
  const client = read('lib/api/laboratory-service.api.ts');
  const legacyCatalog = read('lib/api/laboratory-catalog.api.ts');

  it('targets Laboratory Service base URL, not AuthService pathology catalogue', () => {
    expect(client).toContain('NEXT_PUBLIC_LABORATORY_API_URL');
    expect(client).toContain('localhost:7076/api');
    expect(client).toContain('/lms/health');
    expect(client).toContain('/lms/secure-ping');
    expect(client).toContain('/lms/catalogue');
    expect(client).not.toMatch(/get\(['"`]\/laboratory\/catalog/);
    expect(client).not.toContain("from '@/lib/api/laboratory-catalog");
  });

  it('does not mutate legacy pathology catalogue client', () => {
    expect(legacyCatalog).toContain('/laboratory/catalog');
    expect(legacyCatalog).not.toContain('NEXT_PUBLIC_LABORATORY_API_URL');
    expect(legacyCatalog).not.toContain('/lms/');
  });

  it('exposes catalogue lifecycle clients without arbitrary status assignment', () => {
    expect(client).toContain('createLmsCatalogueDraft');
    expect(client).toContain('submitLmsCatalogueReview');
    expect(client).toContain('approveLmsCatalogue');
    expect(client).toContain('activateLmsCatalogue');
    expect(client).toContain('retireLmsCatalogue');
    expect(client).toContain('supersedeLmsCatalogue');
    expect(client).not.toMatch(/setCatalogueStatus|patchStatus/i);
  });
});
