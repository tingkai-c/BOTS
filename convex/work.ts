import { v } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';
import { authorizeServer, ownedWorkspace } from './access';
import { marketplace, workCursor, workKind, workOutcome } from './validators';
import { z } from 'zod';

// Browser dispatch is wired in the discovery milestone. These jobs never send messages.
const credentials = { secret: v.string(), userId: v.string() };
const leaseMs = 240_000;
const cursorSchema = z.object({
  queryIndex: z.number().int().nonnegative().max(4),
  offset: z.number().int().nonnegative().max(100_000),
  noProgressCount: z.number().int().nonnegative().max(100),
});

export const enqueue = mutation({
  args: { ...credentials, workspaceId: v.string(), marketplace, kind: workKind,
    listingId: v.optional(v.string()), resume: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    authorizeServer(a.secret);
    await ownedWorkspace(ctx, a.userId, a.workspaceId);
    if (a.kind === 'inspection') {
      if (!a.listingId) throw new Error('Inspection requires a listing.');
      const listing = await ctx.db.query('listings').withIndex('by_key', q => q.eq('key', `${a.workspaceId}:${a.listingId}`)).unique();
      if (!listing || listing.searchId !== a.workspaceId || listing.data.marketplace !== a.marketplace) {
        throw new Error('Listing does not belong to this workspace and marketplace.');
      }
    } else if (a.listingId !== undefined) throw new Error('Discovery does not accept a listing.');
    const key = JSON.stringify([a.workspaceId, a.marketplace, a.kind, a.listingId ?? null]);
    const old = await ctx.db.query('workspaceJobs').withIndex('by_key', q => q.eq('key', key)).unique();
    if (old) {
      if (old.userId !== a.userId) throw new Error('Unauthorized');
      if (a.resume && old.status !== 'running' && old.status !== 'queued') {
        await ctx.db.patch(old._id, { status: 'queued', nextRunAt: Date.now(), updatedAt: Date.now(), message: undefined });
      }
      return old._id;
    }
    return ctx.db.insert('workspaceJobs', {
      key, workspaceId: a.workspaceId, userId: a.userId, marketplace: a.marketplace,
      kind: a.kind, ...(a.listingId ? { listingId: a.listingId } : {}),
      status: 'queued', generation: 0, nextRunAt: Date.now(), updatedAt: Date.now(),
    });
  },
});

export const claim = mutation({
  args: { ...credentials, id: v.id('workspaceJobs') },
  handler: async (ctx, a) => {
    authorizeServer(a.secret);
    const job = await ctx.db.get(a.id);
    if (!job || job.userId !== a.userId) throw new Error('Unauthorized');
    await ownedWorkspace(ctx, a.userId, job.workspaceId);
    const now = Date.now();
    const queued = job.status === 'queued' && job.nextRunAt <= now;
    const expired = job.status === 'running' && (job.leaseExpiresAt ?? 0) <= now;
    if (!queued && !expired) return null;
    const patch = { status: 'running' as const, generation: job.generation + 1, leaseExpiresAt: now + leaseMs, nextRunAt: now + leaseMs, updatedAt: now };
    await ctx.db.patch(job._id, patch);
    return { ...job, ...patch };
  },
});

export const checkpoint = mutation({
  args: { ...credentials, id: v.id('workspaceJobs'), generation: v.number(),
    status: workOutcome, cursor: v.optional(workCursor), message: v.optional(v.string()) },
  handler: async (ctx, a) => {
    authorizeServer(a.secret);
    const job = await ctx.db.get(a.id);
    if (!job || job.userId !== a.userId) throw new Error('Unauthorized');
    await ownedWorkspace(ctx, a.userId, job.workspaceId);
    if (job.status !== 'running' || job.generation !== a.generation || (job.leaseExpiresAt ?? 0) <= Date.now()) {
      throw new Error('Stale work claim.');
    }
    const cursor = a.cursor ? cursorSchema.parse(a.cursor) : job.cursor;
    if (a.message && a.message.length > 500) throw new Error('Work message is too long.');
    await ctx.db.patch(job._id, {
      status: a.status, cursor, message: a.message, leaseExpiresAt: undefined,
      nextRunAt: Date.now(), updatedAt: Date.now(),
    });
  },
});

export const forWorkspace = query({
  args: { workspaceId: v.string() },
  handler: async (ctx, a) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    await ownedWorkspace(ctx, user.subject, a.workspaceId);
    return ctx.db.query('workspaceJobs').withIndex('by_workspace', q => q.eq('workspaceId', a.workspaceId)).collect();
  },
});

export const due = internalQuery({
  args: {},
  handler: async ctx => {
    const now = Date.now();
    const queued = await ctx.db.query('workspaceJobs').withIndex('by_status_due', q => q.eq('status', 'queued').lte('nextRunAt', now)).take(25);
    const abandoned = await ctx.db.query('workspaceJobs').withIndex('by_status_due', q => q.eq('status', 'running').lte('nextRunAt', now)).take(25);
    return [...queued, ...abandoned].map(job => ({ id: job._id, userId: job.userId, workspaceId: job.workspaceId }));
  },
});
