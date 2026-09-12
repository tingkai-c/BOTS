# HaggleFace

**A better find.** A working AI secondhand-shopping demo: cross-marketplace search, live browser visibility, progressive listings, transparent deal ranking, image input, and an approval-first negotiation flow.

## Run

Node.js 22+ and pnpm are required.

```bash
pnpm install
pnpm dev
```

The server binds to `0.0.0.0`. Open the port printed in the terminal using your server's LAN or Tailscale address. **A verified production build is currently running at http://100.121.141.15:3003.** That tailnet address is also allowlisted in `next.config.ts` so Next.js development assets and hot reload work remotely. Add your own hostname there when running on another machine. To start the production build yourself, run `pnpm build` followed by `pnpm start --port 3003`.

No environment variables are needed for the complete demo. Click the Sony example to see two concurrent simulated browsers, incremental results, and live ranking. Open a listing, inspect it, draft an offer, edit the message, and approve it. No real seller is contacted in demo mode.

## Enable live integrations

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
| --- | --- |
| `STEEL_API_KEY` | Real cloud browser sessions. Its presence switches marketplace execution to live mode. |
| `ANTHROPIC_API_KEY` | Claude multimodal product identification, typed comparison tools, streamed recommendations and offer drafting. |
| `AI_MODEL` | Optional Anthropic model; defaults to `claude-sonnet-5`. Must support images, tools, and structured outputs. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend authentication. |
| `CLERK_SECRET_KEY` | Clerk server authentication. |
| `CONVEX_DEPLOYMENT` | Deployment selected by `pnpm convex:dev`. |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL. |
| `CONVEX_SERVER_SECRET` | A long random secret, set identically in Next.js **and the Convex environment**. Protects server-only persistence operations. |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk Frontend API URL; configure this in the **Convex environment**. |

1. Create a Clerk application and activate the **Convex integration** in its dashboard. Configure the frontend URL and allowed redirects for your deployed domain.
2. Run `pnpm convex:dev` to create/select a Convex deployment. Set `CLERK_JWT_ISSUER_DOMAIN` and `CONVEX_SERVER_SECRET` in its dashboard, then sync the functions.
3. Add all keys above and restart Next.js. Live mode deliberately requires Clerk and Convex instead of putting authenticated browser profiles in ephemeral process memory.
4. Sign into Scout. Open **Connect Facebook** (the dialog also supports eBay). Start the interactive Steel browser, sign into the marketplace yourself, then save the connection. Steel snapshots the persistent profile on release. Passwords never enter this application's database.
5. Start a search. Both selected marketplaces run concurrently through **Steel + Playwright**, without marketplace search APIs. Convex receives each validated listing and publishes reactive state to the frontend.

Use HTTPS for Clerk and live interactive browser use on deployed domains. For an authenticated tailnet deployment, use your established HTTPS reverse proxy/Tailscale Serve configuration. Plain tailnet HTTP is sufficient for this credential-free demo.

## What is implemented, and what is verified

**Verified locally:** credential-free text search, image upload, structured demo identification, incremental results, filtering/sorting, saved listings, detail inspection, streamed offer drafts, editable approval, simulated send, restored searches, mobile agent tabs, keyboard/dialog behavior, validation errors, and clean browser console. TypeScript, ESLint, unit tests, browser tests, and production build pass.

**Real integration paths implemented:** Steel SDK `sessions.create`, Playwright CDP connections, embedded `debugUrl` live view, interactive login, persistent `profileId` / `persistProfile`, cleanup, independent Facebook/eBay DOM extraction, listing inspection, approved messaging, Clerk auth, Convex persistence/subscriptions, and AI SDK 7 structured and streamed calls.

**Claude verified:** a real `claude-sonnet-5` API call returned schema-validated structured product data. The provider reads `ANTHROPIC_API_KEY`; for existing installations, a Claude-format key in the old `OPENAI_API_KEY` field is also recognized. An actual OpenAI key is never sent to Anthropic. `.env.local` takes precedence over `.env` for model selection.

**Not live-verified here:** authenticated marketplace scraping/sending, Steel profile reuse, and deployed Convex functions. These need your external keys and marketplace account sessions. Marketplace DOMs and account challenges vary; failures appear as actionable per-marketplace states, and a failed source does not erase results from the other source. A messaging failure is recorded as unconfirmed rather than automatically retried, preventing accidental duplicate offers.

### Deliberate demo behavior

- Without Steel, marketplace data, browser activity, accounts, inspection, and sending are explicitly simulated.
- Without an Anthropic key, demo image identification uses a labeled **sample product**, not actual visual recognition. Text searches select appropriate fixture scenarios; arbitrary product names generate illustrative sample listings.
- Demo state is stored in the current tab's `sessionStorage`, not Convex. Live state is persisted to Convex before execution and after each listing/event. Images are sent to identification but are not retained in stored search state.
- Saved hearts are local to the current app instance. Search results survive reload in the same tab.
- Demo images are representative product photography, not scraped seller photos. Demo “Browse marketplace” links open marketplace search/home pages, never fabricated seller listings.
- Facebook uses the connected account's marketplace location; radius is included in the search URL. Set the city inside Facebook for accurate local results. Unknown shipping is displayed as unknown, not free.
- Searches are bounded to 30–35 DOM cards per source and a five-minute Steel timeout. The workflow finishes within a single streaming server request; it is not a durable background workflow across server restarts. Completed sessions are released and the UI shows the finished state.

## Project map

```text
app/                     Next.js App Router pages and typed HTTP endpoints
components/              Shopping UI, browser panel, listing/negotiation dialogs
components/ui/           shadcn-style Radix dialog and cva/Slot button primitives
lib/agents/              Bounded parallel orchestration and AI comparison tools
lib/ai/                  AI SDK structured multimodal identification
lib/steel/               Steel session lifecycle and Playwright CDP connections
lib/marketplaces/        Separate Facebook/eBay search, extraction, messaging
lib/scoring/             Deterministic deal scoring and deduplication
lib/schemas/             Zod input, listing, identification and approval contracts
lib/server/              Auth, Convex access, signed approval capability
lib/demo/                Explicitly fictional marketplace fixtures
convex/                  Schema, ownership-checked queries, server-guarded writes
tests/                   Behavioral unit tests and end-to-end browser QA
```

Deal score weights: 45% total price relative to the current result median, 25% relevance, 12% condition, 8% seller reputation, and 10% extraction confidence. Missing seller data receives a neutral baseline. Scores are estimates, recalculate as listings arrive, and have an expandable explanation.

Offer approval is a separate authenticated endpoint, never an autonomous model tool. Drafts receive an expiring, user-bound signed token. The live send endpoint atomically claims the negotiation in Convex and sends exactly the approved text via the marketplace adapter. Maximum price is private strategy metadata and is not included in the seller message prompt.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build

# With the app already running and an installed Playwright Chromium:
pnpm exec playwright install chromium
QA_BASE_URL=http://your-tailnet-host:3003 pnpm exec playwright test

# Reuse an existing Chromium binary if needed:
CHROMIUM_PATH=/path/to/chromium QA_BASE_URL=http://your-tailnet-host:3003 pnpm exec playwright test
```

Browser tests capture the landing page, results, listing detail, approval dialog, and mobile views under `test-results/` (gitignored). TypeScript 6 and ESLint 9 are pinned to remain compatible with Next.js's current lint plugins; the app uses the installed stable Next.js 16, React 19, and AI SDK 7.

## Deploy to Vercel

Deploy this repository as a Next.js project using pnpm. Set the environment variables, deploy Convex (`pnpm exec convex deploy`), and point `NEXT_PUBLIC_CONVEX_URL` to production. Use a Vercel function duration allowance of at least 300 seconds for `/api/search`; Node.js runs Playwright against Steel remotely, so no local Chromium binary is needed in production. After changing public environment variables, rebuild the frontend.

## Documentation consulted

- [Steel sessions, Playwright, cleanup](https://docs.steel.dev/llms.txt)
- [Steel headful WebRTC live embeds](https://docs.steel.dev/overview/sessions-api/embed-sessions/live-sessions)
- [Steel persistent profiles](https://docs.steel.dev/cookbook/profiles)
- [AI SDK structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [AI SDK typed tools and streaming](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Convex + Clerk](https://docs.convex.dev/auth/clerk)

## Image credits

Representative headphones and camera photographs: [Unsplash headphones source](https://images.unsplash.com/photo-1546435770-a3e426bf472b), [Unsplash camera source](https://images.unsplash.com/photo-1516035069371-29a1b244cc32). Aeron photograph: Brooklyn Museum, [Wikimedia Commons source and license](https://commons.wikimedia.org/wiki/File:Aeron_chair_Brooklyn_Museum.jpg). Demo photography is illustrative, not a claim about a particular seller's product.
