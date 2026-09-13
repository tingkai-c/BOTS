import { timingSafeEqual } from 'node:crypto';
import { runHarnessProbe } from '@/lib/steel/harness-probe.mjs';

export const runtime = 'nodejs';
export const maxDuration = 180;
export const dynamic = 'force-dynamic';

let running = false;
const headers = { 'Cache-Control': 'no-store' };

// Temporary compatibility gate. No caller-supplied URLs, commands, or profiles.
export async function POST(request: Request) {
  const token = process.env.HARNESS_PROBE_TOKEN;
  const expires = Number(process.env.HARNESS_PROBE_EXPIRES_AT);
  if (process.env.VERCEL_ENV !== 'preview' || !token || token.length < 32 ||
      !Number.isFinite(expires) || expires <= Date.now()) {
    return new Response(null, { status: 404, headers });
  }
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return new Response(null, { status: 401, headers });
  }
  if (running) return new Response(null, { status: 409, headers });
  running = true;
  try {
    const result = await runHarnessProbe({ cloud: true });
    return Response.json(result, { status: result.passed ? 200 : 502, headers });
  } catch {
    // Never log raw CDP/SDK errors: they can contain authenticated URLs.
    return Response.json({ passed: false, stage: 'probe setup or cleanup' }, { status: 502, headers });
  } finally {
    running = false;
  }
}
