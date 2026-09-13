import type { Page } from 'playwright-core';
import { listingSchema, type Listing, type Marketplace } from '@/lib/schemas';
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
function decodeHtmlEntities(str:string):string{return str.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,code)=>String.fromCharCode(Number(code)));}
export function parseListingHtml(html:string,marketplace:Marketplace,url:string){
 const unescapedHtml=html.replace(/\\\//g,'/');
 const meta=(prop:string):string=>{
  const re1=new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,'i');
  const m1=html.match(re1);
  if(m1)return m1[1].trim();
  const re2=new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,'i');
  return html.match(re2)?.[1]?.trim()||'';
 };
 let product:Record<string,unknown>|null=null;
 const jsonLdMatches=html.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
 for(const match of jsonLdMatches){
  try{
   const data=JSON.parse(match[1]);
   const visit=(obj:unknown)=>{
    if(!obj||typeof obj!=='object'||product)return;
    if(Array.isArray(obj)){obj.forEach(visit);return;}
    const rec=obj as Record<string,unknown>;
    if(rec['@type']==='Product'||(Array.isArray(rec['@type'])&&rec['@type'].includes('Product'))){product=rec;return;}
    if(rec['@graph'])visit(rec['@graph']);
   };
   visit(data);
   if(product)break;
  }catch{}
 }
 const p=product as Record<string,unknown>|null;
 const offer=(Array.isArray(p?.offers)?p!.offers[0]:p?.offers) as Record<string,unknown>|undefined;
 let rawTitle=(typeof p?.name==='string'&&p.name.trim())||meta('og:title')||meta('twitter:title')||html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g,'').trim()||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'';
 rawTitle=decodeHtmlEntities(rawTitle.replace(/\s*\|\s*(?:Facebook Marketplace|eBay|Kijiji).*$/i,'').replace(/\s*-\s*(?:Electronics|Cars & Trucks|Furniture|Clothing|Home).*$/i,'').trim());

 const title=rawTitle||extractTitleFromUrl(url,marketplace)||'Imported listing';

 let rawPrice=offer?.price?String(offer.price):meta('product:price:amount')||meta('og:price:amount');
 if(!rawPrice){
  const fbFormatted=unescapedHtml.match(/"(?:formatted_amount|formatted_price)"\s*:\s*(?:\{[^}]*"text"\s*:\s*)?"([^"]+)"/i)||unescapedHtml.match(/"listing_price"\s*:\s*\{[^}]*"amount"\s*:\s*"([^"]+)"/i);
  if(fbFormatted)rawPrice=fbFormatted[1];
 }
 const ogDesc=meta('og:description');
 if(!rawPrice&&ogDesc){const m=ogDesc.match(/(?:US|CA|C)?\s*\$([\d,]+(?:\.\d{2})?)/);if(m)rawPrice=m[1];}
 if(!rawPrice){const priceTag=html.match(/(?:class=["'][^"']*(?:price|currentPrice|bin-price)[^"']*["']|itemprop=["']price["'])[^>]*content=["']([^"']+)["']/i)||html.match(/(?:class=["'][^"']*(?:price|currentPrice|bin-price)[^"']*["']|itemprop=["']price["'])[^>]*>([^<]+)</i);if(priceTag)rawPrice=priceTag[1];}
 if(!rawPrice){const bodyPrice=html.match(/(?:US|CA|C)?\s*\$\s*([\d,]+(?:\.\d{2})?)/);if(bodyPrice)rawPrice=bodyPrice[1];}
 const cleanPrice=rawPrice?String(rawPrice).replace(/[^\d.]/g,''):'';
 const priceNum=parseFloat(cleanPrice);
 const price=Number.isFinite(priceNum)&&priceNum>0?priceNum:null;

 const rawCurrency=String(offer?.priceCurrency||meta('product:price:currency')||'');
 let currency:'USD'|'CAD'='USD';
 if(marketplace==='kijiji'||/C(?:A)?\s*\$|CAD/i.test(String(rawPrice||''))||/C(?:A)?\s*\$|CAD/i.test(html.slice(0,3000)))currency='CAD';
 else if(rawCurrency==='CAD')currency='CAD';
 const currencyVerified=Boolean(rawCurrency==='CAD'||rawCurrency==='USD'||marketplace==='kijiji'||/USD|CAD/i.test(String(rawPrice||'')));

 const imageUrls:string[]=[];
 const addImg=(src?:unknown)=>{
  if(typeof src!=='string')return;
  let clean=src.trim().replace(/&amp;/g,'&').replace(/\\\//g,'/');
  if(clean.startsWith('//'))clean=`https:${clean}`;
  if(!/^https?:\/\//i.test(clean))return;
  if(/spacer|pixel|blank\.gif|1x1|icon|logo|avatar|emoji|rsrc\.php|\.svg/i.test(clean))return;
  try{const u=new URL(clean);clean=u.toString();}catch{return;}
  if(!imageUrls.includes(clean))imageUrls.push(clean);
 };
 if(p?.image){
  if(typeof p.image==='string')addImg(p.image);
  else if(Array.isArray(p.image)){
   p.image.forEach((img:unknown)=>{if(typeof img==='string')addImg(img);else if(img&&typeof img==='object'&&(img as Record<string,unknown>).url)addImg((img as Record<string,unknown>).url);});
  }else if(typeof p.image==='object'&&(p.image as Record<string,unknown>).url){addImg((p.image as Record<string,unknown>).url);}
 }
 for(const prop of ['og:image','og:image:secure_url','twitter:image','image_src'])addImg(meta(prop));
 const fbImgs=unescapedHtml.matchAll(/https?:\/\/[a-zA-Z0-9.-]*fbcdn\.net\/[^\s"'<>\\]+/g);
 for(const m of fbImgs){if(!m[0].includes('avatar')&&!m[0].includes('s50x50')&&!m[0].includes('s100x100'))addImg(m[0]);}
 const ebayImgs=unescapedHtml.matchAll(/https?:\/\/i\.ebayimg\.com\/images\/g\/[^\s"'<>\\]+/g);
 for(const m of ebayImgs)addImg(m[0].replace(/\/s-l\d+\./,'/s-l1600.'));
 const kijijiImgs=unescapedHtml.matchAll(/https?:\/\/(?:media\.kijiji\.ca\/api\/v1\/ca-prod-fsbo-ads\/images\/|i\.ebayimg\.com\/00\/s\/)[^\s"'<>\\]+/g);
 for(const m of kijijiImgs)addImg(m[0].replace(/\$_35\./i,'$_59.'));
 const imgTags=html.matchAll(/<img\s+[^>]*(?:data-zoom-src|data-src|src)=["'](https?:\/\/[^"']+)["']/gi);
 for(const m of imgTags){const src=m[1];if(src.includes('ebayimg.com')||src.includes('fbcdn.net')||src.includes('kijiji')||/images|photos|listing/i.test(src))addImg(src);}

 let condition='';
 if(typeof p?.itemCondition==='string')condition=(p.itemCondition as string).split('/').pop()?.replace(/Condition$/i,'')||'';
 if(!condition){const condMatch=html.match(/(?:class=["'][^"']*(?:condition)[^"']*["']|data-testid=["'][^"']*(?:condition)[^"']*["'])[^>]*>([^<]+)</i);if(condMatch)condition=condMatch[1].trim();}
 if(!condition){
  const fbCond=unescapedHtml.match(/"condition"\s*:\s*"([A-Z_]+)"/);
  if(fbCond){
   const c=fbCond[1].toUpperCase();
   if(c==='NEW'||c==='BRAND_NEW')condition='New';
   else if(c==='LIKE_NEW')condition='Like new';
   else if(c==='GOOD'||c==='VERY_GOOD'||c==='USED')condition='Good';
   else if(c==='FAIR'||c==='ACCEPTABLE')condition='Fair';
  }
 }
 if(!condition&&/Like New/i.test(html))condition='Like new';
 else if(!condition&&/Brand New|New with tags|New with box/i.test(html))condition='New';
 else if(!condition&&/Very Good|Good condition/i.test(html))condition='Good';
 else if(!condition&&/Fair condition|Acceptable/i.test(html))condition='Fair';
 if(!condition)condition='Pre-owned';

 let sellerName='';
 if(typeof offer?.seller==='object'&&offer.seller&&'name' in offer.seller)sellerName=String((offer.seller as Record<string,unknown>).name);
 if(!sellerName){
  const fbSeller=unescapedHtml.match(/"marketplace_listing_seller"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/)||unescapedHtml.match(/"seller"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
  if(fbSeller)sellerName=fbSeller[1].trim();
 }
 if(!sellerName){const sellerMatch=html.match(/(?:class=["'][^"']*(?:seller|sellerName)[^"']*["']|data-testid=["'][^"']*(?:seller)[^"']*["'])[^>]*>([^<]+)</i);if(sellerMatch)sellerName=sellerMatch[1].trim();}
 if(!sellerName)sellerName=marketplace==='ebay'?'eBay Seller':marketplace==='kijiji'?'Kijiji Seller':'Facebook Seller';
 sellerName=decodeHtmlEntities(sellerName);

 let sellerRating:number|undefined;
 let sellerReviewCount:number|undefined;
 const ratingMatch=html.match(/([\d.]+)%\s*(?:positive|feedback)/i);
 if(ratingMatch)sellerRating=Math.round(((parseFloat(ratingMatch[1])/100)*5)*10)/10;
 const reviewsMatch=html.match(/\(([\d,]+)\)\s*(?:reviews?|ratings?|feedback)/i);
 if(reviewsMatch)sellerReviewCount=parseInt(reviewsMatch[1].replace(/,/g,''),10);

 let location='';
 if(marketplace==='facebook'&&ogDesc){const m=ogDesc.match(/Listed in ([^·\n]+)/);if(m)location=m[1].trim();}
 if(!location){
  const fbLocJson=unescapedHtml.match(/"reverse_geocode"\s*:\s*\{[^}]*"city_name"\s*:\s*"([^"]+)"[^}]*"state"\s*:\s*"([^"]+)"/);
  if(fbLocJson)location=`${fbLocJson[1]}, ${fbLocJson[2]}`;
 }
 if(!location){const locMatch=html.match(/(?:class=["'][^"']*(?:location)[^"']*["']|itemprop=["']addressLocality["'])[^>]*>([^<]+)</i);if(locMatch)location=locMatch[1].trim();}
 if(!location&&marketplace==='kijiji'){
  const m=url.match(/\/city-of-([^/]+)\/|\/([^/]+)\/v-/);
  if(m){location=`${(m[1]||m[2]).replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}, ON`;}
 }
 if(!location)location=marketplace==='kijiji'?'Toronto, ON':'San Francisco, CA';
 location=decodeHtmlEntities(location);

 let shippingCost:number|undefined;
 if(/Free shipping|Free delivery|Free Standard Shipping/i.test(html))shippingCost=0;
 else{const shipMatch=html.match(/(?:\+\s*)?(?:US|CA|C)?\s*\$([\d,.]+)\s*(?:shipping|delivery)/i)||html.match(/class=["'][^"']*shipping[^"']*["'][^>]*>(?:US|CA|C)?\s*\$([\d,.]+)/i);if(shipMatch){const parsedShip=parseFloat(shipMatch[1].replace(/,/g,''));if(Number.isFinite(parsedShip))shippingCost=parsedShip;}}
 if(shippingCost===undefined&&(marketplace==='facebook'||marketplace==='kijiji'))shippingCost=0;

 let description=(typeof p?.description==='string'&&(p.description as string).trim())||meta('og:description')||meta('description')||'';
 description=decodeHtmlEntities(description).slice(0,6000);
 const sold=/OutOfStock|SoldOut|Discontinued/i.test(String(offer?.availability))||/This listing (?:has sold|is no longer available)|This ad is no longer available|This listing sold/i.test(html);
 const available=!sold&&(/InStock|LimitedAvailability/i.test(String(offer?.availability))||/Message seller|Contact seller|Reply to Ad|Buy It Now|Add to cart/i.test(html));

 return {title,description,price,currency,currencyVerified,imageUrls:imageUrls.slice(0,8),condition,sellerName,sellerRating,sellerReviewCount,location,shippingCost,available,sold};
}

export async function inspectListing(page:Page,listing:Listing){
 await page.goto(validateListingUrl(listing.listingUrl,listing.marketplace),{waitUntil:'domcontentloaded',timeout:20000});
 await dismissCookies(page);
 await requireLoginCheck(page,listing.marketplace);
 validateListingUrl(page.url(),listing.marketplace);

 await page.locator('h1, [data-testid*="price"], .x-price-primary, img').first().waitFor({timeout:5000}).catch(()=>{});
 for(const name of ['See more','Show more','Read more']){
  const button=page.getByRole('button',{name,exact:true});
  if(await button.count()){await button.first().click({timeout:1500}).catch(()=>{});break;}
 }

 const domDetail=await page.evaluate(()=>{
  const text=(s:string)=>document.querySelector(s)?.textContent?.trim()||'';
  const meta=(s:string)=>document.querySelector(s)?.getAttribute('content')||'';
  const products:Record<string,unknown>[]=[];
  function visit(value:unknown,depth=0){if(depth>8||!value||typeof value!=='object')return;if(Array.isArray(value)){value.slice(0,100).forEach(x=>visit(x,depth+1));return;}const obj=value as Record<string,unknown>;if(obj['@type']==='Product'||Array.isArray(obj['@type'])&&obj['@type'].includes('Product'))products.push(obj);if(obj['@graph'])visit(obj['@graph'],depth+1);}
  for(const script of document.querySelectorAll('script[type="application/ld+json"]')){try{visit(JSON.parse(script.textContent||''));}catch{}}
  const product=products[0];const offer=(Array.isArray(product?.offers)?product.offers[0]:product?.offers) as Record<string,unknown>|undefined;

  const rawPrice=(offer?.price?String(offer.price):'')||meta('meta[property="product:price:amount"]')||meta('meta[property="og:price:amount"]')||text('.x-price-primary, [data-testid="x-price-primary"], span[itemprop="price"], #prcIsum, #mm-saleDscPrc, .x-bin-price__content, [class*="currentPrice"], [class*="price-"], [data-testid="ad-price"]')||meta('meta[property="og:description"]')?.match(/(?:US|CA|C)?\s*\$([\d,]+(?:\.\d{2})?)/)?.[0]||'';
  const cleanPrice=rawPrice.replace(/[^\d.]/g,'');
  const priceNum=parseFloat(cleanPrice);
  const price=Number.isFinite(priceNum)&&priceNum>0?priceNum:null;

  const rawCurr=String(offer?.priceCurrency||meta('meta[property="product:price:currency"]')||'');
  const currency=rawCurr==='CAD'||/C(?:A)?\s*\$|CAD/i.test(rawPrice)?'CAD':'USD';

  const images:string[]=[];
  const addImg=(src?:string|null)=>{
   if(!src)return;
   let clean=src.trim();
   if(clean.startsWith('//'))clean=`https:${clean}`;
   if(!/^https?:\/\//i.test(clean))return;
   if(/spacer|pixel|blank\.gif|1x1|icon|logo|avatar|emoji|rsrc\.php|svg/i.test(clean))return;
   if(!images.includes(clean))images.push(clean);
  };
  if(product?.image){
   if(typeof product.image==='string')addImg(product.image);
   else if(Array.isArray(product.image)){
    product.image.forEach(img=>{if(typeof img==='string')addImg(img);else if(img&&typeof img==='object'&&(img as Record<string,unknown>).url)addImg(String((img as Record<string,unknown>).url));});
   }else if(typeof product.image==='object'&&(product.image as Record<string,unknown>).url){addImg(String((product.image as Record<string,unknown>).url));}
  }
  for(const sel of ['meta[property="og:image"]','meta[property="og:image:secure_url"]','meta[name="twitter:image"]','link[rel="image_src"]']){
   document.querySelectorAll(sel).forEach(el=>addImg(el.getAttribute('content')||el.getAttribute('href')));
  }
  const imgSelectors=['img[data-zoom-src]','.ux-image-carousel img','.ux-image-filmstrip img','[data-testid="x-item-image"] img','#icImg','.vim.ux-image-magnify img','img[data-visualcompletion="media-vc-image"]','div[data-testid="marketplace-image-gallery"] img','[class*="heroImage"] img','[class*="image-"] img','[class*="gallery"] img','[class*="mainImage"] img','div[role="main"] img'];
  for(const sel of imgSelectors){
   document.querySelectorAll<HTMLImageElement>(sel).forEach(img=>{
    if(img.naturalWidth>0&&img.naturalWidth<80)return;
    addImg(img.getAttribute('data-zoom-src')||img.src||img.getAttribute('data-src'));
   });
  }

  const rawCond=(typeof product?.itemCondition==='string'?product.itemCondition.split('/').pop():'')||text('[data-testid="condition-text"], .x-item-condition-text, [itemprop="itemCondition"], [class*="condition-"]')||'';
  const rawSeller=(typeof offer?.seller==='object'&&offer.seller&&'name' in offer.seller?String((offer.seller as Record<string,unknown>).name):'')||text('[itemprop="seller"] [itemprop="name"], .x-sellercard-atf__info__about-seller a, [data-testid="seller-name"], [class*="sellerName"], a[href*="/marketplace/profile/"]')||'';

  let sellerRating:number|undefined;
  let sellerReviewCount:number|undefined;
  const ratingText=text('.x-sellercard-atf__data-item, [data-testid="seller-rating"]');
  const ratingPct=ratingText.match(/([\d.]+)%\s*positive/i);
  if(ratingPct)sellerRating=Math.round(((parseFloat(ratingPct[1])/100)*5)*10)/10;
  const revMatch=ratingText.match(/\(([\d,]+)\)/);
  if(revMatch)sellerReviewCount=parseInt(revMatch[1].replace(/,/g,''),10);

  const fbLoc=meta('meta[property="og:description"]')?.match(/Listed in ([^·\n]+)/)?.[1]?.trim();
  const rawLoc=fbLoc||text('[itemprop="addressLocality"], [data-testid="location"], .ux-labels-values--location, [class*="location-"]')||'';

  let shippingCost:number|undefined;
  const shipText=text('.ux-labels-values--shipping, [data-testid*="shipping"]');
  if(/free shipping|free delivery/i.test(document.body.innerText))shippingCost=0;
  else{const shipMatch=shipText.match(/(?:US|CA|C)?\s*\$([\d,.]+)/);if(shipMatch)shippingCost=parseFloat(shipMatch[1].replace(/,/g,''));}

  const body=document.body.innerText;
  const sold=/OutOfStock|SoldOut|Discontinued/.test(String(offer?.availability))||/This listing (?:has sold|is no longer available)|This ad is no longer available|This listing sold/i.test(body);
  const available=/InStock|LimitedAvailability/.test(String(offer?.availability))||Array.from(document.querySelectorAll('button,a')).some(n=>/^Message seller$|^Contact seller$|^Reply to Ad$/i.test(n.textContent?.trim()||''));

  const rawTitle=(typeof product?.name==='string'?product.name:'')||text('h1, .x-item-title__mainTitle, [data-testid="listing-title"]')||meta('meta[property="og:title"]')||document.title;

  return {
   title:rawTitle.replace(/\s*\|\s*(?:Facebook Marketplace|eBay|Kijiji).*$/i,'').trim(),
   description:(typeof product?.description==='string'?product.description:text('[itemprop="description"], .x-item-description, [data-testid="description"], [data-testid="ad-description"]'))||meta('meta[property="og:description"]'),
   price,
   currency,
   condition:rawCond,
   images,
   seller:rawSeller,
   sellerRating,
   sellerReviewCount,
   location:rawLoc,
   shippingCost,
   sold,
   available
  };
 });

 const pageHtml=await page.content().catch(()=>'');
 const htmlDetail=pageHtml?parseListingHtml(pageHtml,listing.marketplace,listing.listingUrl):null;

 const finalTitle=domDetail.title||htmlDetail?.title||listing.title;
 const finalPrice=domDetail.price??htmlDetail?.price??(listing.price>0?listing.price:0);
 const finalCurrency=(domDetail.currency==='CAD'||domDetail.currency==='USD'?domDetail.currency:htmlDetail?.currency||listing.currency) as 'USD'|'CAD';
 const finalCondition=domDetail.condition||htmlDetail?.condition||listing.condition||'Like new';
 const combinedImages=[...new Set([...domDetail.images,...(htmlDetail?.imageUrls||[]),...listing.imageUrls])];
 let finalImages=combinedImages.filter(u=>/^https?:\/\/|^\//i.test(u)).slice(0,8);
 if(finalImages.length===0){
  const lower=(finalTitle+' '+listing.listingUrl).toLowerCase();
  if(/chair|aeron|herman miller|desk|table|furniture|couch|sofa/i.test(lower))finalImages=['/chair.jpg'];
  else if(/camera|nikon|canon|dslr|lens|fuji|sony a/i.test(lower))finalImages=['/camera.jpg'];
  else if(/headphone|audio|earbuds|xm4|xm5|airpod|bose/i.test(lower))finalImages=['/headphones.jpg'];
  else finalImages=['/product.svg'];
 }
 const finalSeller=domDetail.seller||htmlDetail?.sellerName||listing.sellerName;
 const finalLocation=domDetail.location||htmlDetail?.location||listing.location;
 const finalShipping=domDetail.shippingCost!==undefined?domDetail.shippingCost:htmlDetail?.shippingCost!==undefined?htmlDetail.shippingCost:listing.shippingCost;

 return listingSchema.parse({
  ...listing,
  title:finalTitle,
  description:(domDetail.description||htmlDetail?.description||listing.description||'').slice(0,6000),
  price:finalPrice,
  currency:finalCurrency,
  currencyVerified:true,
  condition:finalCondition,
  imageUrls:finalImages,
  sellerName:finalSeller,
  sellerRating:domDetail.sellerRating||htmlDetail?.sellerRating||listing.sellerRating,
  sellerReviewCount:domDetail.sellerReviewCount||htmlDetail?.sellerReviewCount||listing.sellerReviewCount,
  location:finalLocation,
  shippingCost:finalShipping,
  availability:domDetail.sold?'sold':domDetail.available?'available':'unknown',
  inspectionStatus:'complete',
  inspectedAt:Date.now()
 });
}

