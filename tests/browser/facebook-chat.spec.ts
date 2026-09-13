import { test, expect, type Page } from '@playwright/test';
import type { Page as BrowserPage } from 'playwright-core';
import { openFacebookConversation } from '../../lib/marketplaces/facebook/conversation';
import { inspectListing } from '../../lib/marketplaces/shared';
import type { Listing } from '../../lib/schemas';

// These fixtures reproduce the structure Marketplace actually renders — a role="button" labelled
// only "Message", a Messenger grid beside a conversation switcher, bubbles whose direction is
// carried by layout rather than by any data attribute — because every defect this covers was a
// selector/DOM assumption, not application logic. They are not proof of the live Facebook DOM.
const itemId='1234567890';
const itemUrl=`https://www.facebook.com/marketplace/item/${itemId}/`;
const title='TESTHACKATHON Apple Watch Series 7 - 44mm - Used';
const offer='Hi! Would you consider CAD 240.00 for the item?';
const avatar='data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

const listing:Listing={id:`facebook-${itemId}`,searchId:'workspace',marketplace:'facebook',title,price:300,currency:'CAD',currencyVerified:true,imageUrls:[],listingUrl:itemUrl,scrapedAt:1,confidence:.8,similarityScore:.9,demo:false};

const shell=(body:string)=>`<!doctype html><html><head><title>Marketplace</title><style>
body{margin:0;font:14px sans-serif}#thread{width:600px}
[role="row"]{display:flex;align-items:center;gap:6px;padding:4px 0}
.bubble{max-width:70%;padding:6px 10px;border-radius:14px;background:#eee}
.avatar{width:32px;height:32px;border-radius:50%}
.composer{display:block;width:400px;min-height:22px;border:1px solid #ccc}
</style></head><body>${body}</body></html>`;

const messageRow=(text:string,mine:boolean)=>mine
 ? `<div role="row" style="justify-content:flex-end"><div dir="auto" class="bubble">${text}</div></div>`
 : `<div role="row" style="justify-content:flex-start"><img class="avatar" src="${avatar}"><div dir="auto" class="bubble">${text}</div></div>`;

const threadSurface=(linkId:string,heading:string,history:string)=>`
 <div role="dialog" aria-label="Chat">
  <div><a href="/marketplace/item/${linkId}/">${heading}</a><span>CA$300</span></div>
  <div style="display:flex">
   <div role="grid" aria-label="Conversations"><div role="row"><div dir="auto">Other buyer</div></div></div>
   <div>
    <div role="grid" aria-label="Messages" id="thread">${history}</div>
    <div id="composerRow">
     <div class="composer" contenteditable="true" role="textbox" aria-label="Message"></div>
     <div role="button" aria-label="Send">Send</div>
    </div>
   </div>
  </div>
 </div>`;

// Appends whatever the composer really contains, so a message that never reached the editor's
// own state — the failure mode of filling a rich-text composer by assignment — stays invisible.
const sendScript=`<script>
 document.addEventListener('click',event=>{
  const send=event.target.closest('[role="button"][aria-label="Send"], button[data-send]');
  if(!send)return;
  const row=send.closest('#composerRow');
  const box=row.querySelector('.composer');
  const text=(box.tagName==='TEXTAREA'?box.value:box.innerText).trim();
  if(!text)return;
  const list=document.getElementById('thread')||(()=>{
   const created=document.createElement('div');
   created.setAttribute('role','grid');created.setAttribute('aria-label','Messages');created.id='thread';
   row.parentElement.insertBefore(created,row);
   return created;
  })();
  const bubble=document.createElement('div');
  bubble.setAttribute('role','row');bubble.style.justifyContent='flex-end';
  bubble.innerHTML='<div dir="auto" class="bubble"></div><div dir="auto">Sent</div>';
  bubble.firstChild.textContent=text;
  list.appendChild(bubble);
  if(box.tagName==='TEXTAREA')box.value='';else box.innerHTML='';
 });
</script>`;

async function serve(page:Page,body:string){
 await page.route('https://www.facebook.com/**',route=>route.fulfill({contentType:'text/html',body:shell(body+sendScript)}));
 await page.goto(itemUrl);
}
const adapter=(page:Page)=>openFacebookConversation(page as unknown as BrowserPage,listing);

// The reported failure: a brand-new negotiation on a listing that has never been messaged.
test('first contact on the item page reads an empty transcript and confirms the opening offer',async({page})=>{
 await serve(page,`
  <div role="main">
   <h1>${title}</h1><span>CA$300</span>
   <div id="composerRow">
    <textarea class="composer" aria-label="Message">Hi, is this still available?</textarea>
    <div role="button" aria-label="Send">Send</div>
   </div>
  </div>
  <div role="dialog" aria-label="Share this listing"><div role="button" aria-label="Send">Send</div></div>`);

 const conversation=await adapter(page);
 expect((await conversation.read()).messages).toEqual([]);

 let authorized=0;
 const sent=await conversation.send(offer,async()=>{authorized++;return true;});
 expect(authorized).toBe(1);
 expect(sent?.sourceId).toBeTruthy();

 // Marketplace pre-fills the box; only the authorized text may survive.
 const transcript=await conversation.read();
 expect(transcript.messages.map(m=>({role:m.role,text:m.text}))).toEqual([{role:'outgoing',text:offer}]);
 expect(transcript.conversationKey).toBe(`facebook:${itemUrl}`);
 expect(transcript.messages[0].sourceId).toBe(sent?.sourceId);
 await expect(page.locator('#thread')).not.toContainText('is this still available');
});

test('an existing Messenger thread is read with verified directions and appended to',async({page})=>{
 await serve(page,`
  <div role="main"><h1>${title}</h1><div role="button" tabindex="0">Message</div></div>
  <div id="chat" hidden>${threadSurface(itemId,title,messageRow(offer,true)+messageRow('Could you do CA$260?',false))}</div>
  <script>document.addEventListener('click',e=>{if(e.target.textContent==='Message')document.getElementById('chat').hidden=false;});</script>`);

 const conversation=await adapter(page);
 const before=await conversation.read();
 expect(before.messages.map(m=>({role:m.role,text:m.text}))).toEqual([
  {role:'outgoing',text:offer},
  {role:'incoming',text:'Could you do CA$260?'},
 ]);

 const counter='Hi! Would you consider CAD 255.00 for the item?';
 const sent=await conversation.send(counter,async()=>true);
 const after=await conversation.read();
 expect(after.messages.map(m=>m.text)).toEqual([offer,'Could you do CA$260?',counter]);
 expect(after.messages[2].sourceId).toBe(sent?.sourceId);
 // Identity must survive a re-read so conversations:observe can re-verify known history.
 expect(after.messages.slice(0,2).map(m=>m.sourceId)).toEqual(before.messages.map(m=>m.sourceId));
});

test('a chat open for a different listing is refused instead of negotiated in',async({page})=>{
 await serve(page,`
  <div role="main"><h1>${title}</h1></div>
  ${threadSurface('999888777','Cannondale road bike 54cm',messageRow('Is the bike still for sale?',true))}`);

 await expect(adapter(page).then(conversation=>conversation.read())).rejects.toThrow(/cannot be matched to this listing/);
});

test('withheld authorization sends nothing and leaves no draft behind',async({page})=>{
 await serve(page,`
  <div role="main"><h1>${title}</h1></div>
  ${threadSurface(itemId,title,messageRow('Still available?',true))}`);

 const conversation=await adapter(page);
 expect(await conversation.send(offer,async()=>false)).toBeNull();
 expect((await conversation.read()).messages.map(m=>m.text)).toEqual(['Still available?']);
 await expect(page.locator('.composer')).toHaveText('');
});

// Marketplace's only buyer action is a div with a button role reading "Message". Availability
// and currency are checked before any chat is opened, so misreading either one stopped every
// Facebook negotiation on its first check, before the conversation code was ever reached.
const itemPage=(extra:string,body:string)=>`<!doctype html><html><head><title>Marketplace</title>
 <meta property="og:title" content="${title}">
 <meta property="og:description" content="Used. Listed in Waterloo, ON">${extra}</head>
 <body><div role="main"><h1>${title}</h1>${body}
  <div role="button" tabindex="0">Message</div><div role="button" tabindex="0">Save</div>
 </div></body></html>`;

test('a Marketplace item page reads as available, in its own currency, and marked verified',async({page})=>{
 await page.route('https://www.facebook.com/**',route=>route.fulfill({contentType:'text/html',
  body:itemPage('<script type="application/json">{"listing_price":{"amount":"300","currency":"CAD","formatted_amount":"CA$300"}}</script>','<span>CA$300</span>')}));
 const inspected=await inspectListing(page as unknown as BrowserPage,{...listing,currencyVerified:undefined,availability:'unknown'});
 expect(inspected.availability).toBe('available');
 expect(inspected.price).toBe(300);
 expect(inspected.currency).toBe('CAD');
 expect(inspected.currencyVerified).toBe(true);
});

test('an item page with no currency evidence stays unverified instead of claiming USD',async({page})=>{
 await page.route('https://www.facebook.com/**',route=>route.fulfill({contentType:'text/html',body:itemPage('','<span>$300</span>')}));
 const inspected=await inspectListing(page as unknown as BrowserPage,{...listing,currency:'USD',currencyVerified:false});
 expect(inspected.availability).toBe('available');
 expect(inspected.currencyVerified).toBe(false);
});
