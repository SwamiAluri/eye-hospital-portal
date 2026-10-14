import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LMS_CAPABILITIES } from '@/lib/lms/lms-capability-registry';
import { LMS_COLLECTION_PERMISSIONS, LEGACY_LABORATORY_VIEW } from '@/lib/lms/lms-permissions';

const srcRoot = join(__dirname, '../../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

describe('Enterprise LMS L-COL-01B — Collection UI', () => {
  it('registers collection route and marks capability implemented', () => {
    expect(existsSync(join(srcRoot, 'app/dashboard/lms/collection/page.tsx'))).toBe(true);
    const collection = LMS_CAPABILITIES.find((c) => c.href === '/dashboard/lms/collection');
    expect(collection?.status).toBe('implemented');
  });

  it('page uses CollectionWorkbench instead of LmsCapabilityPage placeholder', () => {
    const page = read('app/dashboard/lms/collection/page.tsx');
    expect(page).toContain('CollectionWorkbench');
    expect(page).not.toContain('LmsCapabilityPage');
  });

  it('workbench covers worklist states and permission gates', () => {
    const wb = read('components/lms/collection/CollectionWorkbench.tsx');
    expect(wb).toContain('listLmsCollectionTasks');
    expect(wb).toContain('collection-loading');
    expect(wb).toContain('collection-empty');
    expect(wb).toContain('collection-error');
    expect(wb).toContain('collection-unauthorized');
    expect(wb).toContain('LMS_COLLECTION_PERMISSIONS.view');
    expect(wb).toContain('LMS_COLLECTION_PERMISSIONS.manage');
    expect(wb).toContain('LMS_COLLECTION_PERMISSIONS.collect');
    expect(wb).toContain('Complete Collection creates Specimens');
    expect(wb).not.toContain('no Specimen in this slice');
    expect(wb).not.toContain(LEGACY_LABORATORY_VIEW);
    expect(wb).not.toContain('lab-reports');
  });

  it('worklist shows Assigned and Claimed independently (PD-COL-OWN-01)', () => {
    const wb = read('components/lms/collection/CollectionWorkbench.tsx');
    expect(wb).toContain('collection-ownership');
    expect(wb).toContain("Assigned:");
    expect(wb).toContain("Claimed:");
    expect(wb).toContain('Unclaimed');
    // Must not collapse to a single Claimed-preferred chip
    expect(wb).not.toMatch(/claimedByUserId\s*\?\s*'Claimed'\s*:\s*row\.assignedToUserId/);
  });

  it('planning dialog requires explicit OrderTest selection and no auto catalogue inference', () => {
    const d = read('components/lms/collection/CollectionPlanDialog.tsx');
    expect(d).toContain('getLmsCollectionPlanContext');
    expect(d).toContain('createLmsCollectionTask');
    expect(d).toContain('orderTestIds');
    expect(d).toContain('planner-controlled');
    expect(d).toContain('not auto-derived');
    expect(d).not.toContain('SpecimenTypeRef');
    expect(d).not.toContain('ContainerRef');
  });

  it('detail sheet opens without claiming; claim is explicit', () => {
    const d = read('components/lms/collection/CollectionTaskDetailSheet.tsx');
    expect(d).toContain('getLmsCollectionTask');
    expect(d).toContain('MUST NOT claim');
    expect(d).toContain('claimLmsCollectionTask');
    expect(d).toContain('collection-task-claim');
    expect(d).toContain('transitionLmsCollectionTask');
    expect(d).toContain('Accession, barcode');
  });

  it('detail shows Assigned and Claimed independently (PD-COL-OWN-01)', () => {
    const d = read('components/lms/collection/CollectionTaskDetailSheet.tsx');
    expect(d).toContain('collection-task-assigned');
    expect(d).toContain('collection-task-claimed');
    expect(d).toContain('User GUID');
    expect(d).not.toContain('collector picker');
    expect(d).not.toContain('staff directory');
  });

  it('assign field keeps raw GUID UX with minimal client GUID check (server still authoritative)', () => {
    const d = read('components/lms/collection/CollectionTaskDetailSheet.tsx');
    expect(d).toContain('ASSIGN_USER_GUID_RE');
    expect(d).toContain('Assignee user ID must be a valid GUID.');
    expect(d).toContain('assignLmsCollectionTask');
    expect(d).not.toContain('staff picker');
    expect(d).not.toContain('StaffDirectory');
  });

  it('API client uses LaboratoryApi collection endpoints only', () => {
    const api = read('lib/lms/lms-collection.api.ts');
    expect(api).toContain('/lms/collection/tasks');
    expect(api).toContain('/lms/collection/orders/');
    expect(api).toContain('plan-context');
    expect(api).toContain('parseLmsCollectionApiError');
    expect(api).not.toContain('/laboratory/catalog');
    expect(api).not.toContain('/lab-reports');
    expect(api).not.toContain('createSpecimen');
    expect(api).not.toContain('Accession');
  });

  it('permission codes match PD-COL-17', () => {
    expect(LMS_COLLECTION_PERMISSIONS).toEqual({
      view: 'lms.collection.view',
      manage: 'lms.collection.manage',
      collect: 'lms.collection.collect',
    });
  });

  it('does not introduce Specimen/Receiving leakage as implemented APIs', () => {
    const files = [
      'components/lms/collection/CollectionWorkbench.tsx',
      'components/lms/collection/CollectionPlanDialog.tsx',
      'components/lms/collection/CollectionTaskDetailSheet.tsx',
      'lib/lms/lms-collection.api.ts',
    ];
    for (const f of files) {
      const src = read(f);
      expect(src).not.toMatch(/createSpecimen|SpecimenCustody|AccessionNumber|generateBarcode/);
      expect(src).not.toMatch(/COLLECTION_COMPLETED/);
    }
  });
});
