import { test, expect } from '@playwright/test';

test('server rejects blank searches, invalid image URLs, and forged approvals', async ({ request }) => {
  for (const data of [{ query: '' }, { query: 'headphones', image: 'http://169.254.169.254/' }]) {
    const response = await request.post('/api/search', { data });
    expect(response.status()).toBe(400);
  }
  const unapproved = await request.post('/api/negotiate/send', { data: { token: 'forged', message: 'hello seller', approved: false } });
  expect(unapproved.status()).toBe(400);
  const forged = await request.post('/api/negotiate/send', { data: { token: 'forged.signature', message: 'hello seller', approved: true } });
  expect(forged.status()).toBe(400);
  expect((await forged.json()).error).toContain('Invalid approval');
});
