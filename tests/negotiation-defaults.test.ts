import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultNegotiationSettings } from '../lib/negotiation/defaults';

test('default negotiation settings stay under asking price and within the authorization window', () => {
  const settings = defaultNegotiationSettings({ price: 200, currency: 'USD', shippingCost: undefined });
  assert.equal(settings.currency, 'USD');
  assert.equal(settings.costBasis, 'pickup');
  assert.equal(settings.tone, 'Friendly');
  assert.ok(settings.openingOffer < settings.maximum, 'opening offer should be below the maximum');
  assert.ok(settings.maximum <= 200, 'maximum should never exceed the asking price');
  assert.ok(settings.expiresAt > Date.now() && settings.expiresAt <= Date.now() + 24 * 3600_000 + 1000);
});

test('shipped listings pick a shipped cost basis, and cheap items never round to a non-positive offer', () => {
  const shipped = defaultNegotiationSettings({ price: 40, currency: 'CAD', shippingCost: 8 });
  assert.equal(shipped.costBasis, 'shipped');
  const cheap = defaultNegotiationSettings({ price: 1, currency: 'USD', shippingCost: undefined });
  assert.ok(cheap.openingOffer > 0 && cheap.maximum > 0);
});
