// Facebook Marketplace infers "local" results from the browser's geolocation/IP rather than
// a URL parameter (unlike eBay's _stpos or Kijiji's address). Without setting it explicitly, a
// Steel session's proxy IP can put the browser far from the location the user asked for, so
// Marketplace silently returns nothing nearby. This is a small, bounded lookup for the cities
// this app is actually used in — not a general geocoder.
const cities:Record<string,{latitude:number;longitude:number}>={
 'san francisco':{latitude:37.7749,longitude:-122.4194},
 'new york':{latitude:40.7128,longitude:-74.006},
 'los angeles':{latitude:34.0522,longitude:-118.2437},
 'chicago':{latitude:41.8781,longitude:-87.6298},
 'seattle':{latitude:47.6062,longitude:-122.3321},
 'boston':{latitude:42.3601,longitude:-71.0589},
 'austin':{latitude:30.2672,longitude:-97.7431},
 'miami':{latitude:25.7617,longitude:-80.1918},
 'toronto':{latitude:43.6532,longitude:-79.3832},
 'vancouver':{latitude:49.2827,longitude:-123.1207},
 'montreal':{latitude:45.5019,longitude:-73.5674},
 'calgary':{latitude:51.0447,longitude:-114.0719},
};
export function cityCoordinates(location:string):{latitude:number;longitude:number}|null{
 return cities[location.trim().toLowerCase()]??null;
}
