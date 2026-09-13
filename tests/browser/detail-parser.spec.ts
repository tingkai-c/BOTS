import { test, expect } from '@playwright/test';
import { inspectListing } from '../../lib/marketplaces/shared';
import { listingSchema } from '../../lib/schemas';

const listing = (marketplace: 'facebook' | 'ebay' = 'facebook') => listingSchema.parse({
  id: `${marketplace}-123`, searchId: 'parser-test', marketplace,
  listingUrl: marketplace === 'facebook' ? 'https://www.facebook.com/marketplace/item/123/' : 'https://www.ebay.com/itm/123',
  title: 'Herman Miller Aeron Chair', price: 375, currency: 'USD', currencyVerified: false,
  imageUrls: [], scrapedAt: 1, inspectionStatus: 'pending',
});

// Synthetic DOM fixtures: no marketplace requests or seller interactions.
test('title-only page is not a complete inspection', async ({ page }) => {
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<h1>Herman Miller Aeron Chair</h1>' }));
  const result = await inspectListing(page, listing());
  expect(result.inspectionStatus).toBe('failed');
  expect(result.inspectionError).toContain('description');
  expect(result.price).toBe(375);
  expect(result.currencyVerified).toBe(false);
});

test('Facebook reads delayed semantic description, condition and seller', async ({ page }) => {
  const details = `<section><h2>Description</h2><div>Mesh chair.<button onclick="this.parentElement.textContent='Mesh chair. All adjustments work.'">See more</button></div></section><section><h2>Condition</h2><span>Used - Good</span></section><section><h2>Seller information</h2><a href="/marketplace/profile/456/">Alex Seller</a></section>`;
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `
    <main><h1>Herman Miller Aeron Chair</h1><div id="details"></div></main>
    <script>setTimeout(() => document.querySelector('#details').innerHTML = ${JSON.stringify(details)}, 700)</script>
  ` }));
  const result = await inspectListing(page, listing());
  expect(result.description).toBe('Mesh chair. All adjustments work.');
  expect(result.sellerName).toBe('Alex Seller');
  expect(result.condition).toBe('Used - Good');
  expect(result.inspectionStatus).toBe('complete');
  expect(result.currencyVerified).toBe(false);
});

test('eBay reads seller description from its description iframe', async ({ page }) => {
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `
    <h1>Herman Miller Aeron Chair</h1>
    <iframe id="desc_ifr" srcdoc="<div id='ds_div'>Fully working chair with adjustable arms.</div>"></iframe>
    <div class="x-sellercard-atf__info__about-seller">Chair Shop</div>
  ` }));
  const result = await inspectListing(page, listing('ebay'));
  expect(result.description).toBe('Fully working chair with adjustable arms.');
  expect(result.sellerName).toBe('Chair Shop');
  expect(result.inspectionStatus).toBe('complete');
});

test('eBay loads an offscreen description frame using the current live container', async ({ page }) => {
  // Container and lazy-loading attribute observed on live item 121905415783.
  await page.route('https://www.ebay.com/itm/123', route => route.fulfill({ contentType: 'text/html', body: `
    <h1>Aeron Size B</h1><div style="height:15000px"></div>
    <iframe id="desc_ifr" loading="lazy" src="https://itm.ebaydesc.com/itmdesc/123"></iframe>
  ` }));
  await page.route('https://itm.ebaydesc.com/itmdesc/123', async route => {
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill({ contentType: 'text/html', body: '<div class="x-item-description-child" data-testid="x-item-description-child">Aeron Chair Size B. Posture Fit. Height Adjustable/Pivoting Arms.</div>' });
  });
  const result = await inspectListing(page, listing('ebay'));
  expect(result.description).toContain('Posture Fit');
  expect(result.inspectionStatus).toBe('complete');
});

test('Facebook hydrated data matches the requested item, not recommendations', async ({ page }) => {
  const data = { data: { recommendations: [{ id: '999', marketplace_listing_title: 'Wrong chair', redacted_description: { text: 'Wrong description' } }], listing: {
    id: '123', marketplace_listing_title: 'Aeron Size B', redacted_description: { text: 'Size B. New arm pads.' },
    listing_price: { amount: '375', currency: 'USD' }, marketplace_listing_seller: { name: 'Alex' },
    location: { reverse_geocode: { city: 'Sterling', state: 'VA' } },
  } } };
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<h1>Aeron</h1>
    <script type="application/json">{broken</script><script type="application/json">${JSON.stringify(data)}</script>` }));
  const result = await inspectListing(page, { ...listing(), inspectionError: 'Previous failure' });
  expect(result.description).toBe('Size B. New arm pads.');
  expect(result.title).toBe('Aeron Size B');
  expect(result.location).toBe('Sterling, VA');
  expect(result.sellerName).toBe('Alex');
  expect(result.currencyVerified).toBe(true);
  expect(result.inspectionError).toBeUndefined();
});

test('partial eBay read preserves new seller data and old description without claiming success', async ({ page }) => {
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<h1>Aeron Size B</h1><div data-testid="seller-name">Chair Shop</div>' }));
  const result = await inspectListing(page, { ...listing('ebay'), description: 'Previously saved description' });
  expect(result.description).toBe('Previously saved description');
  expect(result.sellerName).toBe('Chair Shop');
  expect(result.inspectionStatus).toBe('failed');
});

test('structured product descriptions continue to work', async ({ page }) => {
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'Product', name: 'Aeron Size B', description: 'Adjustable mesh chair.', offers: { price: '399', priceCurrency: 'CAD', availability: 'https://schema.org/InStock', seller: { name: 'Chair Shop' } } }] })}</script>` }));
  const result = await inspectListing(page, listing('ebay'));
  expect(result.description).toBe('Adjustable mesh chair.');
  expect(result.currency).toBe('CAD');
  expect(result.price).toBe(399);
  expect(result.availability).toBe('available');
  expect(result.sellerName).toBe('Chair Shop');
});

test('late-loading login wall is reported rather than accepted as details', async ({ page }) => {
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<h1>Aeron Size B</h1><script>setTimeout(() => document.body.insertAdjacentHTML('beforeend', '<input name="email">'), 500)</script>` }));
  await expect(inspectListing(page, listing())).rejects.toThrow('needs you to sign in');
});
