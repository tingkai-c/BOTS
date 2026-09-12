import 'server-only';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { listingSchema } from '@/lib/schemas';
const localSecret=randomBytes(32).toString('hex');
const key=()=>process.env.CONVEX_SERVER_SECRET||localSecret;
const payloadSchema=z.object({id:z.string(),user:z.string(),listing:listingSchema,desiredPrice:z.number(),maxPrice:z.number(),expires:z.number()});
export function signOffer(payload:z.infer<typeof payloadSchema>){const data=Buffer.from(JSON.stringify(payload)).toString('base64url');return `${data}.${createHmac('sha256',key()).update(data).digest('base64url')}`;}
export function verifyOffer(token:string,user:string){const [data,sig]=token.split('.');if(!data||!sig)throw new Error('Invalid approval. Draft the offer again.');const expected=createHmac('sha256',key()).update(data).digest();const actual=Buffer.from(sig,'base64url');if(actual.length!==expected.length||!timingSafeEqual(expected,actual))throw new Error('Invalid approval. Draft the offer again.');const payload=payloadSchema.parse(JSON.parse(Buffer.from(data,'base64url').toString()));if(payload.user!==user||payload.expires<Date.now())throw new Error('Offer expired. Create a new draft.');return payload;}
