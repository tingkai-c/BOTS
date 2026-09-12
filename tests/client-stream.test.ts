import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStream, RequestError } from '../lib/client-stream';

test('empty Vercel 500 response produces an actionable error, not a JSON exception', async () => {
  await assert.rejects(readStream(new Response(null, { status: 500 }), () => {}), e => e instanceof RequestError && e.status === 500 && !e.message.includes('JSON'));
});
test('authentication status survives JSON parsing for the sign-in prompt', async () => {
  await assert.rejects(readStream(Response.json({ error: 'Sign in to use your shopping agent.' }, { status: 401 }), () => {}), e => e instanceof RequestError && e.status === 401);
});
test('partial chunks reconstruct NDJSON events and truncated responses fail clearly', async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({ start(c) { c.enqueue(encoder.encode('{"type":')); c.enqueue(encoder.encode('"ready"}\n{"type":"done"}')); c.close(); } });
  const events: unknown[] = [];
  await readStream(new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } }), e => events.push(e));
  assert.deepEqual(events, [{ type: 'ready' }, { type: 'done' }]);
  await assert.rejects(readStream(new Response('{"type":', { headers: { 'Content-Type': 'application/x-ndjson' } }), () => {}), /connection was interrupted/i);
});
