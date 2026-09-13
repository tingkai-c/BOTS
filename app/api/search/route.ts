import { searchSchema, type SearchState } from '@/lib/schemas';
import { orchestrate } from '@/lib/agents/orchestrator';
import { identify } from '@/lib/ai/identify';
import { apiError, liveMode, saveState, userId } from '@/lib/server/context';
import { mutate } from '@/lib/server/operations';
export const runtime='nodejs';export const maxDuration=300;
export async function POST(req:Request){
 try{
  const user=await userId();const input=searchSchema.parse(await req.json());const price=input.query.match(/under\s*\$?(\d+)/i);if(price&&!input.maxPrice)input.maxPrice=Number(price[1]);
  const state:SearchState={id:crypto.randomUUID(),query:input.query||'Image search',queryKind:input.query?'text':'image',status:'queued',demo:!liveMode(),filters:{maxPrice:input.maxPrice,condition:input.condition,marketplace:input.marketplace,location:input.location,radius:input.radius},listings:[],events:[],runs:(input.marketplace==='all'?['facebook','ebay','kijiji'] as const:[input.marketplace]).map(marketplace=>({marketplace,status:'queued',message:'Waiting to start'}))};
  state.filters!.currency=input.currency??'USD';
  await saveState(user,state);
  if(!state.demo){
   try{state.identification=await identify(input);await saveState(user,state);for(const run of state.runs)await mutate('work:enqueue',{userId:user,workspaceId:state.id,marketplace:run.marketplace,kind:'discovery'});}
   catch{state.status='failed';state.events.push({id:crypto.randomUUID(),time:Date.now(),kind:'error',message:'Search setup failed. Reopen this workspace and retry.'});await saveState(user,state);}
   return new Response(JSON.stringify({type:'state',state})+'\n',{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store'}});
  }
  const encoder=new TextEncoder();const stream=new ReadableStream({async start(controller){const emit=(e:unknown)=>{try{controller.enqueue(encoder.encode(JSON.stringify(e)+'\n'));}catch{}};emit({type:'state',state});try{await orchestrate(state,input,user,emit,req.signal);}catch{emit({type:'error',message:'Search interrupted. Please retry.'});}finally{try{controller.close();}catch{}}}});
  return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
 }catch(e){return apiError(e);}
}
