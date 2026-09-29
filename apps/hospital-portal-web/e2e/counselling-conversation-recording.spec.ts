/**
 * Slice A — opening a counselling session must not start or upload a recording.
 * Does not replace the existing counselling session suite.
 */
import { test, expect } from '@playwright/test';
import { goCounsellingSession, hasCounsellingFixture } from './helpers/counselling';

test.describe('Counselling conversation recording @counselling', () => {
  test('does not create a conversation or upload audio when the session opens', async ({ page }) => {
    test.skip(!hasCounsellingFixture(), 'Set E2E_COUNSELLING_SESSION_ID');

    const recordingPosts: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'POST') return;
      const url = request.url();
      if (url.includes('/recordings') || url.includes('/conversations')) {
        recordingPosts.push(url);
      }
    });

    await goCounsellingSession(page);
    await page.waitForTimeout(1000);
    expect(recordingPosts).toEqual([]);
    await expect(page.getByRole('button', { name: 'View counselling conversations' })).toBeVisible();

    const conversationGets: number[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (response.request().method() === 'GET' && url.includes('/conversations') && !url.includes('/content')) {
        conversationGets.push(response.status());
      }
    });
    await page.getByRole('button', { name: 'View counselling conversations' }).click();
    await expect.poll(() => conversationGets.length).toBeGreaterThan(0);
    expect(conversationGets).not.toContain(405);
    expect(conversationGets[0]).toBe(200);
  });

  test('full recording, history, and playback-stop path', async () => {
    test.skip(true, 'Requires a live in-progress owned session, microphone permission, and a running portal. Not executed in this slice.');
  });
});
