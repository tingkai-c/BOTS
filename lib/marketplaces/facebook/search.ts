import type { Page } from 'playwright-core';
import type { Listing, SearchInput } from '@/lib/schemas';
import { dismissCookies, requireLoginCheck, waitForResultsOrGate } from '../shared';
import { extractListings } from './extract';
import { cityCoordinates } from '../geocode';
export async function searchFacebookMarketplace(page:Page,id:string,query:string,input:SearchInput,onListing:(l:Listing)=>Promise<void>){
 // Unlike eBay/Kijiji, Marketplace has no location URL param — it infers "local" results from
 // the browser's geolocation/IP. Without this, a Steel session's proxy IP can leave the browser
 // far from the requested city, so Marketplace returns nothing nearby even on a normal page.
 const coords=input.location?cityCoordinates(input.location):null;
 if(coords){await page.context().grantPermissions(['geolocation'],{origin:'https://www.facebook.com'});await page.context().setGeolocation(coords);}
 const url=new URL('https://www.facebook.com/marketplace/search/');url.searchParams.set('query',query);url.searchParams.set('sortBy','creation_time_descend');if(input.maxPrice)url.searchParams.set('maxPrice',String(input.maxPrice));url.searchParams.set('radius',String(input.radius));await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:35000});await dismissCookies(page);await requireLoginCheck(page,'facebook');await waitForResultsOrGate(page,'facebook','a[href*="/marketplace/item/"]');await extractListings(page,id,query,onListing);await page.mouse.wheel(0,900);await page.waitForTimeout(1200);await requireLoginCheck(page,'facebook');await extractListings(page,id,query,onListing);}
