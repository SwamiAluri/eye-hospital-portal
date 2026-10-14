import { test, expect, type Page, type Response } from '@playwright/test';
import { apiLogin, seedBrowserAuth } from './helpers/auth';
import { patientLookupTestIds } from '../src/lib/patients/patient-lookup-test-ids';
import { REGISTRATION_RUNTIME_MARKER } from '../src/lib/patients/registration-lifecycle-telemetry';

/**
 * Runtime forensic: Confirm & Create must open soft duplicate without resetting to empty PERSONAL.
 * Uses live AuthService duplicate API (Sam / Badikolu / 1987-08-01 / 8919653433 → PhoneMatch×3).
 */
test.describe('Add Patient Confirm soft-duplicate runtime forensic', () => {
  test.describe.configure({ timeout: 180_000 });
  // Seed auth in beforeEach — do not require pre-existing storageState file.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, request }) => {
    const login = await apiLogin(request);
    await page.addInitScript(() => {
      (window as unknown as { __HP_REG_LIFECYCLE_ENABLE__: boolean }).__HP_REG_LIFECYCLE_ENABLE__ =
        true;
      (window as unknown as { __HP_REG_LIFECYCLE__: unknown[] }).__HP_REG_LIFECYCLE__ = [];
    });
    await seedBrowserAuth(page, login);
  });

  async function fillMinimalAdultWizard(page: Page) {
    const dialog = page.getByTestId('add-patient-registration-dialog');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toHaveAttribute('data-runtime-marker', REGISTRATION_RUNTIME_MARKER);

    // Labels are not htmlFor-associated — locate inputs via label sibling structure.
    const firstName = dialog.locator('label:has-text("First Name")').locator('..').locator('input').first();
    const lastName = dialog.locator('label:has-text("Last Name")').locator('..').locator('input').first();
    await firstName.fill('Sam');
    await lastName.fill('Badikolu');
    await page.getByTestId('add-patient-dob-display').fill('01-08-1987');
    await page.getByTestId('add-patient-dob-display').blur();

    // Gender select is unlabeled-adjacent; find the select under the Gender label.
    const genderSelect = dialog.locator('label:has-text("Gender")').locator('..').locator('select');
    await expect
      .poll(async () => genderSelect.locator('option').count(), { timeout: 30_000 })
      .toBeGreaterThan(0);
    const optionValues = await genderSelect.locator('option').evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
    );
    expect(optionValues.length).toBeGreaterThan(0);
    await genderSelect.selectOption(optionValues[0]!);

    await page.getByRole('button', { name: 'Next' }).click(); // → CONTACT
    await expect(page.getByTestId('add-patient-registration-shell')).toHaveAttribute(
      'data-current-step-id',
      'CONTACT',
    );

    const phoneInput = dialog.locator('label:has-text("Phone")').locator('..').locator('input').first();
    await phoneInput.fill('8919653433');

    // CONTACT → IDENTITY → EMERGENCY → INSURANCE → REVIEW
    for (const expected of ['IDENTITY', 'EMERGENCY', 'INSURANCE', 'REVIEW'] as const) {
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByTestId('add-patient-registration-shell')).toHaveAttribute(
        'data-current-step-id',
        expected,
        { timeout: 15_000 },
      );
    }
  }

  test('Confirm & Create opens soft duplicate without PERSONAL reset', async ({ page }) => {
    const dupResponses: Array<{ status: number; body: unknown }> = [];
    const createRequests: string[] = [];

    page.on('response', async (res: Response) => {
      const url = res.url();
      if (url.includes('/patients/registration/check-duplicates') && res.request().method() === 'POST') {
        try {
          dupResponses.push({ status: res.status(), body: await res.json() });
        } catch {
          dupResponses.push({ status: res.status(), body: null });
        }
      }
    });
    page.on('request', (req) => {
      if (
        req.method() === 'POST' &&
        /\/api\/patients\/?$/.test(new URL(req.url()).pathname) &&
        !req.url().includes('check-duplicates') &&
        !req.url().includes('registration')
      ) {
        createRequests.push(req.url());
      }
    });

    await page.goto('/dashboard/patients', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId(patientLookupTestIds.page)).toBeVisible({ timeout: 60_000 });

    await page.getByTestId(patientLookupTestIds.addPatient).click();
    await fillMinimalAdultWizard(page);

    // Ensure phone present on review identity — fill from Contact if review shows phone empty.
    // Confirm & Create
    const confirm = page.getByTestId('confirm-create-patient');
    await expect(confirm).toBeVisible();
    await confirm.click();

    // Wait for duplicate response or soft UI / reset.
    await expect
      .poll(() => dupResponses.length, { timeout: 45_000 })
      .toBeGreaterThan(0);

    const dup = dupResponses[0]!;
    expect(dup.status).toBe(200);
    const body = dup.body as {
      isDuplicate?: boolean;
      matches?: Array<{ matchType?: string }>;
    };
    expect(body.isDuplicate).toBe(true);
    const phoneMatches = (body.matches ?? []).filter((m) => m.matchType === 'PhoneMatch');
    expect(phoneMatches.length).toBeGreaterThanOrEqual(1);

    const lifecycle = await page.evaluate(() => {
      return (
        (window as unknown as { __HP_REG_LIFECYCLE__?: unknown[] }).__HP_REG_LIFECYCLE__ ?? []
      );
    });

    const softVisible = await page
      .getByTestId('duplicate-soft-match-dialog')
      .isVisible()
      .catch(() => false);
    const stepId = await page
      .getByTestId('add-patient-registration-shell')
      .getAttribute('data-current-step-id');
    const firstNameVal = await page
      .getByTestId('add-patient-registration-dialog')
      .locator('label:has-text("First Name")')
      .locator('..')
      .locator('input')
      .first()
      .inputValue()
      .catch(() => '');
    const personalEmpty = stepId === 'PERSONAL' && firstNameVal === '';

    // Dump forensic trail on soft failure.
    if (!softVisible) {
      console.log('LIFECYCLE_EVENTS', JSON.stringify(lifecycle, null, 2));
      console.log('DUP_RESPONSE', JSON.stringify(dup));
      console.log('CREATE_REQUESTS', createRequests);
      console.log('PERSONAL_EMPTY', personalEmpty);
      console.log(
        'STEP',
        await page.getByTestId('add-patient-registration-shell').getAttribute('data-current-step-id'),
      );
    }

    expect(createRequests, 'POST /patients must not run before Continue').toHaveLength(0);
    expect(softVisible, 'Possible Duplicate Patient must be visible').toBe(true);
    expect(personalEmpty, 'must not reset to empty Personal Information').toBe(false);
    expect(page.url()).toContain('/dashboard/patients');

    // Continue → create once
    await page.getByTestId('duplicate-soft-match-continue').click();
    await expect
      .poll(() => createRequests.length, { timeout: 60_000 })
      .toBe(1);
    await expect(page.getByTestId('patient-registration-success')).toBeVisible({
      timeout: 60_000,
    });
  });
});
