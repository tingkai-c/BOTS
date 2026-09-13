import type { Locator, Page } from 'playwright-core';
import type { Listing } from '@/lib/schemas';
import { messageSchema, type ConversationMessage } from '@/lib/negotiation/contracts';
import { openSellerConversation as facebook } from './facebook/messaging';
import { openSellerConversation as ebay } from './ebay/messaging';
import { openSellerConversation as kijiji } from './kijiji/messaging';
import { validateListingUrl } from './shared';

export type Transcript={conversationKey:string;messages:ConversationMessage[]};
export interface ConversationAdapter {read():Promise<Transcript>;send(text:string,beforeSend:()=>Promise<boolean>):Promise<{sourceId:string}|null>}

/** Only verified transcript identities/directions are accepted. Unknown DOM layouts
 * stop as needs-attention, never fall back to guessing or scanning a whole inbox. */
export async function openConversation(page:Page,listing:Listing):Promise<ConversationAdapter>{
 validateListingUrl(listing.listingUrl,listing.marketplace);
 const box=await ({facebook,ebay,kijiji}[listing.marketplace])(page,listing);
 const scopes=page.locator('[data-conversation-id], [data-thread-id], [role="log"]');
 const candidates=await scopes.count();let root:Locator|undefined;
 for(let i=0;i<candidates;i++){const scope=scopes.nth(i);const sourceId=new URL(listing.listingUrl).pathname.split('/').filter(Boolean).pop();if(await scope.getAttribute('data-listing-id')===sourceId||await scope.locator('a').evaluateAll((links,url)=>links.some(a=>(a as HTMLAnchorElement).href.split('?')[0]===url.split('?')[0]),listing.listingUrl)){if(root)throw new Error('Conversation identity is ambiguous.');root=scope;}}
 if(!root)throw new Error('The marketplace conversation cannot be matched to this listing. Open the conversation manually and reconnect.');
 const transcript=root;
 for(let i=0;i<3;i++){const older=transcript.getByRole('button',{name:/load (?:older|previous)|see earlier/i});if(!await older.count())break;await older.first().click({timeout:3000});}
 if(await transcript.getByRole('button',{name:/load (?:older|previous)|see earlier/i}).count())throw new Error('Full conversation history is not loaded.');
 const read=async():Promise<Transcript>=>{
  const raw=await transcript.locator('[data-message-id]').evaluateAll(nodes=>nodes.map((node,ordinal)=>({sourceId:node.getAttribute('data-message-id')||'',role:node.getAttribute('data-direction')|| (node.getAttribute('data-is-own')==='true'?'outgoing':node.getAttribute('data-is-own')==='false'?'incoming':''),text:(node.querySelector('[data-message-text]') as HTMLElement|null)?.innerText||(node as HTMLElement).innerText,ordinal})));
  if(!raw.length&&await transcript.getAttribute('data-message-count')!=='0'&&!await transcript.getByText(/no messages yet|start a conversation/i).count())throw new Error('Message history could not be verified.');
  return {conversationKey:`${listing.marketplace}:${listing.listingUrl.split('?')[0]}`,messages:raw.map(value=>messageSchema.parse(value))};
 };
 return {read,send:async(text,beforeSend)=>{
  const before=await read();await box.fill(text);
  const send=page.getByRole('button',{name:/^Send(?: message)?$/i}).filter({visible:true});if(await send.count()!==1)throw new Error('The Send control is ambiguous.');
  if(!await beforeSend()){await box.fill('');return null;}
  await send.click({timeout:5000});
  for(let i=0;i<8;i++){await page.waitForTimeout(500);const after=await read();const added=after.messages.filter(m=>m.role==='outgoing'&&m.text===text&&!before.messages.some(old=>old.sourceId===m.sourceId));if(added.length===1)return {sourceId:added[0].sourceId};}
  throw new Error('Delivery could not be verified.');
 }};
}
