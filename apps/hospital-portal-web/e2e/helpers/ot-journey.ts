import { type Dialog, type Page, expect } from '@playwright/test';
import { OT_TEST_IDS } from '../../src/lib/ip-management/ot-test-ids';

async function withNativeDialogsAccepted(page: Page, action: () => Promise<void>): Promise<void> {
  const onDialog = async (d: Dialog) => {
    await d.accept();
  };
  page.on('dialog', onDialog);
  try {
    await action();
  } finally {
    page.off('dialog', onDialog);
  }
}

export async function gotoOtPage(page: Page): Promise<void> {
  await page.goto('/dashboard/ip-management/operation-theatre', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId(OT_TEST_IDS.page)).toBeVisible({ timeout: 60_000 });
}

export async function selectOtTab(page: Page, filter: string): Promise<void> {
  await page.getByTestId(OT_TEST_IDS.statusTab(filter)).click();
}

export function otJourneyRow(page: Page, journeyId: string) {
  return page.getByTestId(OT_TEST_IDS.journeyRow(journeyId));
}

export async function confirmOtDialog(page: Page): Promise<void> {
  const dialog = page.getByTestId(OT_TEST_IDS.confirmDialog);
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await page.getByTestId(OT_TEST_IDS.confirmYes).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

export async function clickOtAccept(page: Page, journeyId: string): Promise<void> {
  await withNativeDialogsAccepted(page, async () => {
    await page.getByTestId(OT_TEST_IDS.acceptBtn(journeyId)).click();
    await confirmOtDialog(page);
  });
}

export async function clickOtStartSurgery(page: Page, journeyId: string): Promise<void> {
  await withNativeDialogsAccepted(page, async () => {
    await page.getByTestId(OT_TEST_IDS.startSurgeryBtn(journeyId)).click();
    await confirmOtDialog(page);
  });
}

export async function clickOtEndSurgery(page: Page, journeyId: string): Promise<void> {
  await withNativeDialogsAccepted(page, async () => {
    await page.getByTestId(OT_TEST_IDS.endSurgeryBtn(journeyId)).click();
    await confirmOtDialog(page);
  });
}

export async function clickOtMoveToPostOp(page: Page, journeyId: string): Promise<void> {
  await page.getByTestId(OT_TEST_IDS.moveToPostOpBtn(journeyId)).click();
}
