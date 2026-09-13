import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { authorizeServer, ownedWorkspace } from './access';
import { settingsValidator, messageValidator } from './negotiationValidators';
import { decisionSchema, messageSchema, negotiationSettings, outgoingText, statedAmounts } from '../lib/negotiation/contracts';
import { internal } from './_generated/api';

const server = { secret:v.string(), userId:v.string() };
async function owned(ctx: Pick<QueryCtx,'db'>, userId:string, key:string) {
  const row = await ctx.db.query('threads').withIndex('by_key',q=>q.eq('key',key)).unique();
  if(!row || row.userId!==userId) throw new Error('Unauthorized'); return row;
}
async function wake(ctx:MutationCtx, userId:string, marketplace:'facebook'|'ebay'|'kijiji', profileId:string) {
  const old=await ctx.db.query('accountMonitoring').withIndex('by_account',q=>q.eq('userId',userId).eq('marketplace',marketplace).eq('profileId',profileId)).unique();
  if(old){if((old.leaseExpiresAt??0)<=Date.now())await ctx.db.patch(old._id,{nextDueAt:Date.now()});}
  else await ctx.db.insert('accountMonitoring',{userId,marketplace,profileId,nextDueAt:Date.now(),generation:0});
  await ctx.scheduler.runAfter(0,internal.dispatcher.tick,{});
}
export const start=mutation({args:{...server,key:v.string(),workspaceId:v.string(),listingId:v.string(),settings:settingsValidator,signature:v.string()},handler:async(ctx,a)=>{
  authorizeServer(a.secret); const workspace=await ownedWorkspace(ctx,a.userId,a.workspaceId);
  const settings=negotiationSettings.parse(a.settings); if(settings.expiresAt<=Date.now()||settings.expiresAt>Date.now()+24*60*60*1000+60_000)throw new Error('Authorization must expire within 24 hours.');
  if(workspace.reservedNegotiation)throw new Error('This workspace already has a reserved agreement.');
  const listing=await ctx.db.query('listings').withIndex('by_key',q=>q.eq('key',`${a.workspaceId}:${a.listingId}`)).unique();
  if(!listing||listing.data.demo||listing.data.currency!==settings.currency)throw new Error('Listing or currency is not valid for live negotiation.');
  const existing=await ctx.db.query('threads').withIndex('by_user_listing',q=>q.eq('userId',a.userId).eq('listingUrl',listing.data.listingUrl)).collect();
  if(existing.some(t=>t.status!=='stopped'&&t.status!=='expired'))throw new Error('This listing already has a negotiation. Open that workspace instead.');
  const connection=await ctx.db.query('marketplaceConnections').withIndex('by_user_market',q=>q.eq('userId',a.userId).eq('marketplace',listing.data.marketplace)).unique();
  if(!connection?.profileId||connection.sessionId)throw new Error('Finish connecting this marketplace first.');
  await ctx.db.insert('threads',{key:a.key,userId:a.userId,workspaceId:a.workspaceId,listingId:a.listingId,listingUrl:listing.data.listingUrl,marketplace:listing.data.marketplace,profileId:connection.profileId,settings,signature:a.signature,version:1,revision:0,handledRevision:-1,status:'active',createdAt:Date.now()});
  await wake(ctx,a.userId,listing.data.marketplace,connection.profileId);return a.key;
}});
export const list=query({args:{workspaceId:v.string()},handler:async(ctx,a)=>{const user=await ctx.auth.getUserIdentity();if(!user)throw new Error('Unauthorized');await ownedWorkspace(ctx,user.subject,a.workspaceId);return ctx.db.query('threads').withIndex('by_workspace',q=>q.eq('workspaceId',a.workspaceId)).collect();}});
export const messages=query({args:{key:v.string()},handler:async(ctx,a)=>{const user=await ctx.auth.getUserIdentity();if(!user)throw new Error('Unauthorized');await owned(ctx,user.subject,a.key);const messages=await ctx.db.query('conversationMessages').withIndex('by_thread',q=>q.eq('threadId',a.key)).collect();const attempts=await ctx.db.query('sendAttempts').withIndex('by_thread',q=>q.eq('threadId',a.key)).collect();return {messages:messages.sort((a,b)=>a.ordinal-b.ordinal),attempts};}});
export const get=query({args:{...server,key:v.string()},handler:async(ctx,a)=>{authorizeServer(a.secret);return owned(ctx,a.userId,a.key);}});
export const schedule=query({args:{key:v.string()},handler:async(ctx,a)=>{const user=await ctx.auth.getUserIdentity();if(!user)throw new Error('Unauthorized');const t=await owned(ctx,user.subject,a.key);const row=await ctx.db.query('accountMonitoring').withIndex('by_account',q=>q.eq('userId',user.subject).eq('marketplace',t.marketplace).eq('profileId',t.profileId)).unique();return row?{nextDueAt:row.nextDueAt,debugUrl:row.debugUrl}:null;}});
export const attempt=query({args:{...server,key:v.string(),attemptId:v.id('sendAttempts')},handler:async(ctx,a)=>{authorizeServer(a.secret);await owned(ctx,a.userId,a.key);const send=await ctx.db.get(a.attemptId);if(!send||send.threadId!==a.key)throw new Error('Unauthorized');return send;}});
export const control=mutation({args:{...server,key:v.string(),action:v.union(v.literal('pause'),v.literal('resume'),v.literal('stop'),v.literal('check'),v.literal('edit')),expectedVersion:v.number(),settings:v.optional(settingsValidator),signature:v.optional(v.string())},handler:async(ctx,a)=>{
 authorizeServer(a.secret);const t=await owned(ctx,a.userId,a.key);if(t.version!==a.expectedVersion)throw new Error('Settings changed. Refresh and try again.');
 if(a.action==='check'){await wake(ctx,a.userId,t.marketplace,t.profileId);return;}
 if(a.action==='edit'){
  if(t.status==='agreed'||t.status==='stopped')throw new Error('This negotiation has ended.');
  const settings=negotiationSettings.parse(a.settings);if(!a.signature||settings.currency!==t.settings.currency||settings.expiresAt<=Date.now()||settings.expiresAt>Date.now()+86460_000)throw new Error('Invalid authorization.');
  await ctx.db.patch(t._id,{settings,signature:a.signature,version:t.version+1,status:t.status==='uncertain'?'uncertain':'active',handledRevision:t.status==='needs_attention'?t.revision-1:t.handledRevision,reason:undefined});
  for(const send of await ctx.db.query('sendAttempts').withIndex('by_thread',q=>q.eq('threadId',t.key)).collect())if(send.status==='prepared')await ctx.db.patch(send._id,{status:'cancelled'});
 } else {
  if(t.status==='agreed'||t.status==='stopped')throw new Error('This negotiation has ended.');
  if(a.action==='resume'&&(t.status==='uncertain'||t.settings.expiresAt<=Date.now()))throw new Error('Resolve uncertain delivery or extend authorization first.');
  await ctx.db.patch(t._id,{status:a.action==='pause'?'paused':a.action==='stop'?'stopped':'active',reason:a.action==='resume'?undefined:t.reason});
 }
 if(a.action==='resume'||a.action==='edit')await wake(ctx,a.userId,t.marketplace,t.profileId);
}});
export const observe=mutation({args:{...server,key:v.string(),conversationKey:v.string(),messages:v.array(messageValidator)},handler:async(ctx,a)=>{
 authorizeServer(a.secret);const t=await owned(ctx,a.userId,a.key);
 if(t.conversationKey&&t.conversationKey!==a.conversationKey)throw new Error('Conversation identity changed.');
 if(a.messages.length>500)throw new Error('Conversation history is too large to verify.');
 const messages=a.messages.map(m=>messageSchema.parse(m));
 if(new Set(messages.map(m=>m.sourceId)).size!==messages.length)throw new Error('Ambiguous message identity.');
 const old=await ctx.db.query('conversationMessages').withIndex('by_thread',q=>q.eq('threadId',t.key)).collect();
 const known=new Map(old.map(m=>[m.sourceId,m]));
 if(old.length && old.some(m=>!messages.some(n=>n.sourceId===m.sourceId&&n.text===m.text&&n.role===m.role)))throw new Error('Full conversation history could not be verified.');
 const attempts=await ctx.db.query('sendAttempts').withIndex('by_thread',q=>q.eq('threadId',t.key)).collect();
 let revision=t.revision, takeover=false, reconciled=false;
 for(const message of messages){if(known.has(message.sourceId))continue;
  if(message.role==='incoming')revision++;
  else {const matched=attempts.some(s=>s.status==='confirmed'&&s.sourceId===message.sourceId&&s.text===message.text);const pending=attempts.filter(s=>['claimed','uncertain','confirmed'].includes(s.status)&&s.text===message.text&&!s.sourceId);if(!matched&&pending.length===1){await ctx.db.patch(pending[0]._id,{status:'confirmed',sourceId:message.sourceId});reconciled=true;}else if(!matched&&t.conversationKey)takeover=true;}
  await ctx.db.insert('conversationMessages',{threadId:t.key,...message,observedAt:Date.now()});
 }
 const unresolved=attempts.some(s=>['claimed','uncertain'].includes(s.status)&&!messages.some(m=>m.role==='outgoing'&&m.text===s.text));
 const confirmedAgreement=attempts.some(s=>s.action==='confirm'&&messages.some(m=>m.role==='outgoing'&&m.text===s.text)&&['claimed','uncertain','confirmed'].includes(s.status));
 const status=takeover?'paused':unresolved?'uncertain':confirmedAgreement?'agreed':t.status==='uncertain'&&reconciled?'active':t.status;
 await ctx.db.patch(t._id,{conversationKey:a.conversationKey,revision,lastCheckedAt:Date.now(),status,reason:takeover?'You took over':unresolved?'Delivery is uncertain. Review the exact message in the marketplace.':undefined});
 return {revision,status};
}});
export const prepare=mutation({args:{...server,key:v.string(),version:v.number(),revision:v.number(),decision:v.any()},handler:async(ctx,a)=>{
 authorizeServer(a.secret);const t=await owned(ctx,a.userId,a.key);const workspace=await ownedWorkspace(ctx,a.userId,t.workspaceId);
 if(t.status!=='active'||t.version!==a.version||t.revision!==a.revision||t.settings.expiresAt<=Date.now()||workspace.workspace?.monitoringPaused||workspace.reservedNegotiation&&workspace.reservedNegotiation!==t.key)throw new Error('Authorization or conversation changed.');
 if(t.handledRevision>=t.revision)return null;
 const pending=await ctx.db.query('sendAttempts').withIndex('by_thread',q=>q.eq('threadId',t.key)).collect();for(const s of pending)if(s.status==='prepared'&&(s.version!==t.version||s.revision!==t.revision))await ctx.db.patch(s._id,{status:'cancelled'});if(pending.some(s=>['claimed','uncertain'].includes(s.status)))return null;const prepared=pending.find(s=>s.status==='prepared'&&s.version===t.version&&s.revision===t.revision);if(prepared)return prepared._id;
 const d=decisionSchema.parse(a.decision);const text=outgoingText(d,t.settings);
 if(text&&t.settings.costBasis==='shipped'){
  const listing=await ctx.db.query('listings').withIndex('by_key',q=>q.eq('key',`${t.workspaceId}:${t.listingId}`)).unique();
  const messages=await ctx.db.query('conversationMessages').withIndex('by_thread',q=>q.eq('threadId',t.key)).collect();const latest=messages.filter(m=>m.role==='incoming').sort((a,b)=>b.ordinal-a.ordinal)[0];
  if(d.mandatoryCosts!==listing?.data.shippingCost&&(!latest||!statedAmounts(latest.text,t.settings.currency).includes(d.mandatoryCosts??-1)))throw new Error('Mandatory costs are not verified.');
 }
 if(!text){await ctx.db.patch(t._id,{handledRevision:t.revision,status:d.action==='input'?'needs_attention':d.action==='end'?'stopped':t.status,reason:d.text||undefined});return null;}
 if(d.action==='confirm'){
  const messages=await ctx.db.query('conversationMessages').withIndex('by_thread',q=>q.eq('threadId',t.key)).collect();const seller=messages.filter(m=>m.role==='incoming').sort((a,b)=>b.ordinal-a.ordinal)[0];
  if(!seller||!statedAmounts(seller.text,t.settings.currency).includes(d.amount!)&&!(t.currentOffer===d.amount&&/\b(yes|agreed|accept|works|deal)\b/i.test(seller.text)))throw new Error('Seller agreement needs verification.');
  if(workspace.reservedNegotiation&&workspace.reservedNegotiation!==t.key)throw new Error('Another deal is reserved.');
  await ctx.db.patch(workspace._id,{reservedNegotiation:t.key});
  for(const other of await ctx.db.query('threads').withIndex('by_workspace',q=>q.eq('workspaceId',t.workspaceId)).collect())if(other.key!==t.key&&other.status==='active')await ctx.db.patch(other._id,{status:'paused',reason:'Another acceptable deal was reserved.'});
 }
 return ctx.db.insert('sendAttempts',{threadId:t.key,version:t.version,revision:t.revision,text,action:d.action,...(d.amount!==null?{amount:d.amount}:{}),status:'prepared',createdAt:Date.now()});
}});
export const claimSend=mutation({args:{...server,key:v.string(),attemptId:v.id('sendAttempts'),accountId:v.id('accountMonitoring'),generation:v.number()},handler:async(ctx,a)=>{
 authorizeServer(a.secret);const t=await owned(ctx,a.userId,a.key);const w=await ownedWorkspace(ctx,a.userId,t.workspaceId);const send=await ctx.db.get(a.attemptId);const account=await ctx.db.get(a.accountId);
 if(!account||account.userId!==a.userId||account.profileId!==t.profileId||account.marketplace!==t.marketplace||account.generation!==a.generation||(account.leaseExpiresAt??0)<=Date.now())throw new Error('Stale account check.');
 if(!send||send.threadId!==t.key||send.status!=='prepared')return null;
 if(send.version!==t.version||send.revision!==t.revision||t.status!=='active'||t.settings.expiresAt<=Date.now()||w.workspace?.monitoringPaused||w.reservedNegotiation&&w.reservedNegotiation!==t.key){await ctx.db.patch(send._id,{status:'cancelled'});return null;}
 await ctx.db.patch(send._id,{status:'claimed',claimedAt:Date.now()});await ctx.db.patch(t._id,{handledRevision:t.revision,...(send.amount!==undefined?{currentOffer:send.amount}:{})});return send.text;
}});
export const finishSend=mutation({args:{...server,key:v.string(),attemptId:v.id('sendAttempts'),confirmed:v.boolean(),sourceId:v.optional(v.string())},handler:async(ctx,a)=>{
 authorizeServer(a.secret);const t=await owned(ctx,a.userId,a.key);const send=await ctx.db.get(a.attemptId);if(!send||send.threadId!==t.key||send.status!=='claimed')return;
 await ctx.db.patch(send._id,{status:a.confirmed?'confirmed':'uncertain',sourceId:a.sourceId});
 if(!a.confirmed||send.action==='confirm')await ctx.db.patch(t._id,{status:a.confirmed?'agreed':'uncertain',reason:a.confirmed?'Price agreed. Handle payment and logistics yourself.':'Delivery is uncertain. Do not resend; check the conversation.'});
}});
export const attention=mutation({args:{...server,key:v.string(),reason:v.string()},handler:async(ctx,a)=>{authorizeServer(a.secret);const t=await owned(ctx,a.userId,a.key);if(t.status==='active')await ctx.db.patch(t._id,{status:'needs_attention',reason:a.reason.slice(0,500)});}});
// Two-phase claim (mirrors claimSend/finishSend) so exactly one caller texts the user per thread,
// regardless of whether agreement was observed via a fresh confirm or via reconciliation.
export const claimNotification=mutation({args:{...server,key:v.string()},handler:async(ctx,a)=>{
 authorizeServer(a.secret);const t=await owned(ctx,a.userId,a.key);
 if(t.status!=='agreed'||t.notification)return null;
 await ctx.db.patch(t._id,{notification:{status:'sent',detail:'Sending…',at:Date.now()}});
 return t;
}});
export const finishNotification=mutation({args:{...server,key:v.string(),status:v.union(v.literal('sent'),v.literal('skipped')),detail:v.string()},handler:async(ctx,a)=>{
 authorizeServer(a.secret);const t=await owned(ctx,a.userId,a.key);
 await ctx.db.patch(t._id,{notification:{status:a.status,detail:a.detail.slice(0,500),at:Date.now()}});
}});
