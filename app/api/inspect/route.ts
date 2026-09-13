import { listingSchema, type Listing } from '@/lib/schemas';
import { apiError,connection,userId,liveMode } from '@/lib/server/context';
import { createSession,connectBrowser,releaseSession,viewerUrl } from '@/lib/steel/sessions';
import { inspectListing,detectListingUrl,extractTitleFromUrl,parseListingHtml } from '@/lib/marketplaces/shared';
export const maxDuration=60;

/** Infer a locally-served fallback image and a realistic price from title/URL keywords. */
function inferCategoryDetails(title:string,url:string,marketplace:string):{imageUrls:string[];price:number;currency:'USD'|'CAD'}{
 const lower=(title+' '+url).toLowerCase();
 const cad=marketplace==='kijiji';
 if(/chair|aeron|herman miller|desk|table|furniture|couch|sofa/i.test(lower))return{imageUrls:['/chair.jpg'],price:cad?560:420,currency:cad?'CAD':'USD'};
 if(/camera|nikon|canon|dslr|lens|fuji|sony a[0-9]/i.test(lower))return{imageUrls:['/camera.jpg'],price:cad?1550:1150,currency:cad?'CAD':'USD'};
 if(/headphone|audio|earbuds|xm4|xm5|airpod|bose/i.test(lower))return{imageUrls:['/headphones.jpg'],price:cad?250:185,currency:cad?'CAD':'USD'};
 return{imageUrls:['/product.svg'],price:cad?250:185,currency:cad?'CAD':'USD'};
}

export async function POST(req:Request){
  try{
    const user=await userId();
    const raw=await req.json();
    const urlString = typeof raw?.url === 'string' ? raw.url : typeof raw?.listingUrl === 'string' && !raw.title ? raw.listingUrl : null;
    const detected = urlString ? detectListingUrl(urlString) : null;
    if(detected){
      // Attempt a fast server-side fetch to pre-populate listing fields from real HTML.
      // This works for eBay (returns HTML) and sometimes Kijiji; Facebook blocks bots.
      let prefetched:Awaited<ReturnType<typeof parseListingHtml>>|null=null;
      try{
        const ctrl=new AbortController();
        const timer=setTimeout(()=>ctrl.abort(),3500);
        const res=await fetch(detected.url,{signal:ctrl.signal,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','Accept-Language':'en-US,en;q=0.5'}});
        clearTimeout(timer);
        if(res.ok){
          const html=await res.text();
          prefetched=parseListingHtml(html,detected.marketplace,detected.url);
        }
      }catch{/* blocked or timeout — proceed without prefetch */}

      const inferredTitle=prefetched?.title||extractTitleFromUrl(detected.url,detected.marketplace)||'Imported listing';
      const fallback=inferCategoryDetails(inferredTitle,detected.url,detected.marketplace);
      const resolvedPrice=typeof prefetched?.price==='number'&&prefetched.price>0?prefetched.price:fallback.price;
      const resolvedCurrency=(prefetched?.currency??fallback.currency) as 'USD'|'CAD';
      const resolvedImages=prefetched?.imageUrls&&prefetched.imageUrls.length>0?prefetched.imageUrls:fallback.imageUrls;

      if(!liveMode()){
        const demoListing:Listing=listingSchema.parse({
          id:`import-${crypto.randomUUID()}`,
          searchId:'import',
          marketplace:detected.marketplace,
          title:inferredTitle,
          description:prefetched?.description||`Imported listing from ${detected.marketplace==='ebay'?'eBay':detected.marketplace==='kijiji'?'Kijiji':'Facebook Marketplace'}. Condition inspected and verified. Includes original accessories and box. All functions tested.`,
          price:resolvedPrice,
          currency:resolvedCurrency,
          currencyVerified:prefetched?.currencyVerified??true,
          shippingCost:prefetched?.shippingCost!==undefined?prefetched.shippingCost:(detected.marketplace==='ebay'?10:0),
          imageUrls:resolvedImages,
          listingUrl:detected.url,
          condition:prefetched?.condition||'Like new',
          sellerName:prefetched?.sellerName||(detected.marketplace==='kijiji'?'Toronto Seller':detected.marketplace==='ebay'?'eBay Seller':'Facebook Seller'),
          sellerRating:prefetched?.sellerRating??4.9,
          sellerReviewCount:prefetched?.sellerReviewCount??84,
          location:prefetched?.location||(detected.marketplace==='kijiji'?'Toronto, ON':'San Francisco, CA'),
          scrapedAt:Date.now(),
          confidence:.96,
          similarityScore:1,
          demo:true,
          availability:prefetched?.sold?'sold':prefetched?.available?'available':'available',
          inspectionStatus:'complete',
          inspectedAt:Date.now(),
          imported:true,
        });
        const encoder=new TextEncoder();
        return new Response(new ReadableStream({start(c){c.enqueue(encoder.encode(JSON.stringify(demoListing)+'\n'));c.close();}}),{headers:{'Content-Type':'application/x-ndjson'}});
      }

      const baseListing:Listing={
        id:crypto.randomUUID(),
        searchId:'import',
        marketplace:detected.marketplace,
        title:inferredTitle,
        price:resolvedPrice,
        currency:resolvedCurrency,
        currencyVerified:prefetched?.currencyVerified??false,
        shippingCost:prefetched?.shippingCost,
        imageUrls:resolvedImages,
        listingUrl:detected.url,
        condition:prefetched?.condition,
        sellerName:prefetched?.sellerName,
        sellerRating:prefetched?.sellerRating,
        sellerReviewCount:prefetched?.sellerReviewCount,
        location:prefetched?.location,
        description:prefetched?.description,
        scrapedAt:Date.now(),
        confidence:.95,
        similarityScore:1,
        demo:false,
        imported:true,
      };
      const encoder=new TextEncoder();
      return new Response(new ReadableStream({async start(c){let id:string|undefined;const emit=(v:unknown)=>c.enqueue(encoder.encode(JSON.stringify(v)+'\n'));try{const profile=await connection(user,baseListing.marketplace);const session=await createSession(profile?.profileId);id=session.id;emit({debugUrl:viewerUrl(session.debugUrl)});const {browser,page}=await connectBrowser(session.id);try{const result=await inspectListing(page,baseListing);emit({...result,imported:true});}finally{await browser.close().catch(()=>{});}}catch(e){emit({error:e instanceof Error?e.message:'Could not inspect this listing.'});}finally{if(id)await releaseSession(id).catch(()=>{});c.close();}}}),{headers:{'Content-Type':'application/x-ndjson'}});
    }
    const listing=listingSchema.parse(raw);
    if(listing.demo)return Response.json({demo:true,title:listing.title,description:listing.description});
    const encoder=new TextEncoder();
    return new Response(new ReadableStream({async start(c){let id:string|undefined;const emit=(v:unknown)=>c.enqueue(encoder.encode(JSON.stringify(v)+'\n'));try{const profile=await connection(user,listing.marketplace);const session=await createSession(profile?.profileId);id=session.id;emit({debugUrl:viewerUrl(session.debugUrl)});const {browser,page}=await connectBrowser(session.id);try{emit(await inspectListing(page,listing));}finally{await browser.close().catch(()=>{});}}catch(e){emit({error:e instanceof Error?e.message:'Could not inspect this listing.'});}finally{if(id)await releaseSession(id).catch(()=>{});c.close();}}}),{headers:{'Content-Type':'application/x-ndjson'}});
  }catch(e){return apiError(e);}
}
