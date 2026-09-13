import type { Page } from 'playwright-core';
import type { Listing, SearchInput } from '@/lib/schemas';
import { dismissCookies, requireLoginCheck } from '../shared';
import { extractListings } from './extract';
export async function searchKijiji(page:Page,id:string,query:string,input:SearchInput,onListing:(l:Listing)=>Promise<void>){const url=new URL('https://www.kijiji.ca/b-search.html');url.searchParams.set('keywords',query);url.searchParams.set('adType','OFFER');if(input.maxPrice)url.searchParams.set('price__lte',String(input.maxPrice));if(input.location){url.searchParams.set('address',input.location);url.searchParams.set('radius',String(Math.round(input.radius*1.60934)));}await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:35000});await dismissCookies(page);await requireLoginCheck(page,'kijiji');await page.locator('a[href^="/v-"]').first().waitFor({timeout:15000}).catch(()=>{});await extractListings(page,id,query,onListing);}
