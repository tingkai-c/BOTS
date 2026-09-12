import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
export default defineSchema({
 users:defineTable({userId:v.string()}).index('by_user',['userId']),
 searches:defineTable({key:v.string(),userId:v.string(),state:v.any()}).index('by_key',['key']),
 listings:defineTable({key:v.string(),searchId:v.string(),data:v.any()}).index('by_key',['key']).index('by_search',['searchId']),
 agentRuns:defineTable({key:v.string(),searchId:v.string(),data:v.any()}).index('by_key',['key']),
 agentEvents:defineTable({searchId:v.string(),data:v.any()}).index('by_search',['searchId']),
 negotiations:defineTable({key:v.string(),userId:v.string(),data:v.any()}).index('by_key',['key']),
 marketplaceConnections:defineTable({userId:v.string(),marketplace:v.string(),profileId:v.string(),sessionId:v.optional(v.string())}).index('by_user_market',['userId','marketplace'])
});
