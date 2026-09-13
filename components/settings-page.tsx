'use client';
import { useEffect, useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Marketplace } from '@/lib/schemas';
import { readJsonResponse } from '@/lib/client-stream';
import { BrowserView } from './agent-panel';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';

function AccountSettings() {
  const clerk = useClerk(); const { user } = useUser();
  return <section><h2>Your account</h2><p>{user?.fullName}<br/>{user?.primaryEmailAddress?.emailAddress}</p><Button variant="outline" onClick={() => clerk.openUserProfile()}>Manage profile and security</Button><Button variant="ghost" onClick={() => clerk.signOut({ redirectUrl: '/' })}>Sign out</Button></section>;
}
function NotificationSettings() {
  const me = useQuery(api.users.me, {});
  const setPhone = useMutation(api.users.setPhone);
  const [phone, setPhoneInput] = useState(me?.phone ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  async function save() {
    setStatus('saving'); setError('');
    try { await setPhone({ phone }); setStatus('saved'); } catch (e) { setStatus('error'); setError((e as Error).message); }
  }
  return <section><h2>Text message alerts</h2><p>Get a text the moment a seller agrees on a price during an autonomous negotiation.</p><div className="notification-fields"><label>Phone number<input type="tel" placeholder="+14155551234" defaultValue={me?.phone ?? ''} key={me?.phone ?? 'unset'} onChange={e => setPhoneInput(e.target.value)} /></label><Button variant="outline" disabled={status === 'saving' || !phone.trim()} onClick={() => void save()}>{status === 'saving' ? 'Saving…' : 'Save phone number'}</Button></div>{status === 'saved' && <p className="field-hint">Saved.</p>}{error && <p role="alert">{error}</p>}</section>;
}
export function SettingsPage({ demo }: { demo: boolean }) {
  const [connected, setConnected] = useState<string[]>([]); const [market, setMarket] = useState<Marketplace | null>(null); const [url, setUrl] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { void fetch('/api/connections').then(readJsonResponse<{ connected: string[] }>).then(data => setConnected(data.connected)).catch(() => setError('Could not load connection status. Refresh to retry.')); }, []);
  async function action(kind: 'open' | 'save' | 'cancel') {
    setBusy(true); setError('');
    try { const data = await readJsonResponse<{debugUrl?: string; demo?: boolean; connected?: boolean}>(await fetch('/api/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketplace: market, action: kind }) }));
      if (data.debugUrl) setUrl(data.debugUrl);
      if (kind === 'save') { setConnected(values => [...new Set([...values, market!])]); setMarket(null); setUrl(''); }
      if (kind === 'cancel') { setMarket(null); setUrl(''); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <main className="workspace-page"><h1>Settings</h1>{process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <AccountSettings/> : <p>Demo account · no sign-in or personal profile is stored.</p>}{!demo && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && <NotificationSettings/>}<section><h2>Marketplace connections</h2><p>Sign in inside Steel. Haggleface never requests your marketplace password.</p>{demo && <p className="demo-badge">Demo connections are simulated</p>}<div className="settings-markets">{(['facebook', 'ebay', 'kijiji'] as const).map(value => <article key={value}><strong>{value === 'ebay' ? 'eBay' : value === 'kijiji' ? 'Kijiji' : 'Facebook Marketplace'}</strong><p>{connected.includes(value) ? 'Profile connected' : 'Not connected'}</p><Button variant="outline" onClick={() => { setMarket(value); setError(''); }}>{connected.includes(value) ? 'Reconnect' : 'Connect'}</Button></article>)}</div></section>{error && <p role="alert">{error}</p>}<Modal open={market !== null} onOpenChange={open => { if (!open) { if (url) void action('cancel'); else setMarket(null); } }} title={`Connect ${market ?? 'marketplace'}`} description={demo ? 'Simulated connection. No marketplace is contacted.' : 'Complete sign-in in the secure browser, then save your profile.'}>{url && <BrowserView url={url} interactive/>}<Button disabled={busy} onClick={() => void action(demo || url ? 'save' : 'open')}>{busy ? 'Working…' : demo ? 'Save demo connection' : url ? 'I’m signed in · Save connection' : 'Open secure sign-in browser'}</Button>{error && <p role="alert">{error}</p>}</Modal></main>;
}
