'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePaginatedQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { summarizeWorkspace, type WorkspaceSummary } from '@/lib/schemas/workspace';
import { Button } from './ui/button';

function Rows({ rows }: { rows: WorkspaceSummary[] }) {
  return rows.length ? <ul className="history-list">{rows.map(row => <li key={row.id}><Link href={`/search/${row.id}`}><strong>{row.title}</strong><span>{row.queryKind === 'image' ? 'Image search · ' : ''}{new Date(row.createdAt).toLocaleDateString()} · {row.listingCount} listings · {row.status}</span></Link></li>)}</ul> : <div className="empty-state"><h2>No saved searches yet</h2><p>Start a search to create your first workspace.</p><Link href="/">Find something</Link></div>;
}
function LiveHistory() {
  const { results, status, loadMore } = usePaginatedQuery(api.store.history, {}, { initialNumItems: 20 });
  return <>{status === 'LoadingFirstPage' ? <p role="status">Loading saved searches…</p> : <Rows rows={results}/>} {status !== 'Exhausted' && status !== 'LoadingFirstPage' && <Button disabled={status === 'LoadingMore'} onClick={() => loadMore(20)}>{status === 'LoadingMore' ? 'Loading…' : 'Load more'}</Button>}</>;
}
function DemoHistory() {
  const [rows, setRows] = useState<WorkspaceSummary[] | null>(null);
  useEffect(() => { const values: WorkspaceSummary[] = []; for (const key of Object.keys(sessionStorage)) {
    if (!key.startsWith('scout:')) continue;
    try { const state = JSON.parse(sessionStorage.getItem(key)!); const time = state.events?.[0]?.time ?? 0; values.push(summarizeWorkspace(state.id, state, time)); } catch { /* Ignore damaged demo state. */ }
  } queueMicrotask(() => setRows(values.sort((a, b) => b.createdAt - a.createdAt))); }, []);
  return <><p className="field-hint">Demo history is stored in this browser tab. Listings and conversations are simulated.</p>{rows ? <Rows rows={rows}/> : <p role="status">Loading demo history…</p>}</>;
}
export function HistoryPage({ demo }: { demo: boolean }) { return <main className="workspace-page"><h1>History</h1><p>Pick up where you left off.</p>{demo ? <DemoHistory/> : <LiveHistory/>}</main>; }
