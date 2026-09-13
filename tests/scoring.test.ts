import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankListings,deduplicate } from '../lib/scoring';
import { demoIdentify,demoListings } from '../lib/demo/fixtures';
import { searchSchema,approvalSchema } from '../lib/schemas';
test('ranking uses total landed cost and bounded transparent scores',()=>{const input=searchSchema.parse({query:'Sony WH-1000XM5'});const listings=demoListings('test',input,demoIdentify(input.query));const ranked=rankListings(listings);assert.equal(ranked.length,listings.length);assert.ok(ranked.every(l=>l.dealScore>=0&&l.dealScore<=100));assert.ok(ranked[0].price<ranked.at(-1)!.price);const withShipping={...listings[0],shippingCost:200};assert.ok(rankListings([...listings.slice(1),withShipping]).find(l=>l.id===withShipping.id)!.dealScore<ranked.find(l=>l.id===withShipping.id)!.dealScore);});
test('deduplicates real results by stable URL and ID',()=>{const input=searchSchema.parse({query:'headphones'});const [fixture]=demoListings('test',input,demoIdentify(input.query));const l={...fixture,demo:false};assert.equal(deduplicate([l],{...l,id:'other',listingUrl:l.listingUrl+'?tracking=123'}).length,1);});
test('approval and search reject invalid requests',()=>{assert.equal(approvalSchema.safeParse({token:'fake',message:'hello',approved:false}).success,false);assert.equal(searchSchema.safeParse({query:''}).success,false);assert.equal(searchSchema.safeParse({query:'ok',image:'https://internal.local'}).success,false);});
