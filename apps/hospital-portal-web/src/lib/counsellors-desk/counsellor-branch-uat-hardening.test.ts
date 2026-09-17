import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { searchPatientsUnified } from '@/lib/patients/unified-patient-search';

describe('Counsellor branch-context FE contracts', () => {
  it('unified patient search accepts null branchId (server resolves)', async () => {
    const empty = await searchPatientsUnified(null, 'a', 10);
    expect(empty).toEqual([]);
  });

  it('Patient Directory empty-branch distinguishes none vs select', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/components/patients/lookup/PatientHubEmptyBranch.tsx'),
      'utf8',
    );
    expect(text).toContain("reason === 'none'");
    expect(text).toContain('No authorized branch assigned');
  });

  it('SearchableMasterSelect supports emit id|name for doctor/surgery', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/components/counsellors-desk/SearchableMasterSelect.tsx'),
      'utf8',
    );
    expect(text).toContain("emit?: 'id' | 'name'");
  });

  it('AddPatientModal wires searchable surgery + doctor lookups', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/components/counsellors-desk/AddPatientModal.tsx'),
      'utf8',
    );
    expect(text).toContain('SearchableMasterSelect');
    expect(text).toContain('useServiceCatalogQuery');
    expect(text).toContain('emit="name"');
    expect(text).toContain('emit="id"');
    expect(text).not.toContain('Branch is required. Select a branch and try again.');
  });

  it('counsellorsDeskApi.getSurgeons uses Counseling/surgeons (not users/surgeons)', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/lib/api/counsellors-desk.api.ts'),
      'utf8',
    );
    expect(text).toContain('/Counseling/surgeons');
    expect(text).not.toMatch(/get\(['"`]\/users\/surgeons/);
  });
});
