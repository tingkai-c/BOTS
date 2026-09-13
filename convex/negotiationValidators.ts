import { v } from 'convex/values';
export const settingsValidator = v.object({ openingOffer:v.number(),maximum:v.number(),currency:v.union(v.literal('USD'),v.literal('CAD')),costBasis:v.union(v.literal('pickup'),v.literal('shipped')),tone:v.union(v.literal('Friendly'),v.literal('Direct'),v.literal('Flexible')),instructions:v.string(),expiresAt:v.number() });
export const threadStatus = v.union(...['active','paused','needs_attention','expired','stopped','agreed','uncertain'].map(s => v.literal(s)));
export const messageValidator = v.object({sourceId:v.string(),role:v.union(v.literal('incoming'),v.literal('outgoing')),text:v.string(),ordinal:v.number()});
