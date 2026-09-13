import type { Doc } from '@/convex/_generated/dataModel';
import { listingSchema, type Listing } from '@/lib/schemas';
import { mutate, query } from '@/lib/server/operations';
import { createSession, connectBrowser, releaseSession, viewerUrl } from '@/lib/steel/sessions';
import { verifyAuthorization } from '@/lib/server/negotiation-authorization';
import { negotiationSettings } from '@/lib/negotiation/contracts';
import { openConversation } from '@/lib/marketplaces/conversation';
import { inspectListing } from '@/lib/marketplaces/shared';
import { decideNegotiation } from '@/lib/negotiation/engine';

export async function runMonitoring(id:string,generation:number){
 const payload=await mutate<{account:Doc<'accountMonitoring'>;work:{thread:Doc<'threads'>;listing:Listing}[]}|null>('dispatcher:accountWork',{id,generation});if(!payload)return;
 const started=Date.now();let sessionId:string|undefined;let cursor:string|undefined;
 try{if(!payload.work.length)return;const session=await createSession(payload.account.profileId);sessionId=session.id;await mutate('dispatcher:browser',{id,generation,debugUrl:viewerUrl(session.debugUrl)});const {browser,page}=await connectBrowser(session.id);page.setDefaultTimeout(5000);
  try{for(let i=0;i<payload.work.length;i++){const {thread,listing:raw}=payload.work[i];if(Date.now()-started>180_000){cursor=payload.work[i-1]?.thread.key??payload.account.cursor;break;}
   const args={userId:thread.userId,key:thread.key};
   try{
    const settings=negotiationSettings.parse(thread.settings);if(!verifyAuthorization(thread.userId,thread.key,thread.version,settings,thread.signature))throw new Error('Authorization signature is invalid.');
    const listing=await inspectListing(page,listingSchema.parse(raw));if(listing.availability!=='available'||listing.currencyVerified===false||listing.currency!==settings.currency)throw new Error('Availability or currency needs your verification.');
    const adapter=await openConversation(page,listing);const transcript=await adapter.read();await mutate('conversations:observe',{...args,...transcript});
    const current=await query<Doc<'threads'>>('conversations:get',args);if(current.status!=='active'||current.handledRevision>=current.revision)continue;
    const decision=await decideNegotiation(settings,listing,transcript.messages,current.currentOffer);
    const attemptId=await mutate<string|null>('conversations:prepare',{...args,version:current.version,revision:current.revision,decision});if(!attemptId)continue;
    let claimed=false;
    try{const attempt=await query<{text:string}>('conversations:attempt',{...args,attemptId});
     const sent=await adapter.send(attempt.text,async()=>{
      const fresh=await adapter.read();await mutate('conversations:observe',{...args,...fresh});
      const live=await query<Doc<'threads'>>('conversations:get',args);const liveSettings=negotiationSettings.parse(live.settings);if(!verifyAuthorization(live.userId,live.key,live.version,liveSettings,live.signature))return false;
      const text=await mutate<string|null>('conversations:claimSend',{...args,attemptId,accountId:id,generation});claimed=!!text;return claimed;
     });
     if(sent)await mutate('conversations:finishSend',{...args,attemptId,confirmed:true,sourceId:sent.sourceId});
    }catch{if(claimed)await mutate('conversations:finishSend',{...args,attemptId,confirmed:false});else throw new Error('The conversation changed before sending. Review and resume.');}
   }catch{await mutate('conversations:attention',{...args,reason:'The marketplace conversation, availability, currency, or authorization could not be verified. Review the conversation and reconnect or update limits before resuming.'});}
  }}finally{await browser.close().catch(()=>{});}
 }finally{if(sessionId)await releaseSession(sessionId).catch(()=>{});await mutate('dispatcher:finish',{id,generation,cursor,idle:!payload.work.length});}
}
