import type { Page } from 'playwright-core';
import type { Listing, Marketplace } from '@/lib/schemas';
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
export async function inspectListing(page:Page,listing:Listing){await page.goto(validateListingUrl(listing.listingUrl,listing.marketplace),{waitUntil:'domcontentloaded',timeout:30000});await dismissCookies(page);await requireLoginCheck(page,listing.marketplace);return {title:await page.title(),description:(await page.locator('body').innerText()).slice(0,6000)};}
