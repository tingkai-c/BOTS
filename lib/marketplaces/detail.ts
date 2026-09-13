import type { Marketplace } from '@/lib/schemas';

// Runs inside the marketplace page. Keep helpers inside this function so
// Playwright can serialize it without importing application code into the page.
export function readDetailDocument({ marketplace, itemId }: { marketplace: Marketplace; itemId: string }) {
  const text = (selector: string) => document.querySelector(selector)?.textContent?.trim() || '';
  const meta = (selector: string) => document.querySelector(selector)?.getAttribute('content') || '';
  const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const products: Record<string, unknown>[] = [];
  let facebook: Record<string, unknown> = {};
  let visited = 0;
  function visit(value: unknown, depth = 0) {
    if (depth > 30 || ++visited > 20000 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(x => visit(x, depth + 1)); return; }
    const obj = record(value);
    if (obj['@type'] === 'Product' || Array.isArray(obj['@type']) && obj['@type'].includes('Product')) products.push(obj);
    // Facebook's hydrated listing data is tied to the requested item, never
    // recommendation cards or other sellers elsewhere on the page.
    if (marketplace === 'facebook' && obj.id === itemId && ('redacted_description' in obj || 'marketplace_listing_title' in obj)) facebook = obj;
    Object.values(obj).forEach(x => visit(x, depth + 1));
  }
  for (const script of document.querySelectorAll('script[type="application/ld+json"], script[type="application/json"]')) {
    if ((script.textContent?.length ?? 0) > 2_000_000) continue;
    try { visit(JSON.parse(script.textContent || '')); } catch { /* Skip malformed data, never execute scripts. */ }
  }
  const product = products.find(p => {
    try { return new URL(string(p.url)).pathname.split('/').filter(Boolean).pop() === itemId; } catch { return false; }
  }) ?? (products.length === 1 ? products[0] : undefined);
  const offer = record(Array.isArray(product?.offers) ? product.offers[0] : product?.offers);
  const root = Array.from(document.querySelectorAll('[role="dialog"], main, [role="main"]')).find(n => n.querySelector('h1'));
  // Facebook often exposes labels and text instead of itemprop/test IDs.
  // Restrict the fallback to a small labelled section within the listing.
  function labelled(label: string) {
    if (!root) return '';
    const heading = Array.from(root.querySelectorAll('h2, h3, span, [role="heading"]'))
      .find(n => n.textContent?.trim() === label && !Array.from(n.children).some(c => c.textContent?.trim() === label));
    let section = heading?.parentElement;
    for (let depth = 0; section && section !== root && depth < 3; depth++, section = section.parentElement) {
      const value = section.innerText.trim();
      if (value.startsWith(label) && value.length > label.length && value.length <= 6500) return value.slice(label.length).trim();
    }
    return '';
  }
  const price = record(facebook.listing_price);
  const seller = record(facebook.marketplace_listing_seller);
  const address = record(record(facebook.location).reverse_geocode);
  const body = document.body.innerText;
  return {
    title: string(facebook.marketplace_listing_title) || string(product?.name) || text('h1'),
    description: string(record(facebook.redacted_description).text) || string(product?.description) || text('[itemprop="description"], .x-item-description, [data-testid="description"], [data-testid="ad-description"]') || (marketplace === 'facebook' ? labelled('Description') : ''),
    price: String(price.amount ?? offer.price ?? meta('[property="product:price:amount"]')),
    currency: String(price.currency ?? offer.priceCurrency ?? meta('[property="product:price:currency"]')),
    condition: string(product?.itemCondition).split('/').pop() || text('[itemprop="itemCondition"], .x-item-condition-text') || (marketplace === 'facebook' ? labelled('Condition') : ''),
    images: Array.from(document.querySelectorAll('[property="og:image"]')).map(n => n.getAttribute('content') || ''),
    seller: string(seller.name) || string(record(offer.seller).name) || string(record(product?.seller).name) || text('[itemprop="seller"] [itemprop="name"], .x-sellercard-atf__info__about-seller, [data-testid="seller-name"]') || (marketplace === 'facebook' ? root?.querySelector('a[href*="/marketplace/profile/"]')?.textContent?.trim() || '' : ''),
    location: [string(address.city), string(address.state)].filter(Boolean).join(', ') || text('[itemprop="addressLocality"], [data-testid="location"]'),
    sold: facebook.is_sold === true || /OutOfStock|SoldOut|Discontinued/.test(String(offer.availability)) || /This listing (?:has sold|is no longer available)|This ad is no longer available|This listing sold/i.test(body),
    available: /InStock|LimitedAvailability/.test(String(offer.availability)) || Array.from(document.querySelectorAll('button,a')).some(n => /^Message seller$|^Contact seller$|^Reply to Ad$/i.test(n.textContent?.trim() || '')),
  };
}
