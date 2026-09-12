import type { Page } from 'playwright-core';
import type { Listing, SearchInput } from '@/lib/schemas';
import { dismissCookies, requireLoginCheck } from '../shared';
import { extractListings } from './extract';
export async function searchFacebookMarketplace(page:Page,id:string,query:string,input:SearchInput,onListing:(l:Listing)=>Promise<void>){const url=new URL('https://www.facebook.com/marketplace/search/');url.searchParams.set('query',query);if(input.maxPrice)url.searchParams.set('maxPrice',String(input.maxPrice));url.searchParams.set('radius',String(input.radius));await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:35000});await dismissCookies(page);await requireLoginCheck(page,'facebook');await page.locator('a[href*="/marketplace/item/"]').first().waitFor({timeout:15000}).catch(()=>{});await extractListings(page,id,query,onListing);await page.mouse.wheel(0,900);await page.waitForTimeout(1200);await extractListings(page,id,query,onListing);}
