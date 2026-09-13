import { z } from 'zod';
import { identificationSchema, listingSchema, marketplaceSchema } from './index';

export const searchStatusSchema = z.enum(['queued', 'searching', 'ranking', 'complete', 'failed']);
export const searchStateSchema = z.object({
  id: z.string().min(1).max(200),
  query: z.string().max(300),
  queryKind: z.enum(['text', 'image']).optional(),
  status: searchStatusSchema,
  demo: z.boolean(),
  listings: z.array(listingSchema),
  events: z.array(z.object({
    id: z.string(), message: z.string(), marketplace: marketplaceSchema.optional(),
    time: z.number().finite(), kind: z.enum(['action', 'success', 'error']),
  })),
  runs: z.array(z.object({
    marketplace: marketplaceSchema,
    status: z.enum(['queued', 'searching', 'complete', 'failed', 'login_required']),
    debugUrl: z.string().optional(), sessionId: z.string().optional(), message: z.string(),
  })),
  identification: identificationSchema.optional(),
  summary: z.string().optional(),
  filters: z.object({
    maxPrice: z.number().positive().optional(),
    condition: z.enum(['any', 'Like new', 'Good', 'Fair']),
    marketplace: z.enum(['all', 'facebook', 'ebay', 'kijiji']),
    location: z.string(), radius: z.number().positive(),
  }).optional(),
}).superRefine((state, ctx) => {
  for (const listing of state.listings) {
    if (listing.searchId !== state.id) ctx.addIssue({ code: 'custom', message: 'Listing belongs to another workspace.' });
  }
  if (new Set(state.listings.map(listing => listing.id)).size !== state.listings.length) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate listing identity.' });
  }
  if (new Set(state.runs.map(run => run.marketplace)).size !== state.runs.length) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate marketplace run.' });
  }
});

export type WorkspaceSummary = {
  id: string;
  title: string;
  originalQuery: string;
  queryKind: 'text' | 'image' | 'unknown';
  createdAt: number;
  updatedAt: number;
  status: z.infer<typeof searchStatusSchema>;
  listingCount: number;
  monitoringPaused: boolean;
};

// Legacy state stays readable even when an older payload lacks newer fields.
export function summarizeWorkspace(id: string, value: unknown, createdAt: number): WorkspaceSummary {
  const legacy = z.object({
    query: z.string().catch(''), queryKind: z.enum(['text', 'image']).optional().catch(undefined),
    status: searchStatusSchema.catch('failed'), listings: z.array(z.unknown()).catch([]),
  }).safeParse(value);
  const state = legacy.success ? legacy.data : undefined;
  const image = state?.queryKind === 'image';
  const originalQuery = image ? '' : state?.query ?? '';
  return {
    id, originalQuery, title: image ? 'Image search' : originalQuery || 'Untitled saved search',
    queryKind: image ? 'image' : originalQuery ? 'text' : 'unknown',
    createdAt, updatedAt: createdAt, status: state?.status ?? 'failed',
    listingCount: state?.listings.length ?? 0, monitoringPaused: false,
  };
}
