import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectListingUrl, extractTitleFromUrl } from '../lib/marketplaces/shared';
import { deduplicate, rankListings } from '../lib/scoring';
import type { Listing } from '../lib/schemas';

test('detectListingUrl identifies valid posting URLs across the 3 marketplaces', () => {
  // eBay
  assert.deepEqual(
    detectListingUrl('https://www.ebay.com/itm/1234567890'),
    { marketplace: 'ebay', url: 'https://www.ebay.com/itm/1234567890' }
  );
  assert.deepEqual(
    detectListingUrl('ebay.com/itm/987654321?hash=item123'),
    { marketplace: 'ebay', url: 'https://ebay.com/itm/987654321?hash=item123' }
  );
  assert.deepEqual(
    detectListingUrl('https://www.ebay.ca/itm/5544332211'),
    { marketplace: 'ebay', url: 'https://www.ebay.ca/itm/5544332211' }
  );

  // Facebook Marketplace
  assert.deepEqual(
    detectListingUrl('https://www.facebook.com/marketplace/item/1029384756/'),
    { marketplace: 'facebook', url: 'https://www.facebook.com/marketplace/item/1029384756/' }
  );
  assert.deepEqual(
    detectListingUrl('facebook.com/marketplace/item/5566778899'),
    { marketplace: 'facebook', url: 'https://facebook.com/marketplace/item/5566778899' }
  );

  // Kijiji
  assert.deepEqual(
    detectListingUrl('https://www.kijiji.ca/v-headphones/city-of-toronto/sony-wh-1000xm5/1234567890'),
    { marketplace: 'kijiji', url: 'https://www.kijiji.ca/v-headphones/city-of-toronto/sony-wh-1000xm5/1234567890' }
  );
});

test('detectListingUrl rejects standard search prompts and non-listing URLs', () => {
  assert.equal(detectListingUrl('Sony WH-1000XM5 under $250'), null);
  assert.equal(detectListingUrl('ebay headphones near me'), null);
  assert.equal(detectListingUrl('https://www.google.com/search?q=sony'), null);
  assert.equal(detectListingUrl('https://www.ebay.com/sch/i.html?_nkw=sony'), null);
  assert.equal(detectListingUrl('https://www.facebook.com/marketplace/search/?query=sony'), null);
  assert.equal(detectListingUrl(''), null);
});

test('extractTitleFromUrl derives reasonable titles from path slugs', () => {
  assert.equal(
    extractTitleFromUrl('https://www.kijiji.ca/v-headphones/toronto/sony-wh-1000xm5/1234567890', 'kijiji'),
    'Sony Wh 1000xm5'
  );
  assert.equal(
    extractTitleFromUrl('https://www.ebay.com/itm/sony-wh-1000xm5-wireless-headphones/1234567890', 'ebay'),
    'Sony Wh 1000xm5 Wireless Headphones'
  );
});

test('imported listing remains preserved among other listings and is ranked in context', () => {
  const importedListing: Listing = {
    id: 'imported-1',
    searchId: 'search-1',
    marketplace: 'ebay',
    title: 'Sony WH-1000XM5 - Black',
    price: 180,
    currency: 'USD',
    currencyVerified: true,
    shippingCost: 0,
    imageUrls: ['/headphones.jpg'],
    listingUrl: 'https://www.ebay.com/itm/1234567890',
    condition: 'Like new',
    scrapedAt: Date.now(),
    confidence: 0.95,
    similarityScore: 1.0,
    demo: false,
    imported: true,
  };

  const otherListing: Listing = {
    id: 'other-1',
    searchId: 'search-1',
    marketplace: 'facebook',
    title: 'Sony WH-1000XM5 Headphones',
    price: 210,
    currency: 'USD',
    currencyVerified: true,
    shippingCost: 0,
    imageUrls: ['/headphones.jpg'],
    listingUrl: 'https://www.facebook.com/marketplace/item/99999',
    condition: 'Good',
    scrapedAt: Date.now(),
    confidence: 0.9,
    similarityScore: 0.95,
    demo: false,
  };

  // 1. Deduplicate preserves the imported listing when new ones are added
  let listings = [importedListing];
  listings = deduplicate(listings, otherListing);
  assert.equal(listings.length, 2);
  assert.ok(listings.some(l => l.id === 'imported-1' && l.imported === true));
  assert.ok(listings.some(l => l.id === 'other-1'));

  // 2. Ranking includes both and ranks imported listing with deal scoring
  const ranked = rankListings(listings);
  assert.equal(ranked.length, 2);
  const rankedImported = ranked.find(l => l.id === 'imported-1');
  assert.ok(rankedImported);
  assert.ok(rankedImported.dealScore >= 0);
  assert.ok(rankedImported.imported === true);
});
