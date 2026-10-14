import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const srcRoot = join(__dirname, '../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

const getMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  getApi: () => ({
    get: getMock,
  }),
}));

import { laboratoryCatalogApi } from '@/lib/api/laboratory-catalog.api';

describe('L2 UAT defect regressions', () => {
  const doctor = read('components/laboratory/DoctorSearchAutosuggest.tsx');
  const picker = read('components/laboratory/LaboratoryCatalogPicker.tsx');
  const orderDialog = read('components/laboratory/LaboratoryOrderDialog.tsx');
  const catalogApi = read('lib/api/laboratory-catalog.api.ts');
  const interceptors = read('lib/auth-interceptors.ts');

  it('Finding 1 — catalog picker uses Patient-style input listbox (supersedes Popover Select)', () => {
    expect(picker).toContain('z-[100]');
    expect(picker).toContain('role="combobox"');
    expect(picker).toContain('role="listbox"');
    expect(picker).toContain('Laboratory Tests');
    expect(picker).toContain('Laboratory Panels');
    expect(picker).not.toContain('PopoverContent');
  });

  it('Finding 2 — empty catalog is honest (no fake CBC hardcode)', () => {
    expect(picker).toContain('No active laboratory catalog items');
    expect(picker).not.toContain("name: 'CBC'");
    expect(picker).not.toContain('hardcode');
    expect(orderDialog).not.toContain('fake');
  });

  it('Finding 3 — clinician search does not call user.view doctors endpoint', () => {
    expect(doctor).toContain('laboratoryCatalogApi');
    expect(doctor).toContain('searchOrderingClinicians');
    expect(doctor).not.toContain('masterDataApi.searchDoctors');
    expect(doctor).not.toContain('masterDataApi');
    expect(catalogApi).toContain('/laboratory/catalog/ordering-clinicians');
    expect(catalogApi).not.toContain("'/users/doctors/search'");
  });

  it('Finding 3 — 403 on catalog/clinician calls skips Access Denied hard redirect', () => {
    expect(catalogApi).toContain('skipForbiddenRedirect: true');
    expect(interceptors).toContain('skipForbiddenRedirect');
    expect(interceptors).toContain("window.location.href = '/dashboard/unauthorized'");
  });
});

describe('L2 ordering clinician API contract', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ data: { data: [], count: 0 } });
  });

  it('searchOrderingClinicians hits laboratory catalog route with skipForbiddenRedirect', async () => {
    await laboratoryCatalogApi.searchOrderingClinicians({ search: 'an', take: 20 });
    expect(getMock).toHaveBeenCalledWith('/laboratory/catalog/ordering-clinicians', {
      params: { search: 'an', take: 20 },
      skipForbiddenRedirect: true,
    });
  });

  it('searchTests still uses active-only catalog GET with skipForbiddenRedirect', async () => {
    getMock.mockResolvedValue({ data: [] });
    await laboratoryCatalogApi.searchTests({ search: 'CBC', activeOnly: true });
    expect(getMock).toHaveBeenCalledWith('/laboratory/catalog/tests', {
      params: { search: 'CBC', activeOnly: true },
      skipForbiddenRedirect: true,
    });
  });
});
