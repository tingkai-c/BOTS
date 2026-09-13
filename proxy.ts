import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
const isPrivatePage=createRouteMatcher(['/search(.*)', '/history(.*)', '/settings(.*)']);
const clerk=clerkMiddleware(async (auth,req)=>{if(isPrivatePage(req))await auth.protect();});
export default function proxy(req:NextRequest,event:NextFetchEvent){return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?clerk(req,event):NextResponse.next();}
export const config={matcher:['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)','/(api|trpc)(.*)','/__clerk/:path*']};
