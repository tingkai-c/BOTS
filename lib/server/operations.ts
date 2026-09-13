import 'server-only';
import { makeFunctionReference } from 'convex/server';
import { database } from './context';
export const serverSecret=()=>{if(!process.env.CONVEX_SERVER_SECRET)throw new Error('Server is not configured.');return process.env.CONVEX_SERVER_SECRET;};
export const mutate=<T=unknown>(name:string,args:Record<string,unknown>)=>database().mutation(makeFunctionReference<'mutation',Record<string,unknown>,T>(name),JSON.parse(JSON.stringify({secret:serverSecret(),...args})));
export const query=<T=unknown>(name:string,args:Record<string,unknown>)=>database().query(makeFunctionReference<'query',Record<string,unknown>,T>(name),JSON.parse(JSON.stringify({secret:serverSecret(),...args})));
