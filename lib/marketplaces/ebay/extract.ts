import type { Page } from 'playwright-core';
import { listingSchema, type Listing } from '@/lib/schemas';
export async function extractListings(page:Page,searchId:string,query:string,onListing:(l:Listing)=>Promise<void>){
 const cards=page.locator('.s-item, .s-card');const count=Math.min(await cards.count(),35);
 for(let i=0;i<count;i++){try{const card=cards.nth(i);const title=(await card.locator('.s-item__title, .s-card__title').first().innerText()).replace(/^New Listing/i,'').trim();if(/shop on ebay/i.test(title))continue;const amount=await card.locator('.s-item__price, .s-card__price').first().innerText();if(!/^\$|US \$/.test(amount)||/ to /.test(amount))continue;
 const price=Number(amount.replace(/[^\d.]/g,''));const href=await card.locator('a[href*="/itm/"]').first().getAttribute('href');if(!href)continue;const url=new URL(href);url.search='';const image=await card.locator('img').first().getAttribute('src');const shipping=await card.locator('.s-item__shipping, .s-card__shipping').first().innerText().catch(()=>'');const condition=await card.locator('.SECONDARY_INFO, .s-card__subtitle').first().innerText().catch(()=>'Not specified');const words=query.toLowerCase().split(/\s+/).filter(w=>w.length>2);const similarity=words.length?words.filter(w=>title.toLowerCase().includes(w)).length/words.length:.7;
 const l=listingSchema.parse({id:`ebay-${url.pathname.split('/').pop()}`,searchId,marketplace:'ebay',title,price,currency:'USD',shippingCost:/free/i.test(shipping)?0:shipping.match(/\$([\d.]+)/)?Number(shipping.match(/\$([\d.]+)/)![1]):undefined,imageUrls:image?[image]:[],listingUrl:url.toString(),condition,scrapedAt:Date.now(),confidence:.85,similarityScore:similarity});await onListing(l);
 }catch{/* Malformed or sponsored cards must not abort the search. */}}
}
