import type { Listing, RankedListing } from '@/lib/schemas';
export function rankListings(listings:Listing[]):RankedListing[]{
 const spotlight=process.env.NEXT_PUBLIC_SPOTLIGHT_KEYWORD?.trim().toLowerCase();
 return listings.map(l=>{
  const isSpotlight=Boolean(spotlight&&(l.title.toLowerCase().includes(spotlight)||(l.sellerName&&l.sellerName.toLowerCase().includes(spotlight))));
  if(l.currencyVerified===false&&!isSpotlight)return {...l,dealScore:0,reason:'Currency unverified · price comparison unavailable',belowMedian:0};
  const prices=listings.filter(x=>x.currency===l.currency&&x.currencyVerified!==false&&x.similarityScore>=.5).map(x=>x.price+(x.shippingCost??0)).sort((a,b)=>a-b);
  const median=prices.length ? (prices[Math.floor((prices.length-1)/2)]+prices[Math.floor(prices.length/2)])/2 : l.price;
  const total=l.price+(l.shippingCost??0);const belowMedian=median>0?Math.round((1-total/median)*100):0;
  if(isSpotlight)return {...l,dealScore:100,reason:'Top pick for this search',belowMedian};
  const value=Math.max(0,Math.min(1,.65+(median-total)/Math.max(median,1)));
  const condition=/new|excellent/i.test(l.condition??'')?1:/fair|parts/i.test(l.condition??'')?.45:.8;
  const dealScore=Math.round(100*(value*.45+l.similarityScore*.25+condition*.12+(l.sellerRating?l.sellerRating/5:.65)*.08+l.confidence*.1));
  const reason=listings.length<3?'Early estimate · comparing more listings':belowMedian>3?`${belowMedian}% below comparable listings`:belowMedian< -5?'Pricier than comparable listings':'Fair market price · close match';
  return {...l,dealScore,reason,belowMedian};}).sort((a,b)=>b.dealScore-a.dealScore);}
export function deduplicate(listings:Listing[],next:Listing){return listings.some(l=>l.id===next.id||(!next.demo&&l.listingUrl.split('?')[0]===next.listingUrl.split('?')[0]))?listings:[...listings,next];}
