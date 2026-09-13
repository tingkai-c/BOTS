import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { marketplace, workKind, workOutcome, workCursor, workspaceMetadata } from './validators';
import { settingsValidator, threadStatus } from './negotiationValidators';
export default defineSchema({
 users:defineTable({userId:v.string()}).index('by_user',['userId']),
 searches:defineTable({key:v.string(),userId:v.string(),state:v.any(),workspace:v.optional(workspaceMetadata),reservedNegotiation:v.optional(v.string())}).index('by_key',['key']).index('by_user',['userId']),
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
 threads:defineTable({key:v.string(),userId:v.string(),workspaceId:v.string(),listingId:v.string(),listingUrl:v.string(),marketplace,profileId:v.string(),settings:settingsValidator,signature:v.string(),version:v.number(),revision:v.number(),handledRevision:v.number(),status:threadStatus,reason:v.optional(v.string()),conversationKey:v.optional(v.string()),currentOffer:v.optional(v.number()),lastCheckedAt:v.optional(v.number()),createdAt:v.number()}).index('by_key',['key']).index('by_workspace',['workspaceId']).index('by_user_listing',['userId','listingUrl']).index('by_account',['userId','marketplace','profileId']),
 conversationMessages:defineTable({threadId:v.string(),sourceId:v.string(),role:v.union(v.literal('incoming'),v.literal('outgoing')),text:v.string(),ordinal:v.number(),observedAt:v.number()}).index('by_thread',['threadId']).index('by_source',['threadId','sourceId']),
 sendAttempts:defineTable({threadId:v.string(),version:v.number(),revision:v.number(),text:v.string(),action:v.string(),amount:v.optional(v.number()),status:v.union(v.literal('prepared'),v.literal('claimed'),v.literal('confirmed'),v.literal('uncertain'),v.literal('cancelled')),createdAt:v.number(),claimedAt:v.optional(v.number()),sourceId:v.optional(v.string())}).index('by_thread',['threadId']),
 accountMonitoring:defineTable({userId:v.string(),marketplace,profileId:v.string(),nextDueAt:v.number(),generation:v.number(),leaseExpiresAt:v.optional(v.number()),lastCheckedAt:v.optional(v.number()),cursor:v.optional(v.string()),debugUrl:v.optional(v.string())}).index('by_account',['userId','marketplace','profileId']).index('by_due',['nextDueAt']),
 marketplaceConnections:defineTable({userId:v.string(),marketplace:v.string(),profileId:v.string(),sessionId:v.optional(v.string())}).index('by_user_market',['userId','marketplace'])
});
