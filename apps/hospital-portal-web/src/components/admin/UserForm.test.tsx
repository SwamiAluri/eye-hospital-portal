import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Admin User Edit — qualificationTypes runtime defect regression.
 *
 * Production error: "qualificationTypes is not defined"
 * Root cause: useQualificationTypes was imported in UserForm but never
 * called / destructured, while the Qualifications <select> still mapped
 * over qualificationTypes during render (after lookup loading completes).
 *
 * Intended pattern (same as admin leave/employees/licenses):
 *   const { types: qualificationTypes } = useQualificationTypes();
 */

describe('UserForm — qualificationTypes wiring (Edit User)', () => {
  const src = readFileSync(resolve(__dirname, './UserForm.tsx'), 'utf8');

  it('calls useQualificationTypes and binds types as qualificationTypes', () => {
    expect(src).toContain("import { useQualificationTypes } from '@/hooks/use-hr-masters'");
    expect(src).toMatch(
      /const\s*\{\s*types\s*:\s*qualificationTypes\s*\}\s*=\s*useQualificationTypes\s*\(\s*\)/,
    );
  });

  it('keeps Qualifications select wired to qualificationTypes (does not remove the feature)', () => {
    expect(src).toContain('name="qualifications"');
    expect(src).toContain('qualificationTypes.map');
    expect(src).toContain('qualificationTypes.some');
  });

  it('preserves existing Branch selector contract required for Downtown assignment', () => {
    expect(src).toContain('name="branchId"');
    expect(src).toContain('Branch *');
    expect(src).toContain('branchesApi.getAll');
    expect(src).toContain('setBranches');
    expect(src).toContain('branchId: form.branchId');
  });

  it('preserves core edit fields used by Admin User Management', () => {
    expect(src).toContain('name="firstName"');
    expect(src).toContain('name="lastName"');
    expect(src).toContain('name="email"');
    expect(src).toContain('name="roleId"');
    expect(src).toContain('name="userType"');
    expect(src).toContain('usersApi.update');
  });
});
