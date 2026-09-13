import type { Page } from 'playwright-core';
import type { Listing, SearchInput } from '@/lib/schemas';
import { dismissCookies, requireLoginCheck } from '../shared';
import { extractListings } from './extract';
export async function searchEbay(page:Page,id:string,query:string,input:SearchInput,onListing:(l:Listing)=>Promise<void>){const url=new URL('https://www.ebay.com/sch/i.html');url.searchParams.set('_nkw',query);url.searchParams.set('LH_BIN','1');if(input.maxPrice)url.searchParams.set('_udhi',String(input.maxPrice));if(input.location){url.searchParams.set('_stpos',input.location);url.searchParams.set('_sadis',String(input.radius));url.searchParams.set('LH_PrefLoc','2');}await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:35000});await dismissCookies(page);await requireLoginCheck(page,'ebay');await page.locator('.s-item, .s-card').first().waitFor({timeout:15000}).catch(()=>{});await extractListings(page,id,query,onListing);}
