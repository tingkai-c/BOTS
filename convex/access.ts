import type { QueryCtx } from './_generated/server';

export function authorizeServer(secret: string) {
  if (!process.env.CONVEX_SERVER_SECRET || secret !== process.env.CONVEX_SERVER_SECRET) {
    throw new Error('Unauthorized');
  }
}

export async function ownedWorkspace(ctx: Pick<QueryCtx, 'db'>, userId: string, key: string) {
  const row = await ctx.db.query('searches').withIndex('by_key', q => q.eq('key', key)).unique();
  if (!row || row.userId !== userId) throw new Error('Unauthorized');
  return row;
}
