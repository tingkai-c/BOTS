import { listingSchema, type Listing } from '@/lib/schemas';
import { apiError,connection,userId,liveMode } from '@/lib/server/context';
import { createSession,connectBrowser,releaseSession,viewerUrl } from '@/lib/steel/sessions';
import { inspectListing,detectListingUrl,extractTitleFromUrl } from '@/lib/marketplaces/shared';
export const maxDuration=60;
export async function POST(req:Request){
  try{
    const user=await userId();
    const raw=await req.json();
    const urlString = typeof raw?.url === 'string' ? raw.url : typeof raw?.listingUrl === 'string' && !raw.title ? raw.listingUrl : null;
    const detected = urlString ? detectListingUrl(urlString) : null;
    if(detected){
      if(!liveMode()){
        const inferredTitle=extractTitleFromUrl(detected.url,detected.marketplace)||(detected.marketplace==='kijiji'?'Sony WH-1000XM5 Wireless Headphones':'Sony WH-1000XM5 Noise Canceling Headphones');
        const demoListing:Listing={
          id:`import-${crypto.randomUUID()}`,
          searchId:'import',
          marketplace:detected.marketplace,
          title:inferredTitle,
          description:`Imported listing from ${detected.marketplace==='ebay'?'eBay':detected.marketplace==='kijiji'?'Kijiji':'Facebook Marketplace'}. Condition inspected and verified. Includes original accessories and box. All functions tested.`,
          price:detected.marketplace==='kijiji'?220:185,
          currency:detected.marketplace==='kijiji'?'CAD':'USD',
          currencyVerified:true,
          shippingCost:detected.marketplace==='ebay'?10:0,
          imageUrls:['/headphones.jpg'],
          listingUrl:detected.url,
          condition:'Like new',
          sellerName:detected.marketplace==='kijiji'?'Toronto Seller':detected.marketplace==='ebay'?'audio_tech_store':'Local Seller',
          sellerRating:4.9,
          sellerReviewCount:84,
          location:detected.marketplace==='kijiji'?'Toronto, ON':'San Francisco, CA',
          scrapedAt:Date.now(),
          confidence:.96,
          similarityScore:1,
          demo:true,
          availability:'available',
          inspectionStatus:'complete',
          inspectedAt:Date.now(),
          imported:true,
        };
        const encoder=new TextEncoder();
        return new Response(new ReadableStream({start(c){c.enqueue(encoder.encode(JSON.stringify(demoListing)+'\n'));c.close();}}),{headers:{'Content-Type':'application/x-ndjson'}});
      }
      const baseListing:Listing={
        id:crypto.randomUUID(),
        searchId:'import',
        marketplace:detected.marketplace,
        title:extractTitleFromUrl(detected.url,detected.marketplace)||'Imported listing',
        price:0,
        currency:detected.marketplace==='kijiji'?'CAD':'USD',
        imageUrls:[],
        listingUrl:detected.url,
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
