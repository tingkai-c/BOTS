import { z } from 'zod';
import type { SearchState } from '@/lib/schemas';
import { apiError, liveMode, userId } from '@/lib/server/context';
import { mutate, query } from '@/lib/server/operations';
export async function POST(req:Request){try{const user=await userId();const input=z.object({workspaceId:z.string(),listingId:z.string().optional()}).parse(await req.json());if(!liveMode())return Response.json({demo:true,message:'Demo has no additional marketplace results.'});const state=await query<SearchState>('store:read',{userId:user,id:input.workspaceId});
 if(input.listingId){const listing=state.listings.find(l=>l.id===input.listingId);if(!listing)throw new Error('Listing not found.');await mutate('work:enqueue',{userId:user,workspaceId:state.id,marketplace:listing.marketplace,kind:'inspection',listingId:listing.id,resume:true});}
 else for(const run of state.runs)await mutate('work:enqueue',{userId:user,workspaceId:state.id,marketplace:run.marketplace,kind:'discovery',resume:true});
 return Response.json({queued:true});}catch(e){return apiError(e);}}
