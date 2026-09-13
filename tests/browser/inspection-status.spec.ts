import { test, expect } from '@playwright/test';
import type { SearchState } from '../../lib/schemas';

test('restored title-only complete record is visibly incomplete on desktop and mobile', async ({ page }) => {
  const state: SearchState = {
    id: 'legacy-inspection-test', query: 'Aeron', status: 'complete', demo: true,
    filters: { currency: 'USD', condition: 'any', marketplace: 'facebook', location: 'Toronto', radius: 25 },
    events: [], runs: [{ marketplace: 'facebook', status: 'searching', message: 'Demo test' }],
    listings: [{
      id: 'facebook-123', searchId: 'legacy-inspection-test', marketplace: 'facebook',
      title: 'Herman Miller Aeron Chair', price: 150, currency: 'USD',
      description: '', inspectionStatus: 'complete', inspectedAt: 100,
      imageUrls: ['/chair.jpg'], listingUrl: 'https://www.facebook.com/marketplace/item/123/',
      scrapedAt: 100, confidence: .8, similarityScore: .9, demo: true,
    }],
  };
  await page.addInitScript(value => sessionStorage.setItem(`scout:${value.id}`, JSON.stringify(value)), state);
  await page.goto(`/search/${state.id}`);
  await expect(page.locator('input[aria-label="What are you looking for?"]')).toHaveValue('Aeron');
  // Close the automatic deal-review prompt to inspect the listing itself.
  await page.keyboard.press('Escape');
  await page.locator('.listing-card').getByRole('button', { name: 'Details', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('No description extracted yet');
  await expect(dialog.getByRole('status')).toContainText('Details: Incomplete');
  await expect(dialog).not.toContainText('Details: complete');
  await expect(dialog.getByRole('button', { name: 'Inspect with agent' })).toBeVisible();
  await page.screenshot({ path: 'test-results/inspection-incomplete-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByRole('status')).toBeVisible();
  await expect(dialog.getByRole('status')).toContainText('Details: Incomplete');
  await page.screenshot({ path: 'test-results/inspection-incomplete-mobile.png' });
});
