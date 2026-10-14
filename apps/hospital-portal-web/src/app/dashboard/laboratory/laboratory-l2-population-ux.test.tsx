import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = join(__dirname, '../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

describe('L2 catalog population + Patient-style search UX', () => {
  const picker = read('components/laboratory/LaboratoryCatalogPicker.tsx');
  const doctor = read('components/laboratory/DoctorSearchAutosuggest.tsx');
  const patient = read('components/patients/lookup/PatientSearchAutosuggest.tsx');
  const orderDialog = read('components/laboratory/LaboratoryOrderDialog.tsx');
  const catalogApi = read('lib/api/laboratory-catalog.api.ts');

  it('Test/Panel uses Patient-style input combobox (not Popover Select)', () => {
    expect(picker).toContain('role="combobox"');
    expect(picker).toContain('role="listbox"');
    expect(picker).toContain('absolute z-[100]');
    expect(picker).toContain('rounded-lg border border-gray-200');
    expect(picker).toContain('Search laboratory test or panel');
    expect(picker).toContain('Laboratory Tests');
    expect(picker).toContain('Laboratory Panels');
    expect(picker).not.toContain('from \'@/components/ui/popover\'');
    expect(picker).not.toContain('PopoverContent');
    // Patient pattern markers
    expect(patient).toContain('role="combobox"');
    expect(patient).toContain('absolute left-3 top-1/2');
    expect(picker).toContain('absolute left-3 top-1/2');
  });

  it('Ordering clinician uses Patient-style input + least-privilege catalog endpoint', () => {
    expect(doctor).toContain('role="combobox"');
    expect(doctor).toContain('role="listbox"');
    expect(doctor).toContain('searchOrderingClinicians');
    expect(doctor).not.toContain('from \'@/components/ui/popover\'');
    expect(doctor).not.toContain('useDoctorSearch');
    expect(catalogApi).toContain('/laboratory/catalog/ordering-clinicians');
    expect(catalogApi).toContain('skipForbiddenRedirect: true');
  });

  it('keyboard navigation matches Patient search (Arrow/Enter/Escape)', () => {
    for (const src of [picker, doctor, patient]) {
      expect(src).toContain("event.key === 'ArrowDown'");
      expect(src).toContain("event.key === 'ArrowUp'");
      expect(src).toContain("event.key === 'Enter'");
      expect(src).toContain("event.key === 'Escape'");
    }
  });

  it('order dialog keeps derived catalog metadata and no free-text test code', () => {
    expect(orderDialog).toContain('LaboratoryCatalogPicker');
    expect(orderDialog).toContain('DoctorSearchAutosuggest');
    expect(orderDialog).toContain('createFromCatalog');
    expect(orderDialog).toContain('data-testid="laboratory-order-derived-code"');
    expect(orderDialog).not.toContain('id="lab-order-test-code"');
    expect(orderDialog).not.toMatch(/labReportsApi\.create\(/);
  });
});
