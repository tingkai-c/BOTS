import type { Page } from 'playwright-core';
import { listingSchema, type Listing, type Marketplace } from '@/lib/schemas';
import { readDetailDocument } from './detail';
const hosts:Record<Marketplace,string>={facebook:'facebook.com',ebay:'ebay.com',kijiji:'kijiji.ca'};
const paths:Record<Marketplace,RegExp>={facebook:/^\/marketplace\/item\/\d+/,ebay:/^\/itm\//,kijiji:/^\/v-.+\/\d+/};
const names:Record<Marketplace,string>={facebook:'Facebook',ebay:'eBay',kijiji:'Kijiji'};
export function validateListingUrl(raw:string,marketplace:Marketplace){const u=new URL(raw);const host=hosts[marketplace];if(u.protocol!=='https:'||!(u.hostname===host||u.hostname===`www.${host}`)||!paths[marketplace].test(u.pathname))throw new Error('This listing URL is not supported.');return u.toString();}
export async function dismissCookies(page:Page){for(const name of ['Decline optional cookies','Only allow essential cookies','Reject all','Accept all']){const b=page.getByRole('button',{name,exact:true});if(await b.count()){await b.first().click({timeout:1500}).catch(()=>{});break;}}}
const blockTitles=/error page|pardon our interruption|access (to this page has been )?denied|unusual traffic|are you a robot|robot check|verify you are human|security check|just a moment|attention required|request unsuccessful/i;
const blockMarkers='#px-captcha, .px-captcha-container, iframe[src*="captcha"], #captcha, .g-recaptcha, #cf-challenge-running, [id*="challenge-running"], [id*="challenge-stage"]';
export async function requireLoginCheck(page:Page,marketplace:Marketplace){
 if(/login|signin|checkpoint|challenge/.test(page.url())||await page.locator('input[name="email"], input[name="login"]').count())throw new Error(`${names[marketplace]} needs you to sign in. Open Connect accounts, then retry.`);
 const title=await page.title().catch(()=>'');
 if(blockTitles.test(title)||await page.locator(blockMarkers).count())throw new Error(`${names[marketplace]} blocked this browsing session as automated traffic. Sign in to ${names[marketplace]} in Connect accounts, then retry.`);
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
 if(!detail.title&&!detail.price&&!detail.description&&!detail.available&&!detail.sold)throw new Error('Product detail layout is not recognized.');
 const currency=detail.currency==='CAD'||detail.currency==='USD'?detail.currency:listing.currency;
  return listingSchema.parse({...listing,title:detail.title||listing.title,description:(detail.description||listing.description||'').slice(0,6000),price:detail.price&&Number.isFinite(Number(detail.price))?Number(detail.price):listing.price,currency,currencyVerified:detail.currency==='CAD'||detail.currency==='USD'?true:listing.currencyVerified,condition:detail.condition||listing.condition,imageUrls:[...new Set([...detail.images,...listing.imageUrls])].filter(u=>/^https:\/\//.test(u)).slice(0,8),sellerName:detail.seller||listing.sellerName,location:detail.location||listing.location,availability:detail.sold?'sold':detail.available?'available':'unknown',inspectionStatus:detail.description||detail.sold?'complete':'failed',inspectionError:detail.description||detail.sold?undefined:'The listing opened, but its description could not be read. Other extracted details are saved; retry inspection or view the original.',inspectedAt:Date.now()});
}
