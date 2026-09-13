'use client';

import { useState } from 'react';
import { Check, CheckCheck, Loader2, LockKeyhole, Send, ShieldCheck, Sparkles } from 'lucide-react';
import type { RankedListing } from '@/lib/schemas';
import { readStream } from '@/lib/client-stream';
import { money, MarketplaceBadge } from './listings';
import { Button } from './ui/button';
import { BrowserView } from './agent-panel';

type Status = 'idle' | 'drafting' | 'draft' | 'sending' | 'sent';
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function NegotiationPanel({ listing }: { listing: RankedListing }) {
  const [desired, setDesired] = useState(Math.round(listing.price * .85));
  const [max, setMax] = useState(listing.price);
  const [tone, setTone] = useState('Friendly');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState('Opening seller conversation');

  async function draft() {
    setError(''); setToken(''); setMessage(''); setStatus('drafting');
    try {
      if (desired > max) throw new Error('Your opening offer must be at or below your maximum.');
      let result = '';
      await readStream<{ text?: string; token?: string; error?: string }>(
        await fetch('/api/negotiate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listing, desiredPrice: desired, maxPrice: max, tone }),
        }), event => {
          if (event.error) throw new Error(event.error);
          if (event.text) { result += event.text; setMessage(result); }
          if (event.token) setToken(event.token);
        },
      );
      setStatus('draft');
    } catch (e) { setError((e as Error).message); setStatus('idle'); }
  }

  async function send() {
    setError(''); setStatus('sending'); setStage('Opening seller conversation');
    let sent = false;
    try {
      if (listing.demo) { await pause(900); setStage('Entering your approved message'); await pause(1100); }
      await readStream<{ status?: string; error?: string; debugUrl?: string }>(
        await fetch('/api/negotiate/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, message, approved: true }),
        }), event => {
          if (event.error) throw new Error(event.error);
          if (event.debugUrl) setUrl(event.debugUrl);
          if (event.status === 'sent') sent = true;
        },
      );
      if (!sent) throw new Error('Delivery not confirmed. Check the seller conversation before retrying.');
      setStatus('sent');
    } catch (e) { setError((e as Error).message); setStatus('draft'); }
  }

  return <div className="negotiation">
    <div className="negotiation-listing">
      <img src={listing.imageUrls[0] || '/product.svg'} alt="" />
      <div><MarketplaceBadge marketplace={listing.marketplace} /><h4>{listing.title}</h4><strong>{money(listing.price)} <span>asking price</span></strong></div>
    </div>

    {status === 'sent' ? <div className="send-success">
      <div><CheckCheck size={28} /></div><h3>{listing.demo ? 'Demo offer approved' : 'Your offer is on its way'}</h3>
      <p>{listing.demo ? 'The approval workflow is complete. No real seller was contacted.' : 'The marketplace confirmed your message was sent.'}</p>
      <blockquote>{message}</blockquote>
    </div> : status === 'sending' ? <div className="sending-view" aria-live="polite">
      <div className="sending-status"><Loader2 className="spin" size={19} /><div><strong>{stage}</strong><p>Sending only the exact message you approved.</p></div></div>
      {listing.demo ? <div className="demo-chat">
        <div className="demo-chat-address"><LockKeyhole size={11} />{listing.marketplace === 'facebook' ? 'facebook.com/messages' : listing.marketplace === 'ebay' ? 'ebay.com/messages' : 'kijiji.ca/messages'}<span>SIMULATED</span></div>
        <div className="demo-chat-seller"><span className="avatar">{listing.sellerName?.[0] || 'S'}</span><div><strong>{listing.sellerName}</strong><small>Seller conversation</small></div></div>
        <div className="demo-chat-content">{stage.includes('Entering') ? <blockquote>{message}<CheckCheck size={13} /></blockquote> : <p>Opening conversation…</p>}</div>
      </div> : url ? <BrowserView url={url} /> : <p className="field-hint">Connecting your secure marketplace browser…</p>}
    </div> : <>
      <div className="offer-fields">
        <label>Your opening offer<div className="money-input"><span>$</span><input aria-label="Your opening offer" type="number" min="1" max={max} value={desired} disabled={status !== 'idle'} onChange={e => setDesired(Number(e.target.value))} /></div></label>
        <label>Your walk-away price<div className="money-input"><span>$</span><input aria-label="Your walk-away price" type="number" min={desired} value={max} disabled={status !== 'idle'} onChange={e => setMax(Number(e.target.value))} /></div></label>
      </div>
      <p className="field-hint">Your maximum stays private. Haggleface only proposes your opening offer.</p>
      <label className="field-label">Set the tone</label>
      <div className="tone-options">{['Friendly', 'Direct', 'Flexible'].map(t => <button disabled={status !== 'idle'} className={tone === t ? 'selected' : ''} key={t} onClick={() => setTone(t)}>{tone === t && <Check size={12} />} {t}</button>)}</div>
      {status === 'idle' ? <Button className="full-width" onClick={draft}><Sparkles size={16} />Draft an offer</Button> : <div className="draft-box">
        <div><span><Sparkles size={14} />Your proposed message</span><small>{status === 'drafting' ? 'Writing…' : 'Editable · not sent'}</small></div>
        <textarea aria-label="Proposed message" value={message} maxLength={2000} onChange={e => setMessage(e.target.value)} disabled={status === 'drafting'} />
        <div className="approval-note"><ShieldCheck size={15} />Review and edit before you approve.</div>
        <Button className="full-width" disabled={!token || message.trim().length < 5 || status === 'drafting'} onClick={send}><Send size={15} />Approve & Send</Button>
        {status === 'draft' && <button className="text-button" onClick={() => { setStatus('idle'); setMessage(''); setToken(''); }}>Change offer strategy</button>}
      </div>}
    </>}
    {error && <div className="error-state" role="alert">{error}</div>}
    <p className="negotiation-footer"><ShieldCheck size={13} />{listing.demo ? 'Demo mode · no real messages are sent' : 'Only the exact message you approve will be sent'}</p>
  </div>;
}
