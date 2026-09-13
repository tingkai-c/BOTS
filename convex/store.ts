import { mutationGeneric, queryGeneric, paginationOptsValidator, type MutationBuilder, type QueryBuilder, type DataModelFromSchemaDefinition } from 'convex/server';
import { searchStateSchema, summarizeWorkspace } from '../lib/schemas/workspace';
import { authorizeServer as authorize } from './access';
import schema from './schema';
type DataModel=DataModelFromSchemaDefinition<typeof schema>;
const mutation=mutationGeneric as MutationBuilder<DataModel,'public'>;
const query=queryGeneric as QueryBuilder<DataModel,'public'>;
import { v } from 'convex/values';
export const save=mutation({args:{secret:v.string(),userId:v.string(),state:v.any()},handler:async(ctx,a)=>{authorize(a.secret);const state=searchStateSchema.parse(a.state);const old=await ctx.db.query('searches').withIndex('by_key',q=>q.eq('key',state.id)).unique();if(old&&old.userId!==a.userId)throw new Error('Unauthorized');const now=Date.now();const workspace={...(old?.workspace??summarizeWorkspace(state.id,old?.state??state,old?._creationTime??now)),updatedAt:now,status:state.status,listingCount:state.listings.length};if(old)await ctx.db.patch(old._id,{state,workspace});else await ctx.db.insert('searches',{key:state.id,userId:a.userId,state,workspace});
 if(!await ctx.db.query('users').withIndex('by_user',q=>q.eq('userId',a.userId)).unique())await ctx.db.insert('users',{userId:a.userId});
 for(const l of state.listings){const key=`${state.id}:${l.id}`;const exists=await ctx.db.query('listings').withIndex('by_key',q=>q.eq('key',key)).unique();if(exists)await ctx.db.patch(exists._id,{data:l});else await ctx.db.insert('listings',{key,searchId:state.id,data:l});}
 for(const run of state.runs){const key=`${state.id}:${run.marketplace}`;const oldRun=await ctx.db.query('agentRuns').withIndex('by_key',q=>q.eq('key',key)).unique();if(oldRun)await ctx.db.patch(oldRun._id,{data:run});else await ctx.db.insert('agentRuns',{key,searchId:state.id,data:run});}
 const oldCount=old?.state.events?.length??0;for(const event of state.events.slice(oldCount))await ctx.db.insert('agentEvents',{searchId:state.id,data:event});
  }});
export const history=query({args:{paginationOpts:paginationOptsValidator},handler:async(ctx,a)=>{
 const user=await ctx.auth.getUserIdentity();if(!user)throw new Error('Unauthorized');
 const rows=await ctx.db.query('searches').withIndex('by_user',q=>q.eq('userId',user.subject)).order('desc').paginate({...a.paginationOpts,numItems:Math.min(50,Math.max(1,a.paginationOpts.numItems))});
 return {...rows,page:rows.page.map(row=>row.workspace??summarizeWorkspace(row.key,row.state,row._creationTime))};
}});
export const workspace=query({args:{id:v.string()},handler:async(ctx,a)=>{
 const user=await ctx.auth.getUserIdentity();if(!user)return null;
 const row=await ctx.db.query('searches').withIndex('by_key',q=>q.eq('key',a.id)).unique();
 if(!row||row.userId!==user.subject)return null;
 return {summary:row.workspace??summarizeWorkspace(row.key,row.state,row._creationTime),state:row.state};
}});
export const setMonitoringPaused=mutation({args:{id:v.string(),paused:v.boolean()},handler:async(ctx,a)=>{
 const user=await ctx.auth.getUserIdentity();if(!user)throw new Error('Unauthorized');
 const row=await ctx.db.query('searches').withIndex('by_key',q=>q.eq('key',a.id)).unique();
 if(!row||row.userId!==user.subject)throw new Error('Unauthorized');
 await ctx.db.patch(row._id,{workspace:{...(row.workspace??summarizeWorkspace(row.key,row.state,row._creationTime)),monitoringPaused:a.paused,updatedAt:Date.now()}});
}});
export const watch=query({args:{id:v.string()},handler:async(ctx,a)=>{const user=await ctx.auth.getUserIdentity();if(!user)return null;const row=await ctx.db.query('searches').withIndex('by_key',q=>q.eq('key',a.id)).unique();return row?.userId===user.subject?row.state:null;}});
export const connection=query({args:{secret:v.string(),userId:v.string(),marketplace:v.string()},handler:async(ctx,a)=>{authorize(a.secret);return ctx.db.query('marketplaceConnections').withIndex('by_user_market',q=>q.eq('userId',a.userId).eq('marketplace',a.marketplace)).unique();}});
export const saveConnection=mutation({args:{secret:v.string(),userId:v.string(),marketplace:v.string(),profileId:v.string(),sessionId:v.optional(v.string())},handler:async(ctx,a)=>{authorize(a.secret);const old=await ctx.db.query('marketplaceConnections').withIndex('by_user_market',q=>q.eq('userId',a.userId).eq('marketplace',a.marketplace)).unique();const data={userId:a.userId,marketplace:a.marketplace,profileId:a.profileId,sessionId:a.sessionId};if(old)await ctx.db.patch(old._id,data);else await ctx.db.insert('marketplaceConnections',data);}});
export const negotiation=mutation({args:{secret:v.string(),userId:v.string(),key:v.string(),data:v.any(),claim:v.optional(v.boolean())},handler:async(ctx,a)=>{authorize(a.secret);const old=await ctx.db.query('negotiations').withIndex('by_key',q=>q.eq('key',a.key)).unique();if(old&&old.userId!==a.userId)throw new Error('Unauthorized');if(a.claim&&old?.data.status!=='draft')throw new Error('This offer was already approved. Check the conversation before trying again.');if(old)await ctx.db.patch(old._id,{data:a.data});else await ctx.db.insert('negotiations',{key:a.key,userId:a.userId,data:a.data});}});
