import type { Page } from 'playwright-core';
import { listingSchema, type Listing, type Marketplace } from '@/lib/schemas';
import { readDetailDocument } from './detail';
const hosts:Record<Marketplace,string>={facebook:'facebook.com',ebay:'ebay.com',kijiji:'kijiji.ca'};
const paths:Record<Marketplace,RegExp>={facebook:/^\/marketplace\/item\/\d+/,ebay:/^\/itm\//,kijiji:/^\/v-.+\/\d+/};
const names:Record<Marketplace,string>={facebook:'Facebook',ebay:'eBay',kijiji:'Kijiji'};
export function validateListingUrl(raw:string,marketplace:Marketplace){const u=new URL(raw);const host=hosts[marketplace];if(u.protocol!=='https:'||!(u.hostname===host||u.hostname===`www.${host}`||u.hostname===`m.${host}`||(marketplace==='ebay'&&(u.hostname==='ebay.ca'||u.hostname==='www.ebay.ca')))||!paths[marketplace].test(u.pathname))throw new Error('This listing URL is not supported.');return u.toString();}
export function detectListingUrl(raw:string):{marketplace:Marketplace;url:string}|null{const trimmed=raw.trim().replace(/^["']|["']$/g,'');if(!trimmed)return null;const withProto=/^https?:\/\//i.test(trimmed)?trimmed:`https://${trimmed}`;try{const u=new URL(withProto);for(const m of ['facebook','ebay','kijiji'] as const){const host=hosts[m];const hostMatch=u.hostname===host||u.hostname===`www.${host}`||u.hostname===`m.${host}`||(m==='ebay'&&(u.hostname==='ebay.ca'||u.hostname==='www.ebay.ca'));if(hostMatch&&paths[m].test(u.pathname)){return {marketplace:m,url:u.toString()};}}}catch{return null;}return null;}
export function extractTitleFromUrl(urlStr:string,marketplace:Marketplace):string{try{const u=new URL(urlStr);if(marketplace==='kijiji'){const segments=u.pathname.split('/').filter(Boolean);const candidates=segments.filter(s=>!s.startsWith('v-')&&!/^\d+$/.test(s));const titleSlug=candidates[candidates.length-1];if(titleSlug)return titleSlug.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}else if(marketplace==='ebay'){const segments=u.pathname.split('/').filter(Boolean);const itmIdx=segments.indexOf('itm');if(itmIdx>=0&&segments[itmIdx+1]&&!/^\d+$/.test(segments[itmIdx+1])){return segments[itmIdx+1].replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}const nkw=u.searchParams.get('_nkw');if(nkw)return nkw;}}catch{}return '';}
export async function dismissCookies(page:Page){for(const name of ['Decline optional cookies','Only allow essential cookies','Reject all','Accept all']){const b=page.getByRole('button',{name,exact:true});if(await b.count()){await b.first().click({timeout:1500}).catch(()=>{});break;}}}
const blockTitles=/error page|pardon our interruption|access (to this page has been )?denied|unusual traffic|are you a robot|robot check|verify you are human|security check|just a moment|attention required|request unsuccessful/i;
const blockMarkers='#px-captcha, .px-captcha-container, iframe[src*="captcha"], #captcha, .g-recaptcha, #cf-challenge-running, [id*="challenge-running"], [id*="challenge-stage"]';
// Callers need to tell "reconnect this account" states apart from generic failures without
// re-parsing message text (matching on wording is exactly what broke last time the copy changed).
// kind stays coarse-grained: sign_in, challenge, and blocked all resolve the same way in the UI
// (reconnect the marketplace), they just explain *why* differently.
export class MarketplaceGateError extends Error{constructor(message:string,public readonly kind:'sign_in'|'challenge'|'blocked'){super(message);this.name='MarketplaceGateError';}}
export async function requireLoginCheck(page:Page,marketplace:Marketplace){
 // "checkpoint"/"challenge" redirects are usually an anti-bot interstitial, not an actual
 // login wall — telling the user to "sign in" there is misleading, since reconnecting won't
 // clear a bot flag. Keep that path's wording distinct from a genuine login/signin redirect.
 if(/checkpoint|challenge/.test(page.url()))throw new MarketplaceGateError(`${names[marketplace]} flagged this browsing session for extra verification. Try again in a moment, or reconnect this marketplace to refresh its identity.`,'challenge');
 if(/login|signin/.test(page.url())||await page.locator('input[name="email"], input[name="login"]').count())throw new MarketplaceGateError(`${names[marketplace]} needs you to sign in. Open Connect accounts, then retry.`,'sign_in');
 const title=await page.title().catch(()=>'');
 if(blockTitles.test(title)||await page.locator(blockMarkers).count())throw new MarketplaceGateError(`${names[marketplace]} blocked this browsing session as automated traffic. Sign in to ${names[marketplace]} in Connect accounts, then retry.`,'blocked');
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
  const args={marketplace:listing.marketplace,itemId:new URL(listing.listingUrl).pathname.split('/').filter(Boolean).pop()!};
  const deadline=Date.now()+5000;
  let detail=await page.evaluate(readDetailDocument,args);
  const expanded=new Set<string>();
  let descriptionScrolled=false;
  // A title can render before the description. Poll actual detail content,
  // including expand controls that arrive after the first render.
  while(true){
   for(const name of ['See more','Show more','Read more']){
    if(expanded.has(name))continue;
    const button=page.getByRole('button',{name,exact:true}).first();
    if(await button.isVisible()){
     await button.click({timeout:1000}).then(()=>expanded.add(name)).catch(()=>{});
     await page.waitForTimeout(200);
    }
   }
   detail=await page.evaluate(readDetailDocument,args);
   if(listing.marketplace==='ebay'&&!detail.description){
    // eBay hosts seller-authored descriptions in a separate document.
    const iframe=page.locator('iframe#desc_ifr');
    if(await iframe.count()){
     // Live pages lazy-load this offscreen frame. Locator-based access also
     // survives frame replacement without holding a stale element handle.
     if(!descriptionScrolled)descriptionScrolled=await iframe.scrollIntoViewIfNeeded({timeout:2000}).then(()=>true).catch(()=>false);
     detail.description=await iframe.contentFrame().locator('#ds_div, .x-item-description-child').first().innerText({timeout:1500}).catch(()=>'');
    }
   }
   if(detail.description||detail.sold||Date.now()>=deadline)break;
   await page.waitForTimeout(250);
  }
  await requireLoginCheck(page,listing.marketplace);validateListingUrl(page.url(),listing.marketplace);
  detail.description=detail.description.trim();
 if(!detail.title&&!detail.price&&!detail.description&&!detail.available&&!detail.sold)throw new Error('Product detail layout is not recognized.');
 const currency=detail.currency==='CAD'||detail.currency==='USD'?detail.currency:listing.currency;
  return listingSchema.parse({...listing,title:detail.title||listing.title,description:(detail.description||listing.description||'').slice(0,6000),price:detail.price&&Number.isFinite(Number(detail.price))?Number(detail.price):listing.price,currency,currencyVerified:detail.currency==='CAD'||detail.currency==='USD'?true:listing.currencyVerified,condition:detail.condition||listing.condition,imageUrls:[...new Set([...detail.images,...listing.imageUrls])].filter(u=>/^https:\/\//.test(u)).slice(0,8),sellerName:detail.seller||listing.sellerName,location:detail.location||listing.location,availability:detail.sold?'sold':detail.available?'available':'unknown',inspectionStatus:detail.description?'complete':'failed',inspectionError:detail.description?undefined:detail.sold?'Listing sold. Its description could not be read.':'The listing opened, but its description could not be read. Other extracted details are saved; retry inspection or view the original.',inspectedAt:Date.now()});
}
