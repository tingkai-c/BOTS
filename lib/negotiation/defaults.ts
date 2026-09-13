import type { Listing } from '@/lib/schemas';
import { negotiationSettings, type NegotiationSettings } from './contracts';

// Matches the manual "Set up negotiation" form's existing defaults (components/workspace-negotiations.tsx)
// so an auto-liked listing negotiates on the same terms a human filling in the form would pick.
export function defaultNegotiationSettings(listing: Pick<Listing, 'price' | 'currency' | 'shippingCost'>): NegotiationSettings {
  return negotiationSettings.parse({
    openingOffer: Math.max(1, Math.round(listing.price * 0.8)),
    maximum: Math.max(1, Math.round(listing.price * 0.95)),
    currency: listing.currency,
    costBasis: listing.shippingCost ? 'shipped' : 'pickup',
    tone: 'Friendly',
    instructions: 'Negotiate warmly, be willing to compromise, and accept once the seller reaches or comes under your maximum.',
    expiresAt: Date.now() + 24 * 3600_000,
  });
}
