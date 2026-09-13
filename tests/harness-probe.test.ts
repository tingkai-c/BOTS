import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/internal/harness-probe/route';

test('probe rejects disabled, production, expired, and unauthenticated requests before browser work', async () => {
  const names = ['VERCEL_ENV', 'HARNESS_PROBE_TOKEN', 'HARNESS_PROBE_EXPIRES_AT'] as const;
  const previous = names.map(name => process.env[name]);
  const token = 'test-token-'.repeat(4);
  const request = (value?: string) => new Request('https://example.test/api/internal/harness-probe', {
    method: 'POST', headers: value ? { authorization: `Bearer ${value}` } : {},
  });
  try {
    process.env.HARNESS_PROBE_TOKEN = token;
    process.env.HARNESS_PROBE_EXPIRES_AT = String(Date.now() + 60_000);
    for (const environment of ['production', 'development', '']) {
      process.env.VERCEL_ENV = environment;
      assert.equal((await POST(request(token))).status, 404);
    }
    process.env.VERCEL_ENV = 'preview';
    assert.equal((await POST(request())).status, 401);
    assert.equal((await POST(request('x'.repeat(token.length)))).status, 401);
    process.env.HARNESS_PROBE_EXPIRES_AT = String(Date.now() - 1);
    assert.equal((await POST(request(token))).status, 404);
    process.env.HARNESS_PROBE_EXPIRES_AT = 'invalid';
    assert.equal((await POST(request(token))).status, 404);
    process.env.HARNESS_PROBE_EXPIRES_AT = String(Date.now() + 60_000);
    delete process.env.HARNESS_PROBE_TOKEN;
    const response = await POST(request(token));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});
