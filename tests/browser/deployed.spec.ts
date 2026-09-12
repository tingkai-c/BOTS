import { test, expect } from '@playwright/test';

test.describe('public deployment', () => {
  test.skip(process.env.QA_LIVE_AUTH !== '1', 'Run explicitly against the configured public deployment.');

  test('Haggleface example search prompts sign-in without JSON or runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/');
    await expect(page).toHaveTitle(/Haggleface/);
    await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /UNDER \$250 Sony/ }).click();
    await expect(page.getByRole('heading', { name: /Sign in to Haggle Face/ })).toBeVisible();
    await expect(page.locator('.error-state')).toHaveText(/Sign in to use your shopping agent/);
    await page.screenshot({ path: 'test-results/deployed-sign-in.png', animations: 'disabled', caret: 'initial' });
    await page.getByRole('button', { name: 'Close modal' }).click();
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Create your account/ })).toBeVisible();
    await page.screenshot({ path: 'test-results/deployed-sign-up.png', animations: 'disabled', caret: 'initial' });
    expect(errors).toEqual([]);
  });

  test('all agent endpoints load their runtime and return structured unauthenticated responses', async ({ request }) => {
    for (const path of ['/api/search', '/api/identify', '/api/inspect', '/api/connections', '/api/negotiate', '/api/negotiate/send']) {
      const response = await request.post(path, { data: { query: 'headphones' } });
      expect(response.status(), path).toBe(401);
      expect(await response.json()).toEqual({ error: 'Sign in to use your shopping agent.' });
    }
  });
});
