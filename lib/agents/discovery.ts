import type { Doc, Id } from '@/convex/_generated/dataModel';
import type { Listing, SearchInput, SearchState } from '@/lib/schemas';
import { mutate, query } from '@/lib/server/operations';
import { connection } from '@/lib/server/context';
import { createSession, connectBrowser, releaseSession, viewerUrl } from '@/lib/steel/sessions';
import { searchEbay } from '@/lib/marketplaces/ebay/search';
import { searchFacebookMarketplace } from '@/lib/marketplaces/facebook/search';
import { searchKijiji } from '@/lib/marketplaces/kijiji/search';
import { extractCards } from '@/lib/marketplaces/cards';
import { inspectListing } from '@/lib/marketplaces/shared';
import { recoverBrowser } from '@/lib/steel/recovery';
const adapters={ebay:searchEbay,facebook:searchFacebookMarketplace,kijiji:searchKijiji};

export async function runDiscovery(id:string){
 const loaded=await query<{job:Doc<'workspaceJobs'>;state:SearchState}|null>('work:load',{id});if(!loaded)return;
 const job=await mutate<Doc<'workspaceJobs'>|null>('work:claim',{id,userId:loaded.job.userId});if(!job)return;
 const base={id,userId:job.userId,generation:job.generation};const started=Date.now();let sessionId:string|undefined;
 const progress=(args:Record<string,unknown>)=>mutate('work:progress',{...base,...args});
 const state=loaded.state;const collected=new Map(state.listings.filter(l=>l.marketplace===job.marketplace).map(l=>[l.id,l]));let added=0;
 const cursor=job.cursor??{queryIndex:0,offset:0,noProgressCount:0};let remaining=false;
 try{
  const profile=await connection(job.userId,job.marketplace);const session=await createSession(profile?.profileId);sessionId=session.id;
  await progress({status:'searching',message:job.kind==='inspection'?'Inspecting selected listing':'Collecting and inspecting listings',sessionId,debugUrl:viewerUrl(session.debugUrl)});
  const {browser,page}=await connectBrowser(session.id);page.setDefaultTimeout(5000);
  try{
   const input:SearchInput={query:state.query,condition:'any',marketplace:job.marketplace,location:'Toronto',radius:25,...state.filters};
   const queries=state.identification?.searchQueries??[state.query];const term=queries[Math.min(cursor.queryIndex,queries.length-1)];
   const add=async(l:Listing)=>{if(collected.has(l.id)||added>=30||Date.now()-started>150_000)return;if(l.similarityScore<.25)return;collected.set(l.id,l);added++;await progress({listing:l});};
   if(job.kind==='discovery'){
    const sourceCurrency=job.marketplace==='kijiji'?'CAD':job.marketplace==='ebay'?'USD':undefined;
    await adapters[job.marketplace](page,state.id,term,{...input,maxPrice:sourceCurrency===(input.currency??'USD')?input.maxPrice:undefined},add);
    const locationControls=(await page.locator('[data-testid="location"], [aria-label*="Location"], [aria-label*="location"]').allTextContents()).join(' ');
    if(!locationControls.toLowerCase().includes(input.location.toLowerCase()))await progress({message:'Requested location could not be verified in marketplace controls. Check each listing location.'});
    if(input.condition!=='any')await progress({message:'Condition is filtered from extracted listings; the marketplace filter could not be verified.'});
    for(let scroll=0;scroll<Math.min(cursor.offset,10);scroll++){await page.mouse.wheel(0,1200);await page.waitForTimeout(350);}
    for(let scroll=0;scroll<5&&added<30&&Date.now()-started<100_000;scroll++){
     const before=added;await extractCards(page,job.marketplace,state.id,term,add);await page.mouse.wheel(0,1200);await page.waitForTimeout(500);cursor.offset++;
     cursor.noProgressCount=added===before?cursor.noProgressCount+1:0;if(cursor.noProgressCount>=2)break;
    }
    if(!collected.size){const body=await page.locator('body').innerText({timeout:3000});if(!/no results|no listings|couldn.t find|0 results/i.test(body)){if(await recoverBrowser(page,job.marketplace,session.id,'Recover listing extraction'))await extractCards(page,job.marketplace,state.id,term,add);if(!collected.size)throw new Error('The marketplace layout could not be read. Reconnect or try again.');}}
   }
   const pending=job.kind==='inspection'?[collected.get(job.listingId!)].filter((l):l is Listing=>!!l):[...collected.values()].filter(l=>!l.inspectedAt);
   for(const listing of pending){if(Date.now()-started>180_000){remaining=true;break;}
    try{let detail:Listing;try{detail=await inspectListing(page,listing);}catch(e){if(!await recoverBrowser(page,job.marketplace,session.id,'Recover product detail extraction'))throw e;detail=await inspectListing(page,listing);}collected.set(detail.id,detail);await progress({listing:detail});}
    catch{const failed:Listing={...listing,inspectionStatus:'failed',inspectionError:'Details could not be verified. Open the original or retry inspection.',inspectedAt:Date.now()};collected.set(failed.id,failed);await progress({listing:failed});}
   }
   if(added>=30)remaining=true;
   if(!remaining&&cursor.noProgressCount>=2&&cursor.queryIndex+1<queries.length){cursor.queryIndex++;cursor.offset=0;cursor.noProgressCount=0;remaining=true;}
   const failedDetails=[...collected.values()].filter(l=>l.inspectionStatus==='failed').length;
   await progress({status:remaining?'searching':'complete',outcome:remaining?'running':!collected.size?'no_matches':failedDetails?'partial':'complete',message:remaining?'Progress saved · continuing in the next batch':collected.size?`${collected.size} listings saved · ${failedDetails} detail inspections need attention`:'No matching listings found'});
   await mutate('work:checkpoint',{...base,status:remaining?'queued':'complete',cursor});
  }finally{await browser.close().catch(()=>{});}
 }catch(e){const message=e instanceof Error&&/sign in/i.test(e.message)?'Sign in is required. Reconnect this marketplace.':'This marketplace could not finish. Saved listings are preserved; use Find more to retry.';await progress({status:/Sign in/.test(message)?'login_required':'failed',outcome:/Sign in/.test(message)?'needs_sign_in':collected.size?'partial':'failed',message});await mutate('work:checkpoint',{...base,status:/Sign in/.test(message)?'needs_sign_in':'failed',cursor,message});}
 finally{if(sessionId)await releaseSession(sessionId).catch(()=>{});}
}
export type DiscoveryJobId=Id<'workspaceJobs'>;
