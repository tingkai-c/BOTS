import 'server-only';
import Steel from 'steel-sdk';
import { chromium } from 'playwright-core';
export const steel=()=>new Steel({steelAPIKey:process.env.STEEL_API_KEY!});
export async function createSession(profileId?:string,persistProfile=false){return steel().sessions.create({timeout:300000,profileId,persistProfile});}
export async function connectBrowser(sessionId:string){const browser=await chromium.connectOverCDP(`wss://connect.steel.dev?apiKey=${encodeURIComponent(process.env.STEEL_API_KEY!)}&sessionId=${encodeURIComponent(sessionId)}`,{timeout:25000}); const context=browser.contexts()[0];if(!context)throw new Error('Browser session expired. Please try again.');return {browser,page:context.pages()[0]??await context.newPage()};}
export async function releaseSession(id:string){await steel().sessions.release(id);}
export function viewerUrl(debugUrl:string,interactive=false){const url=new URL(debugUrl);url.searchParams.set('interactive',String(interactive));return url.toString();}
