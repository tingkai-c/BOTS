import { v } from 'convex/values';

export const marketplace = v.union(v.literal('facebook'), v.literal('ebay'), v.literal('kijiji'));
export const workKind = v.union(v.literal('discovery'), v.literal('inspection'));
export const workOutcome = v.union(v.literal('queued'), v.literal('complete'), v.literal('failed'), v.literal('needs_sign_in'));
export const workCursor = v.object({ queryIndex: v.number(), offset: v.number(), noProgressCount: v.number() });
export const workspaceMetadata = v.object({
  id: v.string(), title: v.string(), originalQuery: v.string(),
  queryKind: v.union(v.literal('text'), v.literal('image'), v.literal('unknown')),
  createdAt: v.number(), updatedAt: v.number(),
  status: v.union(v.literal('queued'), v.literal('searching'), v.literal('ranking'), v.literal('complete'), v.literal('failed')),
  listingCount: v.number(), monitoringPaused: v.boolean(),
});
