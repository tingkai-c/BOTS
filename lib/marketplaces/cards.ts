import type { Page } from 'playwright-core';
import { listingSchema, type Listing, type Marketplace } from '@/lib/schemas';
import { validateListingUrl } from './shared';
export type CardData={text:string;title:string;price:string;url:string;image:string;shipping:string;condition:string};
export function parseCard(card:CardData,marketplace:Marketplace,searchId:string,query:string):Listing|null {
 const lines=card.text.split('\n').map(s=>s.trim()).filter(Boolean);
 const title=card.title.replace(/^New Listing/i,'').trim()||lines.find(s=>!/^\$|^(?:US|CA|C)\s*\$|^Free$|^Pending$|^Partner listing$|^Sponsored$|^Please Contact$/i.test(s)&&s.length>5);
 const amount=card.price||lines.find(s=>/^(?:(?:US|CA|C)\s*)?\$[\d,.]+/.test(s));
 if(!title||/shop on ebay/i.test(title)||!amount||/ to |contact/i.test(amount))return null;
 const price=Number(amount.replace(/[^\d.]/g,''));if(!Number.isFinite(price)||price<=0)return null;
 let url:URL;try{url=new URL(card.url,marketplace==='ebay'?'https://www.ebay.com':marketplace==='facebook'?'https://www.facebook.com':'https://www.kijiji.ca');url.search='';validateListingUrl(url.toString(),marketplace);}catch{return null;}
 const currency=marketplace==='kijiji'||/C(?:A)?\s*\$|CAD/.test(amount)?'CAD':'USD';
 const words=query.toLowerCase().split(/\s+/).filter(w=>w.length>2);
 const parsed=listingSchema.safeParse({id:`${marketplace}-${url.pathname.split('/').filter(Boolean).pop()}`,searchId,marketplace,title,price,currency,currencyVerified:marketplace!=='facebook'||/USD|CAD|US\s*\$|C(?:A)?\s*\$/.test(amount),imageUrls:card.image?[card.image]:[],listingUrl:url.toString(),condition:card.condition||undefined,location:marketplace==='ebay'?undefined:lines.at(-1),shippingCost:/free/i.test(card.shipping)?0:card.shipping.match(/\$([\d,.]+)/)?Number(card.shipping.match(/\$([\d,.]+)/)![1].replaceAll(',','')):undefined,scrapedAt:Date.now(),confidence:.8,similarityScore:words.length?words.filter(w=>title.toLowerCase().includes(w)).length/words.length:.7,inspectionStatus:'pending',availability:'unknown'});
 return parsed.success?parsed.data:null;
}
export async function extractCards(page:Page,marketplace:Marketplace,searchId:string,query:string,onListing:(l:Listing)=>Promise<void>){
 const selector=marketplace==='ebay'?'.s-item, .s-card':marketplace==='facebook'?'a[href*="/marketplace/item/"]':'a[href^="/v-"]';
 // One synchronous DOM read: missing optional nodes never enter Playwright auto-waits.
 const cards=await page.locator(selector).evaluateAll(nodes=>nodes.slice(0,100).map(node=>{
  const text=(selector:string)=>node.querySelector(selector)?.textContent?.trim()||'';
  return {text:(node as HTMLElement).innerText,title:text('.s-item__title, .s-card__title'),price:text('.s-item__price, .s-card__price'),url:node.getAttribute('href')||node.querySelector('a[href*="/itm/"]')?.getAttribute('href')||'',image:node.querySelector('img')?.getAttribute('src')||'',shipping:text('.s-item__shipping, .s-card__shipping'),condition:text('.SECONDARY_INFO, .s-card__subtitle')};
 }));
 for(const card of cards){const listing=parseCard(card,marketplace,searchId,query);if(listing)await onListing(listing);}
}
