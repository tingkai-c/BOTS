import type { Page } from 'playwright-core';
import { listingSchema, type Listing, type Marketplace } from '@/lib/schemas';
const hosts:Record<Marketplace,string>={facebook:'facebook.com',ebay:'ebay.com',kijiji:'kijiji.ca'};
const paths:Record<Marketplace,RegExp>={facebook:/^\/marketplace\/item\/\d+/,ebay:/^\/itm\//,kijiji:/^\/v-.+\/\d+/};
const names:Record<Marketplace,string>={facebook:'Facebook',ebay:'eBay',kijiji:'Kijiji'};
export function validateListingUrl(raw:string,marketplace:Marketplace){const u=new URL(raw);const host=hosts[marketplace];if(u.protocol!=='https:'||!(u.hostname===host||u.hostname===`www.${host}`)||!paths[marketplace].test(u.pathname))throw new Error('This listing URL is not supported.');return u.toString();}
export async function dismissCookies(page:Page){for(const name of ['Decline optional cookies','Only allow essential cookies','Reject all','Accept all']){const b=page.getByRole('button',{name,exact:true});if(await b.count()){await b.first().click({timeout:1500}).catch(()=>{});break;}}}
const blockTitles=/error page|pardon our interruption|access (to this page has been )?denied|unusual traffic|are you a robot|robot check|verify you are human|security check|just a moment|attention required|request unsuccessful/i;
const blockMarkers='#px-captcha, .px-captcha-container, iframe[src*="captcha"], #captcha, .g-recaptcha, #cf-challenge-running, [id*="challenge-running"], [id*="challenge-stage"]';
export async function requireLoginCheck(page:Page,marketplace:Marketplace){
 // "checkpoint"/"challenge" redirects are usually an anti-bot interstitial, not an actual
 // login wall — telling the user to "sign in" there is misleading, since reconnecting won't
 // clear a bot flag. Keep that path's wording distinct from a genuine login/signin redirect.
 if(/checkpoint|challenge/.test(page.url()))throw new Error(`${names[marketplace]} flagged this browsing session for extra verification. Try again in a moment, or reconnect this marketplace to refresh its identity.`);
 if(/login|signin/.test(page.url())||await page.locator('input[name="email"], input[name="login"]').count())throw new Error(`${names[marketplace]} needs you to sign in. Open Connect accounts, then retry.`);
 const title=await page.title().catch(()=>'');
 if(blockTitles.test(title)||await page.locator(blockMarkers).count())throw new Error(`${names[marketplace]} blocked this browsing session as automated traffic. Sign in to ${names[marketplace]} in Connect accounts, then retry.`);
}
// Marketplaces are client-rendered SPAs: a login redirect or bot-check can appear well after
// domcontentloaded. Poll for whichever real outcome (results, login wall, block page) shows up
// first instead of guessing a fixed wait, then let requireLoginCheck turn a gate into an error.
export async function waitForResultsOrGate(page:Page,marketplace:Marketplace,resultsSelector:string,timeout=15000){
 try{await page.waitForFunction(({sel,blockSrc,blockSel})=>{
  if(document.querySelector(sel))return true;
  if(document.querySelector('input[name="email"], input[name="login"]'))return true;
  if(new RegExp(blockSrc,'i').test(document.title))return true;
  if(document.querySelector(blockSel))return true;
  return false;
 },{sel:resultsSelector,blockSrc:blockTitles.source,blockSel:blockMarkers},{timeout,polling:250});}catch{/* neither results nor a known gate appeared in time */}
 await requireLoginCheck(page,marketplace);
}
export async function inspectListing(page:Page,listing:Listing){
 await page.goto(validateListingUrl(listing.listingUrl,listing.marketplace),{waitUntil:'domcontentloaded',timeout:20000});await dismissCookies(page);await requireLoginCheck(page,listing.marketplace);validateListingUrl(page.url(),listing.marketplace);
 await page.locator('h1').first().waitFor({timeout:5000}).catch(()=>{});
 for(const name of ['See more','Show more','Read more']){const button=page.getByRole('button',{name,exact:true});if(await button.count()){await button.first().click({timeout:1500}).catch(()=>{});break;}}
 const detail=await page.evaluate(()=>{
  const text=(s:string)=>document.querySelector(s)?.textContent?.trim()||'';
  const meta=(s:string)=>document.querySelector(s)?.getAttribute('content')||'';
  const products:Record<string,unknown>[]=[];
  function visit(value:unknown,depth=0){if(depth>8||!value||typeof value!=='object')return;if(Array.isArray(value)){value.slice(0,100).forEach(x=>visit(x,depth+1));return;}const obj=value as Record<string,unknown>;if(obj['@type']==='Product'||Array.isArray(obj['@type'])&&obj['@type'].includes('Product'))products.push(obj);if(obj['@graph'])visit(obj['@graph'],depth+1);}
  for(const script of document.querySelectorAll('script[type="application/ld+json"]')){try{visit(JSON.parse(script.textContent||''));}catch{}}
  const product=products[0];const offer=(Array.isArray(product?.offers)?product.offers[0]:product?.offers) as Record<string,unknown>|undefined;
  const body=document.body.innerText;
  return {title:typeof product?.name==='string'?product.name:text('h1'),description:typeof product?.description==='string'?product.description:text('[itemprop="description"], .x-item-description, [data-testid="description"], [data-testid="ad-description"]'),price:String(offer?.price??meta('[property="product:price:amount"]')),currency:String(offer?.priceCurrency??meta('[property="product:price:currency"]')),condition:typeof product?.itemCondition==='string'?product.itemCondition.split('/').pop():text('[itemprop="itemCondition"], .x-item-condition-text'),images:Array.from(document.querySelectorAll('[property="og:image"]')).map(n=>n.getAttribute('content')||''),seller:text('[itemprop="seller"] [itemprop="name"], .x-sellercard-atf__info__about-seller, [data-testid="seller-name"]'),location:text('[itemprop="addressLocality"], [data-testid="location"]'),sold:/OutOfStock|SoldOut|Discontinued/.test(String(offer?.availability))||/This listing (?:has sold|is no longer available)|This ad is no longer available|This listing sold/i.test(body),available:/InStock|LimitedAvailability/.test(String(offer?.availability))||Array.from(document.querySelectorAll('button,a')).some(n=>/^Message seller$|^Contact seller$|^Reply to Ad$/i.test(n.textContent?.trim()||''))};
 });
 if(!detail.title&&!detail.price&&!detail.description&&!detail.available&&!detail.sold)throw new Error('Product detail layout is not recognized.');
 const currency=detail.currency==='CAD'||detail.currency==='USD'?detail.currency:listing.currency;
 return listingSchema.parse({...listing,title:detail.title||listing.title,description:(detail.description||listing.description||'').slice(0,6000),price:detail.price&&Number.isFinite(Number(detail.price))?Number(detail.price):listing.price,currency,currencyVerified:detail.currency==='CAD'||detail.currency==='USD'?true:listing.currencyVerified,condition:detail.condition||listing.condition,imageUrls:[...new Set([...detail.images,...listing.imageUrls])].filter(u=>/^https:\/\//.test(u)).slice(0,8),sellerName:detail.seller||listing.sellerName,location:detail.location||listing.location,availability:detail.sold?'sold':detail.available?'available':'unknown',inspectionStatus:'complete',inspectedAt:Date.now()});
}
