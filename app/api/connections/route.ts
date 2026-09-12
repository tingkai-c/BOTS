import { z } from 'zod';
import { apiError, connection, liveMode, saveConnection, userId } from '@/lib/server/context';
import { createSession, connectBrowser, releaseSession, viewerUrl } from '@/lib/steel/sessions';
import { marketplaceSchema } from '@/lib/schemas';

export const maxDuration = 60;
const schema = z.object({ marketplace: marketplaceSchema, action: z.enum(['open', 'save', 'cancel']) });

export async function POST(req: Request) {
  try {
    const user = await userId();
    const input = schema.parse(await req.json());
    if (!liveMode()) return Response.json({ demo: true, message: 'Account connection is simulated in demo mode.' });
    const old = await connection(user, input.marketplace);

    if (input.action !== 'open') {
      if (!old?.sessionId) throw new Error('Connection session expired. Open a new browser.');
      if (input.action === 'save') {
        const { browser, page } = await connectBrowser(old.sessionId);
        try {
          let loggedIn = false;
          if (input.marketplace === 'facebook') {
            const cookies = await page.context().cookies();
            loggedIn = cookies.some(c => c.name === 'c_user' && /(^|\.)facebook\.com$/.test(c.domain));
          } else {
            // Anonymous eBay visitors also get cookies. Verify an authenticated page,
            // rather than treating the presence of a tracking cookie as a login.
            await page.goto('https://www.ebay.com/mys/home', { waitUntil: 'domcontentloaded', timeout: 25000 });
            const url = new URL(page.url());
            loggedIn = url.hostname === 'www.ebay.com' && url.pathname.startsWith('/mys/') &&
              await page.getByRole('heading', { name: /My eBay|Summary|Overview/i }).count() > 0;
          }
          if (!loggedIn) throw new Error('Sign-in is not complete. Finish signing in in the browser first.');
        } finally { await browser.close().catch(() => {}); }
      }
      await releaseSession(old.sessionId);
      await saveConnection(user, input.marketplace, old.profileId);
      return Response.json({ connected: input.action === 'save' });
    }

    if (old?.sessionId) await releaseSession(old.sessionId).catch(() => {});
    const session = await createSession(old?.profileId, true);
    try {
      if (!session.profileId) throw new Error('Steel did not create a persistent profile.');
      await saveConnection(user, input.marketplace, session.profileId, session.id);
      const { browser, page } = await connectBrowser(session.id);
      try {
        await page.goto(input.marketplace === 'facebook' ? 'https://www.facebook.com/' : 'https://signin.ebay.com/ws/eBayISAPI.dll?SignIn', { waitUntil: 'domcontentloaded', timeout: 25000 });
      } finally { await browser.close().catch(() => {}); }
      return Response.json({ debugUrl: viewerUrl(session.debugUrl, true) });
    } catch (e) { await releaseSession(session.id).catch(() => {}); throw e; }
  } catch (e) { return apiError(e); }
}
