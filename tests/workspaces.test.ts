import assert from 'node:assert/strict';
import test from 'node:test';
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import schema from '../convex/schema';
import type { Listing, SearchState } from '../lib/schemas';

const modules = {
  '../convex/store.ts': () => import('../convex/store'),
  '../convex/work.ts': () => import('../convex/work'),
  '../convex/_generated/server.js': () => import('../convex/_generated/server'),
};
const save = makeFunctionReference<'mutation'>('store:save');
const history = makeFunctionReference<'query'>('store:history');
const watch = makeFunctionReference<'query'>('store:watch');
const enqueue = makeFunctionReference<'mutation'>('work:enqueue');
const claim = makeFunctionReference<'mutation'>('work:claim');
const checkpoint = makeFunctionReference<'mutation'>('work:checkpoint');
const state = (id: string, query = 'A desk'): SearchState => ({
  id, query, status: 'queued', demo: false, listings: [], events: [], runs: [],
});

test('durable discovery jobs join active work and reject stale workers after reclaim', async () => {
  const previous = process.env.CONVEX_SERVER_SECRET;
  process.env.CONVEX_SERVER_SECRET = 'workspace-test-secret';
  const credentials = { secret: 'workspace-test-secret', userId: 'alice' };
  try {
    const t = convexTest(schema, modules);
    await t.mutation(save, { ...credentials, state: state('workspace') });
    const input = { ...credentials, workspaceId: 'workspace', marketplace: 'ebay', kind: 'discovery' };
    const id = await t.mutation(enqueue, input);
    assert.equal(await t.mutation(enqueue, input), id);
    await assert.rejects(t.mutation(claim, { ...credentials, userId: 'bob', id }), /Unauthorized/);
    const claims = await Promise.all([t.mutation(claim, { ...credentials, id }), t.mutation(claim, { ...credentials, id })]);
    assert.equal(claims.filter(Boolean).length, 1);
    const first = claims.find(Boolean);
    assert.equal(first.generation, 1);
    assert.equal(await t.mutation(claim, { ...credentials, id }), null);
    await t.mutation(checkpoint, { ...credentials, id, generation: first.generation,
      status: 'queued', cursor: { queryIndex: 1, offset: 30, noProgressCount: 0 } });
    const second = await t.mutation(claim, { ...credentials, id });
    assert.equal(second.generation, 2);
    assert.equal(second.cursor.offset, 30);
    await assert.rejects(t.mutation(checkpoint, { ...credentials, id, generation: first.generation, status: 'complete' }), /Stale/);
    await t.mutation(checkpoint, { ...credentials, id, generation: second.generation, status: 'complete' });
    assert.equal(await t.mutation(claim, { ...credentials, id }), null);
    assert.equal(await t.mutation(enqueue, { ...input, resume: true }), id);
    const third = await t.mutation(claim, { ...credentials, id });
    await t.run(ctx => ctx.db.patch(id, { leaseExpiresAt: Date.now() - 1, nextRunAt: Date.now() - 1 }));
    await assert.rejects(t.mutation(checkpoint, { ...credentials, id, generation: third.generation, status: 'complete' }), /Stale/);
    const recovered = await t.mutation(claim, { ...credentials, id });
    assert.equal(recovered.generation, third.generation + 1);
    assert.equal(recovered.cursor.offset, 30);
    await assert.rejects(t.mutation(checkpoint, { ...credentials, id, generation: third.generation, status: 'complete' }), /Stale/);
    await t.mutation(checkpoint, { ...credentials, id, generation: recovered.generation, status: 'complete' });
  } finally {
    if (previous === undefined) delete process.env.CONVEX_SERVER_SECRET;
    else process.env.CONVEX_SERVER_SECRET = previous;
  }
});

test('workspace saves retain original query and pause state while persisting listing enrichment', async () => {
  const previous = process.env.CONVEX_SERVER_SECRET;
  process.env.CONVEX_SERVER_SECRET = 'workspace-test-secret';
  try {
    const t = convexTest(schema, modules);
    const listing: Listing = {
      id: 'desk', searchId: 'workspace', marketplace: 'ebay', title: 'Used desk',
      price: 50, currency: 'USD', imageUrls: [], listingUrl: 'https://www.ebay.com/itm/123',
      scrapedAt: 1, confidence: 0.8, similarityScore: 0.9, demo: false,
    };
    const original = { ...state('workspace', 'My original query'), listings: [listing] };
    await t.mutation(save, { secret: 'workspace-test-secret', userId: 'alice', state: original });
    const alice = t.withIdentity({ subject: 'alice' });
    const pause = makeFunctionReference<'mutation'>('store:setMonitoringPaused');
    await alice.mutation(pause, { id: 'workspace', paused: true });
    await assert.rejects(t.withIdentity({ subject: 'bob' }).mutation(pause, { id: 'workspace', paused: false }), /Unauthorized/);
    const updated = { ...original, query: 'Reinterpreted query', listings: [{ ...listing, description: 'Solid oak desk', shippingCost: 12 }] };
    await t.mutation(save, { secret: 'workspace-test-secret', userId: 'alice', state: updated });
    const summary = (await alice.query(history, { paginationOpts: { numItems: 10, cursor: null } })).page[0];
    assert.equal(summary.title, 'My original query');
    assert.equal(summary.originalQuery, 'My original query');
    assert.equal(summary.monitoringPaused, true);
    assert.equal(summary.listingCount, 1);
    const stored = await t.run(ctx => ctx.db.query('listings').collect());
    assert.equal(stored.length, 1);
    assert.equal(stored[0].data.description, 'Solid oak desk');
    assert.equal(stored[0].data.shippingCost, 12);
    await assert.rejects(t.mutation(save, { secret: 'workspace-test-secret', userId: 'alice', state: {
      ...original, listings: [{ ...listing, searchId: 'someone-elses-workspace' }],
    } }), /another workspace/);
    await t.mutation(save, { secret: 'workspace-test-secret', userId: 'alice', state: { ...state('image', 'Image search'), queryKind: 'image' } });
    const image = (await alice.query(history, { paginationOpts: { numItems: 10, cursor: null } })).page[0];
    assert.equal(image.title, 'Image search');
    assert.equal(image.originalQuery, '');
    assert.equal(image.queryKind, 'image');
  } finally {
    if (previous === undefined) delete process.env.CONVEX_SERVER_SECRET;
    else process.env.CONVEX_SERVER_SECRET = previous;
  }
});

test('History includes legacy searches, paginates newest first, and isolates owners', async () => {
  const previous = process.env.CONVEX_SERVER_SECRET;
  process.env.CONVEX_SERVER_SECRET = 'workspace-test-secret';
  try {
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
      await ctx.db.insert('searches', { key: 'legacy', userId: 'alice', state: state('legacy', 'Old query') });
    });
    await t.mutation(save, { secret: 'workspace-test-secret', userId: 'alice', state: state('new', 'Original query') });
    await t.mutation(save, { secret: 'workspace-test-secret', userId: 'bob', state: state('other') });
    const alice = t.withIdentity({ subject: 'alice' });
    const page = await alice.query(history, { paginationOpts: { numItems: 1, cursor: null } });
    assert.equal(page.page.length, 1);
    assert.equal(page.page[0].id, 'new');
    assert.equal(page.page[0].title, 'Original query');
    assert.equal(page.isDone, false);
    const older = await alice.query(history, { paginationOpts: { numItems: 1, cursor: page.continueCursor } });
    assert.equal(older.page[0].id, 'legacy');
    assert.equal(older.page[0].title, 'Old query');
    assert.equal(older.isDone, true);
    assert.equal(await alice.query(watch, { id: 'other' }), null);
    assert.equal(await t.query(watch, { id: 'new' }), null);
    await assert.rejects(t.query(history, { paginationOpts: { numItems: 10, cursor: null } }), /Unauthorized/);
    await assert.rejects(t.mutation(save, { secret: 'workspace-test-secret', userId: 'bob', state: state('new') }), /Unauthorized/);
    await assert.rejects(t.mutation(save, { secret: 'wrong', userId: 'alice', state: state('wrong') }), /Unauthorized/);
  } finally {
    if (previous === undefined) delete process.env.CONVEX_SERVER_SECRET;
    else process.env.CONVEX_SERVER_SECRET = previous;
  }
});
