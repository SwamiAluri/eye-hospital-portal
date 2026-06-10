/**
 * E2E: IP checklist closure flow (S6–S8)
 *
 * Prerequisites: migrations 134–140 applied, Nurse / Counsellor / OT Nurse test users.
 *
 * Flow under test:
 * 1. Counsellor completes outpatient checklist → items copy to ward on journey init
 * 2. Ward investigation badges from lab/imaging hints
 * 3. SentToOT blocked/warned by med-log gate
 * 4. OT accept blocked by billing until Emergency FC or payment
 * 5. Start surgery WHO override path
 * 6. Discharge dual-status (clinical + financial)
 */
import { test, expect } from '@playwright/test';
import { loginAsRole } from './helpers/auth';

test.describe('IP checklist closure @ip-checklist', () => {
  // RBAC smoke lives in ip-checklist-rbac.spec.ts. Full closure needs journey fixtures.
  test.skip(true, 'Requires seeded journey + counselling session fixtures (see scripts/resolve-e2e-optometry-fixtures.ts)');

  test('counsellor copy → ward hints → OT gates → discharge', async ({ page }) => {
    await loginAsRole(page, 'counsellor');
    // TODO: open counselling session, complete outpatient checklist, finalize OT schedule

    await loginAsRole(page, 'nurse');
    await page.goto('/dashboard/ip-management/ward');
    // TODO: admit Expected patient, verify P0 banner, complete ward + investigation items
    // TODO: send to OT — expect med-log soft gate if incomplete

    await loginAsRole(page, 'ot_nurse');
    await page.goto('/dashboard/ip-management/operation-theatre');
    // TODO: accept patient — billing gate, before-anaesthesia soft warn
    // TODO: start surgery — WHO warn / override with supervisor permission

    await loginAsRole(page, 'nurse');
    await page.goto('/dashboard/ip-management/ward');
    // TODO: post-op transition, discharge with dual status display

    await expect(page.getByText('Discharged')).toBeVisible();
  });
});
