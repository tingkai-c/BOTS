import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { marketplace, workKind, workOutcome, workCursor, workspaceMetadata } from './validators';
export default defineSchema({
 users:defineTable({userId:v.string()}).index('by_user',['userId']),
 searches:defineTable({key:v.string(),userId:v.string(),state:v.any(),workspace:v.optional(workspaceMetadata)}).index('by_key',['key']).index('by_user',['userId']),
 listings:defineTable({key:v.string(),searchId:v.string(),data:v.any()}).index('by_key',['key']).index('by_search',['searchId']),
 agentRuns:defineTable({key:v.string(),searchId:v.string(),data:v.any()}).index('by_key',['key']),
 agentEvents:defineTable({searchId:v.string(),data:v.any()}).index('by_search',['searchId']),
 workspaceJobs:defineTable({
  key:v.string(),workspaceId:v.string(),userId:v.string(),marketplace,kind:workKind,
  listingId:v.optional(v.string()),status:v.union(v.literal('running'),workOutcome),
  generation:v.number(),leaseExpiresAt:v.optional(v.number()),nextRunAt:v.number(),
  updatedAt:v.number(),cursor:v.optional(workCursor),message:v.optional(v.string()),
 }).index('by_key',['key']).index('by_workspace',['workspaceId']).index('by_status_due',['status','nextRunAt']),
 negotiations:defineTable({key:v.string(),userId:v.string(),data:v.any()}).index('by_key',['key']),
 marketplaceConnections:defineTable({userId:v.string(),marketplace:v.string(),profileId:v.string(),sessionId:v.optional(v.string())}).index('by_user_market',['userId','marketplace'])
});
