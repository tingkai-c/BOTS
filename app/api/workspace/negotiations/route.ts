import { z } from 'zod';
import { apiError, liveMode, userId } from '@/lib/server/context';
import { mutate, query } from '@/lib/server/operations';
import { negotiationSettings } from '@/lib/negotiation/contracts';
import { signAuthorization } from '@/lib/server/negotiation-authorization';
import type { Doc } from '@/convex/_generated/dataModel';
const inputSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('start'),workspaceId:z.string(),listingId:z.string(),settings:negotiationSettings,authorized:z.literal(true)}),
 z.object({action:z.enum(['pause','resume','stop','check']),key:z.string(),version:z.number().int()}),
 z.object({action:z.literal('edit'),key:z.string(),version:z.number().int(),settings:negotiationSettings,authorized:z.literal(true)}),
]);
export async function POST(req:Request){try{const user=await userId();const input=inputSchema.parse(await req.json());if(!liveMode())return Response.json({demo:true});
 if(input.action==='start'){const key=crypto.randomUUID();const signature=signAuthorization(user,key,1,input.settings);await mutate('conversations:start',{userId:user,key,workspaceId:input.workspaceId,listingId:input.listingId,settings:input.settings,signature});return Response.json({key});}
 const thread=await query<Doc<'threads'>>('conversations:get',{userId:user,key:input.key});
 await mutate('conversations:control',{userId:user,key:input.key,action:input.action,expectedVersion:input.version,...(input.action==='edit'?{settings:input.settings,signature:signAuthorization(user,thread.key,input.version+1,input.settings)}:{})});return Response.json({ok:true});
 }catch(e){return apiError(e);}}
