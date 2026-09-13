import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NegotiationSettings } from '../negotiation/contracts';
export function signAuthorization(userId: string, id: string, version: number, settings: NegotiationSettings) {
  const secret = process.env.CONVEX_SERVER_SECRET;
  if (!secret) throw new Error('Server authorization is not configured.');
  return createHmac('sha256', secret).update(JSON.stringify(['negotiation-v1', userId, id, version, settings])).digest('hex');
}
export function verifyAuthorization(userId: string, id: string, version: number, settings: NegotiationSettings, signature: string) {
  const expected = Buffer.from(signAuthorization(userId, id, version, settings)); const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
