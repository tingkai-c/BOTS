import assert from 'node:assert/strict';
import test from 'node:test';
import { convexTest } from 'convex-test';
import { api } from '../convex/_generated/api';
import schema from '../convex/schema';
import { signAuthorization } from '../lib/server/negotiation-authorization';
import type { Decision, NegotiationSettings } from '../lib/negotiation/contracts';
import type { Listing } from '../lib/schemas';

const modules={
 '../convex/store.ts':()=>import('../convex/store'), '../convex/conversations.ts':()=>import('../convex/conversations'),
 '../convex/dispatcher.ts':()=>import('../convex/dispatcher'), '../convex/_generated/server.js':()=>import('../convex/_generated/server'),
};
const server={secret:'test-secret',userId:'alice'};
const listing:Listing={id:'listing',searchId:'workspace',marketplace:'facebook',title:'Bike',price:200,currency:'USD',imageUrls:[],listingUrl:'https://www.facebook.com/marketplace/item/123',scrapedAt:1,confidence:.8,similarityScore:.9,demo:false};
const settings=():NegotiationSettings=>({openingOffer:100,maximum:180,currency:'USD',costBasis:'pickup',tone:'Friendly',instructions:'',expiresAt:Date.now()+3600_000});
const decision=(action:Decision['action'],amount:number|null=150,text=''):Decision=>({action,amount,currency:'USD',mandatoryCosts:0,text});
async function setup(){
 const t=convexTest(schema,modules);process.env.CONVEX_SERVER_SECRET=server.secret;
 await t.mutation(api.store.save,{...server,state:{id:'workspace',query:'Bike',status:'complete',demo:false,listings:[listing],events:[],runs:[]}});
 await t.mutation(api.store.saveConnection,{...server,marketplace:'facebook',profileId:'profile'});
 const s=settings();await t.mutation(api.conversations.start,{...server,key:'thread',workspaceId:'workspace',listingId:'listing',settings:s,signature:signAuthorization('alice','thread',1,s)});
 const account=await t.run(async ctx=>{const row=(await ctx.db.query('accountMonitoring').collect())[0];await ctx.db.patch(row._id,{generation:1,leaseExpiresAt:Date.now()+300_000});return row._id;});
 return {t,account};
}
const seller=(sourceId:string,text:string,ordinal:number)=>({sourceId,text,ordinal,role:'incoming' as const});
const own=(sourceId:string,text:string,ordinal:number)=>({sourceId,text,ordinal,role:'outgoing' as const});

test('claimNotification fires exactly once after a fresh confirm reaches agreement, and finishNotification records the outcome',async()=>{
 const {t,account}=await setup();const base={...server,key:'thread'};
 await t.mutation(api.conversations.observe,{...base,conversationKey:'chat',messages:[seller('one','Yes, USD 150 works.',0)]});
 assert.equal(await t.mutation(api.conversations.claimNotification,base),null,'not agreed yet: nothing to claim');
 const attemptId=await t.mutation(api.conversations.prepare,{...base,version:1,revision:1,decision:decision('confirm',150)});assert(attemptId);
 await t.mutation(api.conversations.claimSend,{...base,attemptId,accountId:account,generation:1});
 await t.mutation(api.conversations.finishSend,{...base,attemptId,confirmed:true,sourceId:'two'});
 assert.equal((await t.query(api.conversations.get,base)).status,'agreed');
 const claimed=await t.mutation(api.conversations.claimNotification,base);
 assert(claimed,'first claim should succeed once agreed');
 assert.equal(claimed.currentOffer,150);
 assert.equal(await t.mutation(api.conversations.claimNotification,base),null,'a second claim must not fire twice');
 await t.mutation(api.conversations.finishNotification,{...base,status:'sent',detail:'SM_test_sid'});
 assert.deepEqual((await t.query(api.conversations.get,base)).notification,{status:'sent',detail:'SM_test_sid',at:(await t.query(api.conversations.get,base)).notification!.at});
});

test('claimNotification also fires when observe reconciles a prior confirm it never got to finishSend on',async()=>{
 const {t,account}=await setup();const base={...server,key:'thread'};
 await t.mutation(api.conversations.observe,{...base,conversationKey:'chat',messages:[seller('one','Yes, USD 150 works.',0)]});
 const attemptId=await t.mutation(api.conversations.prepare,{...base,version:1,revision:1,decision:decision('confirm',150)});assert(attemptId);
 const text=await t.mutation(api.conversations.claimSend,{...base,attemptId,accountId:account,generation:1});assert(text);
 // Simulate a crash right here: no finishSend call, so the attempt is stuck at 'claimed'.
 await t.mutation(api.conversations.observe,{...base,conversationKey:'chat',messages:[seller('one','Yes, USD 150 works.',0),own('reconciled',text,1)]});
 assert.equal((await t.query(api.conversations.get,base)).status,'agreed','observe should reconcile the claimed confirm into agreement');
 const claimed=await t.mutation(api.conversations.claimNotification,base);
 assert(claimed,'reconciliation-path agreement must still be claimable exactly once');
 assert.equal(await t.mutation(api.conversations.claimNotification,base),null);
});
