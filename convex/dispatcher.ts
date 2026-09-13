import { internalMutation, internalAction, mutation } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { authorizeServer } from './access';

export const tick=internalMutation({args:{},handler:async(ctx)=>{
 if(!process.env.WORKSPACE_WORKER_URL)return;
 const now=Date.now();
 const accounts=await ctx.db.query('accountMonitoring').withIndex('by_due',q=>q.lte('nextDueAt',now)).take(3);
 for(const account of accounts){if((account.leaseExpiresAt??0)>now)continue;const generation=account.generation+1;await ctx.db.patch(account._id,{generation,leaseExpiresAt:now+300_000,nextDueAt:now+300_000});await ctx.scheduler.runAfter(0,internal.dispatcher.invoke,{kind:'monitoring',id:account._id,generation});}
 for(const status of ['queued','running'] as const){const jobs=await ctx.db.query('workspaceJobs').withIndex('by_status_due',q=>q.eq('status',status).lte('nextRunAt',now)).take(3);for(const job of jobs)await ctx.scheduler.runAfter(0,internal.dispatcher.invoke,{kind:'discovery',id:job._id,generation:job.generation});}
}});
export const invoke=internalAction({args:{kind:v.union(v.literal('discovery'),v.literal('monitoring')),id:v.string(),generation:v.number()},handler:async(_ctx,a)=>{
 const url=process.env.WORKSPACE_WORKER_URL;const secret=process.env.CONVEX_SERVER_SECRET;
 if(!url||!secret)return;
 const target=new URL(url);if(target.protocol!=='https:'||!target.hostname.endsWith('.vercel.app')||target.pathname!=='/api/workspace/worker')throw new Error('Select a supported Vercel workspace worker.');
 try{const response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify(a),signal:AbortSignal.timeout(280_000)});if(!response.ok)console.error(`Workspace worker returned ${response.status}; persisted claims will recover.`,await response.text().catch(()=>''));}catch(e){console.error('Workspace worker unavailable; persisted claims will recover.',e);}
}});
export const accountWork=mutation({args:{secret:v.string(),id:v.id('accountMonitoring'),generation:v.number()},handler:async(ctx,a)=>{
 authorizeServer(a.secret);const account=await ctx.db.get(a.id);if(!account||account.generation!==a.generation||(account.leaseExpiresAt??0)<=Date.now())return null;
 const threads=await ctx.db.query('threads').withIndex('by_account',q=>q.eq('userId',account.userId).eq('marketplace',account.marketplace).eq('profileId',account.profileId)).collect();
 const work=[];
 for(const t of threads){if(t.settings.expiresAt<=Date.now()&&t.status==='active'){await ctx.db.patch(t._id,{status:'expired',reason:'Authorization expired. Extend it to continue.'});continue;}
  if(!['active','uncertain'].includes(t.status))continue;
  const workspace=await ctx.db.query('searches').withIndex('by_key',q=>q.eq('key',t.workspaceId)).unique();if(!workspace||workspace.userId!==account.userId||workspace.workspace?.monitoringPaused)continue;
  const listing=await ctx.db.query('listings').withIndex('by_key',q=>q.eq('key',`${t.workspaceId}:${t.listingId}`)).unique();if(listing)work.push({thread:t,listing:listing.data});
 }
 work.sort((a,b)=>a.thread.key.localeCompare(b.thread.key));return {account,work:account.cursor?work.filter(w=>w.thread.key>account.cursor!):work};
}});
export const finish=mutation({args:{secret:v.string(),id:v.id('accountMonitoring'),generation:v.number(),cursor:v.optional(v.string()),idle:v.boolean()},handler:async(ctx,a)=>{authorizeServer(a.secret);const row=await ctx.db.get(a.id);if(!row||row.generation!==a.generation)return;await ctx.db.patch(row._id,{leaseExpiresAt:undefined,debugUrl:undefined,lastCheckedAt:Date.now(),cursor:a.cursor,nextDueAt:Date.now()+(a.cursor?0:a.idle?86400_000:300_000)});}});
export const browser=mutation({args:{secret:v.string(),id:v.id('accountMonitoring'),generation:v.number(),debugUrl:v.string()},handler:async(ctx,a)=>{authorizeServer(a.secret);const row=await ctx.db.get(a.id);if(row&&row.generation===a.generation&&(row.leaseExpiresAt??0)>Date.now())await ctx.db.patch(row._id,{debugUrl:a.debugUrl});}});
