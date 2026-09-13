import assert from 'node:assert/strict';
import test from 'node:test';
import { convexTest } from 'convex-test';
import { api } from '../convex/_generated/api';
import schema from '../convex/schema';
import { outgoingText, type Decision, type NegotiationSettings } from '../lib/negotiation/contracts';
import { signAuthorization, verifyAuthorization } from '../lib/server/negotiation-authorization';
import type { Listing } from '../lib/schemas';

const modules={
 '../convex/store.ts':()=>import('../convex/store'), '../convex/conversations.ts':()=>import('../convex/conversations'),
 '../convex/dispatcher.ts':()=>import('../convex/dispatcher'), '../convex/_generated/server.js':()=>import('../convex/_generated/server'),
};
const server={secret:'test-secret',userId:'alice'};
const listing:Listing={id:'listing',searchId:'workspace',marketplace:'ebay',title:'Used oak desk',price:200,currency:'USD',imageUrls:[],listingUrl:'https://www.ebay.com/itm/123',scrapedAt:1,confidence:.8,similarityScore:.9,demo:false};
const settings=():NegotiationSettings=>({openingOffer:100,maximum:180,currency:'USD',costBasis:'pickup',tone:'Friendly',instructions:'',expiresAt:Date.now()+3600_000});
const decision=(action:Decision['action'],amount:number|null=100,text=''):Decision=>({action,amount,currency:'USD',mandatoryCosts:0,text});
async function setup(){
 const t=convexTest(schema,modules);process.env.CONVEX_SERVER_SECRET=server.secret;
 await t.mutation(api.store.save,{...server,state:{id:'workspace',query:'Oak desk',status:'complete',demo:false,listings:[listing],events:[],runs:[]}});
 await t.mutation(api.store.saveConnection,{...server,marketplace:'ebay',profileId:'profile'});
 const s=settings();await t.mutation(api.conversations.start,{...server,key:'thread',workspaceId:'workspace',listingId:'listing',settings:s,signature:signAuthorization('alice','thread',1,s)});
 const account=await t.run(async ctx=>{const row=(await ctx.db.query('accountMonitoring').collect())[0];await ctx.db.patch(row._id,{generation:1,leaseExpiresAt:Date.now()+300_000});return row._id;});
 return {t,account,s};
}
const seller=(sourceId:string,text:string,ordinal:number)=>({sourceId,text,ordinal,role:'incoming' as const});
const own=(sourceId:string,text:string,ordinal:number)=>({sourceId,text,ordinal,role:'outgoing' as const});

test('authorization signatures bind owner, version, expiry and limits; free text cannot leak monetary promises',()=>{
 process.env.CONVEX_SERVER_SECRET=server.secret;const s=settings();const signature=signAuthorization('alice','thread',1,s);
 assert(verifyAuthorization('alice','thread',1,s,signature));assert(!verifyAuthorization('bob','thread',1,s,signature));assert(!verifyAuthorization('alice','thread',2,s,signature));assert(!verifyAuthorization('alice','thread',1,{...s,maximum:500},signature));
 assert.throws(()=>outgoingText(decision('counteroffer',181),s),/limit/);
 assert.throws(()=>outgoingText({...decision('confirm',150),currency:'CAD'},s),/Currency/);
 assert.throws(()=>outgoingText({...decision('confirm',150),mandatoryCosts:null},{...s,costBasis:'shipped'}),/costs/);
 assert.throws(()=>outgoingText(decision('reply',null,'My maximum budget is 180'),s),/input/);
 assert.throws(()=>outgoingText(decision('reply',null,'I will pay and meet tomorrow'),s),/input/);
 assert.match(outgoingText(decision('counteroffer',150),s)!,/USD 150.00/);
});

test('controlled multi-round negotiation persists exact messages and confirms only a seller-backed price',async()=>{
 const {t,account}=await setup();const base={...server,key:'thread'};
 await t.mutation(api.conversations.observe,{...base,conversationKey:'desk-chat',messages:[]});
 const attemptId=await t.mutation(api.conversations.prepare,{...base,version:1,revision:0,decision:decision('counteroffer')});assert(attemptId);
 const text=await t.mutation(api.conversations.claimSend,{...base,attemptId,accountId:account,generation:1});assert(text);
 assert.equal(await t.mutation(api.conversations.claimSend,{...base,attemptId,accountId:account,generation:1}),null);
 await t.mutation(api.conversations.finishSend,{...base,attemptId,confirmed:true,sourceId:'one'});
 const messages=[own('one',text,0),seller('two','Could you do USD 160?',1)];
 await t.mutation(api.conversations.observe,{...base,conversationKey:'desk-chat',messages});
 assert.equal((await t.query(api.conversations.get,base)).status,'active');
 const counter=await t.mutation(api.conversations.prepare,{...base,version:1,revision:1,decision:decision('counteroffer',150)});assert(counter);
 const counterText=await t.mutation(api.conversations.claimSend,{...base,attemptId:counter,accountId:account,generation:1});assert(counterText);
 await t.mutation(api.conversations.finishSend,{...base,attemptId:counter,confirmed:true,sourceId:'three'});
 messages.push(own('three',counterText,2),seller('four','Are you still interested?',3));
 await t.mutation(api.conversations.observe,{...base,conversationKey:'desk-chat',messages});
 const reply=await t.mutation(api.conversations.prepare,{...base,version:1,revision:2,decision:decision('reply',null,'Yes, I am still interested. Thank you!')});assert(reply);
 const replyText=await t.mutation(api.conversations.claimSend,{...base,attemptId:reply,accountId:account,generation:1});assert(replyText);
 await t.mutation(api.conversations.finishSend,{...base,attemptId:reply,confirmed:true,sourceId:'five'});
 messages.push(own('five',replyText,4),seller('six','Yes, USD 150 works.',5));
 await t.mutation(api.conversations.observe,{...base,conversationKey:'desk-chat',messages});
 await assert.rejects(t.mutation(api.conversations.prepare,{...base,version:1,revision:3,decision:decision('confirm',170)}),/Seller agreement/);
 const agreement=await t.mutation(api.conversations.prepare,{...base,version:1,revision:3,decision:decision('confirm',150)});assert(agreement);
 await t.mutation(api.conversations.claimSend,{...base,attemptId:agreement,accountId:account,generation:1});
 await t.mutation(api.conversations.finishSend,{...base,attemptId:agreement,confirmed:true,sourceId:'seven'});
 assert.equal((await t.query(api.conversations.get,base)).status,'agreed');
 assert.equal((await t.run(ctx=>ctx.db.query('searches').first()))?.reservedNegotiation,'thread');
});

test('pause, expiry, changed versions and stale account checks cannot claim a prepared send',async()=>{
 const {t,account,s}=await setup();const base={...server,key:'thread'};
 const send=await t.mutation(api.conversations.prepare,{...base,version:1,revision:0,decision:decision('counteroffer')});assert(send);
 await t.withIdentity({subject:'alice'}).mutation(api.store.setMonitoringPaused,{id:'workspace',paused:true});
 assert.equal(await t.mutation(api.conversations.claimSend,{...base,attemptId:send,accountId:account,generation:1}),null);
 await t.withIdentity({subject:'alice'}).mutation(api.store.setMonitoringPaused,{id:'workspace',paused:false});
 const next=await t.mutation(api.conversations.prepare,{...base,version:1,revision:0,decision:decision('counteroffer')});assert(next);
 await t.mutation(api.conversations.control,{...base,action:'edit',expectedVersion:1,settings:{...s,maximum:120},signature:'new-signed-settings'});
 assert.equal(await t.mutation(api.conversations.claimSend,{...base,attemptId:next,accountId:account,generation:1}),null);
 await assert.rejects(t.mutation(api.conversations.prepare,{...base,version:1,revision:0,decision:decision('counteroffer')}),/changed/);
 const latest=await t.mutation(api.conversations.prepare,{...base,version:2,revision:0,decision:decision('counteroffer')});assert(latest);
 await assert.rejects(t.mutation(api.conversations.claimSend,{...base,attemptId:latest,accountId:account,generation:2}),/Stale/);
 await t.run(async ctx=>{const thread=(await ctx.db.query('threads').collect())[0];await ctx.db.patch(thread._id,{settings:{...thread.settings,expiresAt:Date.now()-1}});});
 assert.equal(await t.mutation(api.conversations.claimSend,{...base,attemptId:latest,accountId:account,generation:1}),null);
});

test('uncertain delivery reconciles exact text without a second send and manual outgoing text pauses',async()=>{
 const {t,account}=await setup();const base={...server,key:'thread'};
 await t.mutation(api.conversations.observe,{...base,conversationKey:'desk',messages:[]});
 const attemptId=await t.mutation(api.conversations.prepare,{...base,version:1,revision:0,decision:decision('counteroffer')});assert(attemptId);
 const text=await t.mutation(api.conversations.claimSend,{...base,attemptId,accountId:account,generation:1});assert(text);
 await t.mutation(api.conversations.finishSend,{...base,attemptId,confirmed:false});
 await assert.rejects(t.mutation(api.conversations.prepare,{...base,version:1,revision:0,decision:decision('counteroffer')}),/changed/);
 await t.mutation(api.conversations.observe,{...base,conversationKey:'desk',messages:[own('sent',text,0)]});
 assert.equal((await t.query(api.conversations.get,base)).status,'active');
 assert.equal((await t.query(api.conversations.attempt,{...base,attemptId})).status,'confirmed');
 assert.equal(await t.mutation(api.conversations.prepare,{...base,version:1,revision:0,decision:decision('counteroffer')}),null);
 await t.mutation(api.conversations.observe,{...base,conversationKey:'desk',messages:[own('sent',text,0),own('manual','I am taking over now.',1)]});
 assert.equal((await t.query(api.conversations.get,base)).reason,'You took over');
 await assert.rejects(t.mutation(api.conversations.observe,{...base,conversationKey:'different',messages:[]}),/identity/);
});

test('competing sellers cannot reserve two agreements; duplicate cross-workspace listing selection is rejected',async()=>{
 const {t,s}=await setup();const second={...listing,id:'second',listingUrl:'https://www.ebay.com/itm/456'};
 await t.mutation(api.store.save,{...server,state:{id:'workspace',query:'Oak desk',status:'complete',demo:false,listings:[listing,second],events:[],runs:[]}});
 await t.mutation(api.conversations.start,{...server,key:'competitor',workspaceId:'workspace',listingId:'second',settings:s,signature:'signed'});
 for(const key of ['thread','competitor'])await t.mutation(api.conversations.observe,{...server,key,conversationKey:key,messages:[seller('one','USD 150 works.',0)]});
 const results=await Promise.allSettled(['thread','competitor'].map(key=>t.mutation(api.conversations.prepare,{...server,key,version:1,revision:1,decision:decision('confirm',150)})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await t.mutation(api.store.save,{...server,state:{id:'other-workspace',query:'Same desk',status:'complete',demo:false,listings:[{...listing,searchId:'other-workspace'}],events:[],runs:[]}});
 await assert.rejects(t.mutation(api.conversations.start,{...server,key:'duplicate',workspaceId:'other-workspace',listingId:'listing',settings:s,signature:'signed'}),/already has a negotiation/);
 await assert.rejects(t.withIdentity({subject:'bob'}).query(api.conversations.messages,{key:'thread'}),/Unauthorized/);
});
