import type { Locator, Page } from 'playwright-core';
import type { Listing } from '@/lib/schemas';
import { messageSchema, type ConversationMessage } from '@/lib/negotiation/contracts';
import type { ConversationAdapter, Transcript } from '../conversation';
import { inspectListing, requireLoginCheck } from '../shared';
import { attachSellerComposer, clearComposer, composerText, fillComposer, submitComposer } from './messaging';

/** One candidate message row, as measured in the page. `own` carries an explicit direction when
 * Messenger exposes one, `align` is how far the bubble hugs the right edge of the message list
 * (positive) or the left edge (negative), and `avatar` is a sender picture beside the bubble. */
export type RawRow={parts:string[];own:boolean|null;align:number|null;avatar:boolean};
export type RawTranscript={rows:RawRow[];hasList:boolean;matched:boolean;ambiguous:boolean};

// Timestamps, delivery receipts and day separators share the message list with real bubbles.
const metadata=/^(?:you sent|sent|sending|seen|seen by .*|delivered|read|unsent|you unsent a message|active now|active \d+.*|enter|today|yesterday|just now|\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:mon|tue|tues|wed|wednes|thu|thur|thurs|fri|sat|satur|sun)(?:day)?(?:\s+(?:at\s+)?\d{1,2}:\d{2}.*)?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*\d{0,2}(?:,?\s*\d{4})?(?:\s+(?:at\s+)?\d{1,2}:\d{2}.*)?)$/i;
// A Messenger bubble is capped well below the list width, so the side it hugs is unambiguous
// even for a long wrapped message. Anything closer to centred than this is treated as no signal.
const alignMargin=0.05;

export function messageTextFrom(parts:string[]):string{
 return parts.map(part=>part.replace(/\r\n?/g,'\n').replace(/[^\S\n]+/g,' ').trim()).filter(part=>part&&!metadata.test(part)).join('\n').trim().slice(0,6000);
}

/** Direction has to be verified, never assumed, so every signal the page offers must agree.
 * A bubble with no usable signal, or with signals that disagree, stops the check. */
export function directionOf(row:RawRow):'incoming'|'outgoing'{
 const signals:boolean[]=[];
 if(row.own!==null)signals.push(row.own);
 if(row.align!==null&&Math.abs(row.align)>=alignMargin)signals.push(row.align>0);
 // Messenger draws the sender's picture beside their own messages only, never beside yours.
 // Its absence means nothing (it is hidden for consecutive messages), so only true is a signal.
 if(row.avatar)signals.push(false);
 if(!signals.length)throw new Error('A Facebook message could not be attributed to you or to the seller.');
 if(signals.some(signal=>signal!==signals[0]))throw new Error('Facebook message direction is ambiguous.');
 return signals[0]?'outgoing':'incoming';
}

function fingerprint(text:string){let hash=0x811c9dc5;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),0x01000193)>>>0;return `${text.length.toString(36)}${hash.toString(36)}`;}

/** Messenger publishes no per-message id, so identity is derived from direction, exact text and
 * the repeat index of identical texts. That is stable across reads of one thread, which is what
 * conversations:observe needs to re-verify history and to reconcile an uncertain send. */
export function classifyTranscript(rows:RawRow[]):ConversationMessage[]{
 const repeats=new Map<string,number>();const messages:ConversationMessage[]=[];
 for(const row of rows){
  const text=messageTextFrom(row.parts);
  if(!text)continue;
  const role=directionOf(row);
  const key=`${role}:${fingerprint(text)}`;
  const repeat=repeats.get(key)??0;repeats.set(key,repeat+1);
  messages.push(messageSchema.parse({sourceId:`fb:${key}:${repeat}`,role,text,ordinal:messages.length}));
 }
 return messages;
}

// Runs in the page. Walks up from the composer we resolved, because that element is the one
// thing we have positively identified, then reads the message list that belongs to it.
function measure(composer:Element,context:{itemPath:string;titleWords:string[]}):RawTranscript{
 const shown=(node:Element)=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0;};
 const labelOf=(node:Element)=>(node.getAttribute('aria-label')||'').trim();
 // "Messages" is the message list; "Conversations"/"Chats" is the thread switcher beside it.
 const tiers=[(node:Element)=>/^messages?$/i.test(labelOf(node)),(node:Element)=>/message/i.test(labelOf(node)),()=>true];
 const chooseList=(scope:Element)=>{
  const found=Array.from(scope.querySelectorAll('[role="grid"],[role="log"],[role="list"]')).filter(node=>!node.contains(composer)&&shown(node));
  if(!found.length)return {list:null,ambiguous:false,any:false};
  for(const tier of tiers){
   const pick=found.filter(tier);
   if(pick.length===1)return {list:pick[0],ambiguous:false,any:true};
   if(pick.length>1)return {list:null,ambiguous:true,any:true};
  }
  return {list:null,ambiguous:true,any:true};
 };
 let list:Element|null=null,ambiguous=false;
 for(let scope:Element|null=composer.parentElement;scope;scope=scope.parentElement){
  const outcome=chooseList(scope);
  if(outcome.any){list=outcome.list;ambiguous=outcome.ambiguous;break;}
  if(scope===document.body)break;
 }

 const rows:RawRow[]=[];
 if(list){
  const listRect=list.getBoundingClientRect();
  let nodes=Array.from(list.querySelectorAll('[role="row"]'));
  if(!nodes.length)nodes=Array.from(list.children);
  for(const node of nodes){
   const leaves=Array.from(node.querySelectorAll('[dir="auto"]')).filter(el=>!el.querySelector('[dir="auto"]')&&(el.textContent||'').trim());
   if(!leaves.length)continue;
   const parts=leaves.map(el=>el.textContent||'');
   const rects=leaves.map(el=>el.getBoundingClientRect()).filter(rect=>rect.width>0);
   const bubbleLeft=rects.length?Math.min(...rects.map(rect=>rect.left)):listRect.left;
   const bubbleRight=rects.length?Math.max(...rects.map(rect=>rect.right)):listRect.right;
   const align=rects.length&&listRect.width>0?((bubbleLeft-listRect.left)-(listRect.right-bubbleRight))/listRect.width:null;
   const avatar=Array.from(node.querySelectorAll('img,svg,image')).some(el=>{
    const rect=el.getBoundingClientRect();
    return rect.width>=16&&rect.width<=56&&Math.abs(rect.width-rect.height)<=6&&rect.right<=bubbleLeft+4;
   });
   const direction=node.closest('[data-direction]')?.getAttribute('data-direction')||'';
   const isOwn=node.closest('[data-is-own]')?.getAttribute('data-is-own')||'';
   const labels=[node.getAttribute('aria-label')||'',...Array.from(node.querySelectorAll('[aria-label]')).map(el=>el.getAttribute('aria-label')||'')].join(' | ');
   const ownLabel=/\byou sent\b|\bsent by you\b/i.test(labels)||parts.some(part=>/^you sent$/i.test(part.trim()));
   const own=direction==='outgoing'?true:direction==='incoming'?false:isOwn==='true'?true:isOwn==='false'?false:ownLabel?true:null;
   rows.push({parts,own,align,avatar});
  }
 }

 // The conversation must be provably about this listing, and what counts as proof depends on
 // where the composer lives. Inline on the validated item page, the URL we navigated to is the
 // proof. In a chat dialog it is not — the item page around it always names the listing — so
 // the dialog itself has to carry the item card. On a /messages/t/ thread the page must.
 const references=(scope:Element)=>{
  const links=Array.from(scope.querySelectorAll('a[href]')).map(anchor=>(anchor.getAttribute('href')||'').split('?')[0].replace(/\/+$/,''));
  const text=((scope as HTMLElement).innerText||'').toLowerCase();
  return links.some(href=>href.endsWith(context.itemPath))||(context.titleWords.length>0&&context.titleWords.every(word=>text.includes(word)));
 };
 const dialog=composer.closest('[role="dialog"]');
 const onItemPage=location.pathname.replace(/\/+$/,'').startsWith(context.itemPath);
 const matched=dialog?references(dialog):onItemPage||references(document.body);
 return {rows,hasList:Boolean(list),matched,ambiguous};
}

const olderNames=/load (?:older|previous)|see (?:earlier|older|previous)|show (?:older|previous)/i;

export async function openFacebookConversation(page:Page,listing:Listing):Promise<ConversationAdapter>{
 let box:Locator=await attachSellerComposer(page);
 const itemPath=new URL(listing.listingUrl).pathname.replace(/\/+$/,'');
 const titleWords=(listing.title.toLowerCase().match(/[a-z0-9]{3,}/g)??[]).slice(0,2);
 const conversationKey=`facebook:${listing.listingUrl.split('?')[0]}`;
 let reopened=false;

 async function snapshot(){
  let raw:RawTranscript;
  // Sending from the item page swaps the inline block for a chat surface, which detaches the
  // composer we were holding. Re-resolving it is cheaper and safer than a fresh navigation.
  try{raw=await box.evaluate(measure,{itemPath,titleWords});}
  catch{box=await attachSellerComposer(page);raw=await box.evaluate(measure,{itemPath,titleWords});}
  if(raw.ambiguous)throw new Error('Facebook showed more than one conversation. Open the listing conversation in Facebook, then resume.');
  if(!raw.matched)throw new Error('The Facebook conversation cannot be matched to this listing. Open the conversation manually and reconnect.');
  return raw;
 }
 async function loadOlder(){
  for(let i=0;i<5;i++){
   const older=page.getByRole('button',{name:olderNames});
   if(!await older.count())return;
   await older.first().click({timeout:3000}).catch(()=>{});
   await page.waitForTimeout(700);
  }
  if(await page.getByRole('button',{name:olderNames}).count())throw new Error('Full Facebook conversation history is not loaded.');
 }
 async function read():Promise<Transcript>{
  await loadOlder();
  return {conversationKey,messages:classifyTranscript((await snapshot()).rows)};
 }
 async function reopen(){
  if(reopened)return;
  reopened=true;
  await inspectListing(page,listing);
  await requireLoginCheck(page,'facebook');
  box=await attachSellerComposer(page);
 }

 return {read,send:async(text,beforeSend)=>{
  const before=await read();
  await fillComposer(page,box,text);
  if(!await beforeSend()){await clearComposer(page,box);return null;}
  // beforeSend re-reads the thread to recheck authorization, and a Marketplace re-render during
  // that read can empty the composer. Nothing goes out unless the box still holds exactly the
  // authorized text, so a partial or empty message can never reach the seller.
  if(await composerText(box)!==text)await fillComposer(page,box,text);
  await submitComposer(page,box);
  let lastError:unknown;
  for(let attempt=0;attempt<12;attempt++){
   await page.waitForTimeout(700);
   let after:Transcript|null=null;
   try{after=await read();}catch(error){lastError=error;/* the surface is still settling */}
   if(after){
    const added=after.messages.filter(message=>message.role==='outgoing'&&message.text===text&&!before.messages.some(old=>old.sourceId===message.sourceId));
    if(added.length===1)return {sourceId:added[0].sourceId};
    if(added.length>1)throw new Error('Delivery could not be verified: Facebook shows this message more than once.');
   }
   // A first contact is composed on the item page, which has no transcript of its own. Once,
   // late enough that the send has settled, re-open the listing's conversation to confirm it.
   if(attempt===7&&!after?.messages.length)await reopen().catch(()=>{});
  }
  // Surface why the transcript could not be read, so a changed Messenger layout is diagnosable
  // rather than indistinguishable from a message that simply never arrived.
  throw new Error(`Delivery could not be verified.${lastError instanceof Error?` ${lastError.message}`:''}`);
 }};
}
