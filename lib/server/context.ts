import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import type { SearchState, Marketplace } from '@/lib/schemas';
export const liveMode=()=>Boolean(process.env.STEEL_API_KEY);
class AuthenticationRequired extends Error {}
export async function userId(){if(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY){const session=await auth();if(!session.userId)throw new AuthenticationRequired('Sign in to use your shopping agent.');return session.userId;}if(liveMode())throw new Error('Live mode needs Clerk authentication configured.');return 'demo';}
export function database(){if(!process.env.NEXT_PUBLIC_CONVEX_URL||!process.env.CONVEX_SERVER_SECRET)throw new Error('Configure Convex and CONVEX_SERVER_SECRET to use live marketplace sessions.');return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);}
const secret=()=>process.env.CONVEX_SERVER_SECRET!;
export async function saveState(user:string,state:SearchState){if(!state.demo)await database().mutation(makeFunctionReference<'mutation'>('store:save'),{secret:secret(),userId:user,state:JSON.parse(JSON.stringify(state))});}
export async function connection(user:string,marketplace:Marketplace):Promise<{profileId:string;sessionId?:string}|null>{return database().query(makeFunctionReference<'query'>('store:connection'),{secret:secret(),userId:user,marketplace});}
export async function saveConnection(user:string,marketplace:Marketplace,profileId:string,sessionId?:string){return database().mutation(makeFunctionReference<'mutation'>('store:saveConnection'),{secret:secret(),userId:user,marketplace,profileId,...(sessionId?{sessionId}:{})});}
export async function saveNegotiation(user:string,key:string,data:unknown,claim=false){return database().mutation(makeFunctionReference<'mutation'>('store:negotiation'),{secret:secret(),userId:user,key,data,claim});}
export function apiError(error:unknown){return Response.json({error:error instanceof Error?error.message:'Something went wrong. Please try again.'},{status:error instanceof AuthenticationRequired?401:400});}
