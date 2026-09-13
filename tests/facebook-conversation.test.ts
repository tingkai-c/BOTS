import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTranscript, directionOf, messageTextFrom, type RawRow } from '../lib/marketplaces/facebook/conversation';

// Geometry as Messenger renders it: own bubbles hug the right edge, seller bubbles the left.
const own=(text:string,extra:Partial<RawRow>={}):RawRow=>({parts:[text],own:null,align:.22,avatar:false,...extra});
const seller=(text:string,extra:Partial<RawRow>={}):RawRow=>({parts:[text],own:null,align:-.22,avatar:true,...extra});

test('message text drops timestamps, receipts and day separators without touching seller wording',()=>{
 assert.equal(messageTextFrom(['Could you do CA$160?','2:15 PM','Sent']),'Could you do CA$160?');
 assert.equal(messageTextFrom(['Hi! Would you consider CAD 240.00 for the item?','You sent','Seen']),'Hi! Would you consider CAD 240.00 for the item?');
 assert.equal(messageTextFrom(['Today']),'');
 assert.equal(messageTextFrom(['Wed 9:41 AM','Sep 12, 2026 at 9:41 AM','Yesterday','Just now']),'');
 // Whitespace is collapsed so an exact-text comparison against our own outgoing message holds,
 // while line breaks inside a seller message are preserved.
 assert.equal(messageTextFrom(['  Is  this still available? ']),'Is this still available?');
 assert.equal(messageTextFrom(['First line\nSecond line']),'First line\nSecond line');
 assert.equal(messageTextFrom(['9']),'9','a one-character message is not metadata');
});

test('direction is verified from agreeing signals and fails closed otherwise',()=>{
 assert.equal(directionOf(own('mine')),'outgoing');
 assert.equal(directionOf(seller('theirs')),'incoming');
 assert.equal(directionOf({parts:['x'],own:true,align:null,avatar:false}),'outgoing');
 assert.equal(directionOf({parts:['x'],own:false,align:null,avatar:false}),'incoming');
 // A missing avatar is not evidence of an own message: Messenger hides it on consecutive ones.
 assert.equal(directionOf({parts:['x'],own:null,align:-.3,avatar:false}),'incoming');
 // Nothing to go on, a near-centred bubble, and contradicting signals all stop the check.
 assert.throws(()=>directionOf({parts:['x'],own:null,align:null,avatar:false}),/attributed/);
 assert.throws(()=>directionOf({parts:['x'],own:null,align:.01,avatar:false}),/attributed/);
 assert.throws(()=>directionOf({parts:['x'],own:true,align:-.3,avatar:false}),/ambiguous/);
 assert.throws(()=>directionOf({parts:['x'],own:null,align:.3,avatar:true}),/ambiguous/);
});

test('synthetic message identity is stable across reads and unique for repeated text',()=>{
 const offer='Hi! Would you consider CAD 240.00 for the item?';
 const first=classifyTranscript([own(offer),seller('Could you do CA$260?'),own(offer)]);
 assert.deepEqual(first.map(m=>m.role),['outgoing','incoming','outgoing']);
 assert.deepEqual(first.map(m=>m.ordinal),[0,1,2]);
 assert.equal(new Set(first.map(m=>m.sourceId)).size,3,'a repeated message still gets its own identity');
 // conversations:observe re-verifies known sourceIds on every check, so a second read of the
 // same thread — including one that appends a reply — must not renumber earlier messages.
 const second=classifyTranscript([own(offer),seller('Could you do CA$260?'),own(offer),seller('Deal.')]);
 assert.deepEqual(second.slice(0,3).map(m=>m.sourceId),first.map(m=>m.sourceId));
 assert.equal(second[3].role,'incoming');
 // Geometry and markup vary between Messenger surfaces; identity must not depend on either.
 const relaid=classifyTranscript([{parts:[offer,'2:15 PM'],own:true,align:.61,avatar:false}]);
 assert.equal(relaid[0].sourceId,first[0].sourceId);
});

test('rows that carry no message text are skipped rather than classified',()=>{
 const messages=classifyTranscript([
  {parts:['Today'],own:null,align:null,avatar:false},
  seller('Still available'),
  {parts:['Seen','2:15 PM'],own:null,align:null,avatar:false},
 ]);
 assert.deepEqual(messages.map(m=>m.text),['Still available']);
 assert.deepEqual(messages.map(m=>m.ordinal),[0]);
});
