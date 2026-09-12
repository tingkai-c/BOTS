import { identify } from '@/lib/ai/identify';
import { searchSchema } from '@/lib/schemas';
import { apiError,userId } from '@/lib/server/context';
export async function POST(req:Request){try{await userId();return Response.json({identification:await identify(searchSchema.parse(await req.json())),demo:!process.env.OPENAI_API_KEY});}catch(e){return apiError(e);}}
