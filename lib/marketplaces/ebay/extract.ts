import type { Page } from 'playwright-core';
import type { Listing } from '@/lib/schemas';
import { extractCards } from '../cards';
export async function extractListings(page:Page,searchId:string,query:string,onListing:(l:Listing)=>Promise<void>){return extractCards(page,'ebay',searchId,query,onListing);}
