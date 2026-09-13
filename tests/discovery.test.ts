import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCard } from '../lib/marketplaces/cards';
import { rankListings } from '../lib/scoring';
const card={text:'',title:'Used oak desk',price:'US $100.00',url:'https://www.ebay.com/itm/123',image:'',shipping:'',condition:''};
test('missing shipping stays unknown; CAD is not mislabeled and contact prices are skipped',()=>{
 const ebay=parseCard(card,'ebay','s','oak desk');assert(ebay);assert.equal(ebay.shippingCost,undefined);assert.equal(ebay.currency,'USD');
 const kijiji=parseCard({...card,price:'$90',url:'https://www.kijiji.ca/v-desks/city/123'},'kijiji','s','oak desk');assert(kijiji);assert.equal(kijiji.currency,'CAD');
 assert.equal(parseCard({...card,price:'Please Contact'},'kijiji','s','desk'),null);
 const rows=rankListings([ebay,kijiji]);assert(rows.every(l=>l.belowMedian===0));
});
test('partner labels are not product titles and unsupported navigation is discarded',()=>{
 const listing=parseCard({...card,title:'',price:'',text:'Partner listing\nUS $100\nUsed oak desk\nOakland',url:'https://www.facebook.com/marketplace/item/123'},'facebook','s','desk');assert.equal(listing?.title,'Used oak desk');
 assert.equal(parseCard({...card,url:'https://evil.example/itm/123'},'ebay','s','desk'),null);
});
