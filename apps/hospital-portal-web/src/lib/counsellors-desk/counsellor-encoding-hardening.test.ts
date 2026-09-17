import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('Phase 2X-S3 master-data encoding FE contract', () => {
  it('AddPatientModal does not use frontend mojibake string replacement', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/components/counsellors-desk/AddPatientModal.tsx'),
      'utf8',
    );
    expect(text).not.toMatch(/replace\(['"]â€—['"]/);
    expect(text).not.toMatch(/replace\(['"].*â€.*['"]/);
    expect(text).toContain('useServiceCatalogQuery');
  });
});
