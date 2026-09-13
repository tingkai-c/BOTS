import { z } from 'zod';
export const currencySchema = z.enum(['USD', 'CAD']);
export const negotiationSettings = z.object({
  openingOffer: z.number().positive().max(1_000_000), maximum: z.number().positive().max(1_000_000),
  currency: currencySchema, costBasis: z.enum(['pickup', 'shipped']),
  tone: z.enum(['Friendly', 'Direct', 'Flexible']), instructions: z.string().max(2000).default(''),
  expiresAt: z.number().int().positive(),
}).refine(s => s.openingOffer <= s.maximum, 'Opening offer must not exceed your maximum.');
export type NegotiationSettings = z.infer<typeof negotiationSettings>;
export const messageSchema = z.object({ sourceId: z.string().min(1).max(300), role: z.enum(['incoming', 'outgoing']), text: z.string().min(1).max(6000), ordinal: z.number().int().nonnegative() });
export type ConversationMessage = z.infer<typeof messageSchema>;
export const decisionSchema = z.object({
  action: z.enum(['reply', 'counteroffer', 'wait', 'confirm', 'input', 'end']),
  amount: z.number().positive().nullable(), currency: currencySchema.nullable(),
  mandatoryCosts: z.number().nonnegative().nullable(),
  text: z.string().max(1500),
});
export type Decision = z.infer<typeof decisionSchema>;
export function statedAmounts(text:string,currency:'USD'|'CAD'):number[]{
 if(currency==='CAD'&&/\bUSD\b|US\s*\$/i.test(text)||currency==='USD'&&/\bCAD\b|C(?:A)?\s*\$/i.test(text))return [];
 return [...text.matchAll(/(?:\bUSD\s*|\bCAD\s*|(?:US|CA|C)?\s*\$)\s*([\d,]+(?:\.\d{1,2})?)/gi)].map(m=>Number(m[1].replaceAll(',','')));
}

export function outgoingText(raw: Decision, settings: NegotiationSettings): string | null {
  const d = decisionSchema.parse(raw);
  if (['wait', 'input', 'end'].includes(d.action)) return null;
  if (d.action === 'counteroffer' || d.action === 'confirm') {
    if (d.amount === null || d.currency !== settings.currency) throw new Error('Currency or price is uncertain.');
    if (settings.costBasis === 'shipped' && d.mandatoryCosts === null) throw new Error('Clarify mandatory shipping costs before offering or agreeing.');
    const total = d.amount + (settings.costBasis === 'shipped' ? d.mandatoryCosts! : 0);
    if (total > settings.maximum) throw new Error('Price exceeds your authorized limit.');
    const terms = `${settings.currency} ${d.amount.toFixed(2)}${settings.costBasis === 'shipped' ? ` plus ${settings.currency} ${d.mandatoryCosts!.toFixed(2)} shipping` : ' for the item'}`;
    return d.action === 'confirm' ? `That price works for me: ${terms}. I will follow up personally about next steps.` : `${settings.tone === 'Direct' ? 'Would you accept' : 'Hi! Would you consider'} ${terms}?`;
  }
  // Monetary promises and logistics must use controlled decisions, never prose.
  if (!d.text.trim() || /\d|\$|\b(maximum|budget|limit|pay|payment|accept|agree|deal|offer|bid|buy|purchase|checkout|pick.?up|deliver|ship|address|meet|transfer|deposit)\b/i.test(d.text)) {
    throw new Error('This reply needs your input before it can be sent.');
  }
  return d.text.trim();
}
