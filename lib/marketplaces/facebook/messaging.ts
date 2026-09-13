import type { ElementHandle, Locator, Page } from 'playwright-core';
import type { Listing } from '@/lib/schemas';
import { inspectListing, requireLoginCheck } from '../shared';

// Marketplace ships the buyer composer in several shapes: an inline "Send seller a message"
// block on the item page, a Messenger dialog opened by the item's Message button, and a
// full-page /messages/t/ thread. Every shape is reached from the item page itself, so the
// listing association comes from navigation and never from matching an inbox row.
const openerNames=/^(?:message|message seller|send message|send seller a message|chat with seller|ask for details|contact seller)$/i;
const composerSelector='textarea, [contenteditable="true"][role="textbox"]';
const sendNames='^send(?: message)?$';

// Region tiers, most specific first: a Messenger dialog that was just opened outranks the item
// page's inline block. Two composers inside the same region mean an unrelated conversation is
// also on screen, which must never be typed into.
async function composerTiers(page:Page){
 const all=page.locator(composerSelector);const total=await all.count();
 const dialog:Locator[]=[],main:Locator[]=[],other:Locator[]=[];
 for(let i=0;i<total;i++){
  const box=all.nth(i);
  if(!await box.isVisible().catch(()=>false))continue;
  const region=await box.evaluate(el=>el.closest('[role="dialog"]')?'dialog':el.closest('[role="main"]')?'main':'other').catch(()=>'other');
  (region==='dialog'?dialog:region==='main'?main:other).push(box);
 }
 return [dialog,main,other].filter(tier=>tier.length);
}
async function resolveComposer(page:Page){
 const tiers=await composerTiers(page);
 if(!tiers.length)return null;
 if(tiers[0].length>1)throw new Error('Facebook has more than one message box open. Close the other conversation in Facebook, then resume.');
 return tiers[0][0];
}
async function waitForComposer(page:Page,timeout:number){
 const deadline=Date.now()+timeout;
 for(;;){
  const box=await resolveComposer(page);
  if(box)return box;
  if(Date.now()>=deadline)return null;
  await page.waitForTimeout(300);
 }
}

/** Resolves the seller composer on the page already loaded, opening it from the item's own
 * Message affordance when Marketplace has not rendered a composer yet. */
export async function attachSellerComposer(page:Page){
 const existing=await resolveComposer(page);
 if(existing)return existing;
 const openers=page.getByRole('button',{name:openerNames}).or(page.getByRole('link',{name:openerNames}));
 const total=await openers.count();
 for(let i=0;i<total;i++){
  const opener=openers.nth(i);
  if(!await opener.isVisible().catch(()=>false))continue;
  await opener.click({timeout:5000}).catch(()=>{});
  const box=await waitForComposer(page,8000);
  if(box)return box;
 }
 throw new Error('Facebook did not open a message box for this listing. Message the seller once in Facebook, then resume this negotiation.');
}
export async function openSellerConversation(page:Page,listing:Listing){
 await inspectListing(page,listing);
 await requireLoginCheck(page,'facebook');
 return attachSellerComposer(page);
}

export async function composerText(box:Locator){
 const raw=await box.evaluate(el=>el instanceof HTMLTextAreaElement||el instanceof HTMLInputElement?el.value:(el as HTMLElement).innerText??el.textContent??'');
 return raw.replace(/\u00a0/g,' ').replace(/\s+$/,'');
}
export async function clearComposer(page:Page,box:Locator){
 // Select-all inside an already empty editing host can extend past it and delete surrounding
 // page content, so there is nothing to do — and nothing worth risking — when it is empty.
 if(!await composerText(box))return;
 await box.click({timeout:5000}).catch(()=>{});
 await page.keyboard.press('ControlOrMeta+a').catch(()=>{});
 await page.keyboard.press('Delete').catch(()=>{});
 if(await composerText(box))await box.fill('').catch(()=>{});
}
// Messenger's composer is a rich-text editor: assigning its DOM text leaves the editor's own
// state empty, so Send would deliver an empty message. Only real input events register, which
// is why this types rather than fills, and reads the exact text back before anything goes out.
export async function fillComposer(page:Page,box:Locator,text:string){
 for(const method of ['insert','type'] as const){
  await clearComposer(page,box);
  await box.click({timeout:5000});
  if(method==='insert')await page.keyboard.insertText(text);
  else await box.pressSequentially(text,{delay:10,timeout:45000});
  if(await composerText(box)===text)return;
 }
 throw new Error('The Facebook message box did not accept the exact message text.');
}
// The Send control that belongs to our composer is the closest one in its ancestor chain;
// Marketplace also renders unrelated Send buttons (other chat tabs, share and report dialogs).
// Messenger's own composer has no Send button at all and submits on Enter instead.
export async function submitComposer(page:Page,box:Locator){
 const handle=await box.evaluateHandle((el,pattern)=>{
  const matcher=new RegExp(pattern,'i');
  const named=(node:Element)=>(node.getAttribute('aria-label')||node.textContent||'').trim();
  const shown=(node:Element)=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0;};
  for(let scope:Element|null=el.parentElement;scope;scope=scope.parentElement){
   const found=Array.from(scope.querySelectorAll('button,[role="button"]')).filter(node=>node.getAttribute('aria-disabled')!=='true'&&shown(node)&&matcher.test(named(node)));
   if(found.length)return found.length===1?found[0]:null;
   if(scope===document.body)break;
  }
  return null;
 },sendNames);
 // asElement() is typed as null for a nullable handle, so the concrete type is restored here.
 const control=handle.asElement() as unknown as ElementHandle<Element>|null;
 if(control){await control.click({timeout:5000});return;}
 await box.press('Enter',{timeout:5000});
}

export async function sendSellerMessage(page:Page,listing:Listing,message:string){
 const box=await openSellerConversation(page,listing);
 await fillComposer(page,box,message);
 await submitComposer(page,box);
 await page.getByText(message,{exact:true}).last().waitFor({timeout:15000});
}
