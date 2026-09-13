import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { runDiscovery } from '@/lib/agents/discovery';
import { runMonitoring } from '@/lib/agents/monitoring';
export const runtime='nodejs';export const maxDuration=300;
export async function POST(req:Request){
 const secret=process.env.CONVEX_SERVER_SECRET;if(!secret)return new Response(null,{status:404});
 const expected=Buffer.from(`Bearer ${secret}`),provided=Buffer.from(req.headers.get('authorization')??'');if(expected.length!==provided.length||!timingSafeEqual(expected,provided))return new Response(null,{status:401});
 try{const input=z.object({kind:z.enum(['discovery','monitoring']),id:z.string().max(200),generation:z.number().int().nonnegative()}).parse(await req.json());if(input.kind==='discovery')await runDiscovery(input.id);else await runMonitoring(input.id,input.generation);return Response.json({ok:true});}
 catch{return Response.json({error:'Worker interrupted. Persisted claims will recover.'},{status:500});}
}
