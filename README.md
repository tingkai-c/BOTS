# HaggleFace

Public app: **https://haggleface.vercel.app**. The Vercel project is `haggleface`, with Clerk authentication, Claude Sonnet 5, and Convex production deployment `cheery-bison-90`.

**Testing a branch?** Open [its pull request](https://github.com/tingkai-c/BOTS/pulls) and click **Open Haggleface preview ↗** in the **🔎 Haggleface preview** bot comment. The preview URL is also copyable there. See [the team workflow](docs/TEAM_WORKFLOW.md#where-is-my-preview-link).

**A better find.** AI-assisted secondhand shopping with persistent workspaces, cross-marketplace discovery, live browser visibility, progressive listings, explainable ranking, image input, and explicitly authorized negotiations.

## Run

Node.js 24 and pnpm 11.20.0 are required. Teammates should read [the team workflow](docs/TEAM_WORKFLOW.md); coding agents should read [AGENTS.md](AGENTS.md).

```bash
pnpm install
pnpm dev
```

Open the development URL printed in the terminal. Shared testing uses Vercel branch previews; the public app is https://haggleface.vercel.app. To run a production build locally, use `pnpm build` followed by `pnpm start`.

No environment variables are needed for the demo. Click the Sony example to see simulated browsers, incremental results, and live ranking. Open a listing, inspect it, and choose **Set up negotiation**. Set limits and click **Start negotiation**, then use **Check now** in Negotiations to advance the simulated conversation. History restores workspaces in the same tab. No real seller is contacted in demo mode.

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
| `WORKSPACE_WORKER_URL` | **Convex environment only:** the selected preview's HTTPS `/api/workspace/worker` URL. Required for durable discovery and monitoring; unset disables dispatch. |

1. Create a Clerk application and activate the **Convex integration** in its dashboard. Configure the frontend URL and allowed redirects for your deployed domain.
2. Run `pnpm convex:dev` to create/select a Convex deployment. Set `CLERK_JWT_ISSUER_DOMAIN` and `CONVEX_SERVER_SECRET` in its dashboard, then sync the functions.
3. Add all keys above and restart Next.js. Live mode deliberately requires Clerk and Convex instead of putting authenticated browser profiles in ephemeral process memory.
4. Sign into Haggleface. Open **Connect Facebook** (the dialog also supports eBay and Kijiji). Start the interactive Steel browser, sign into the marketplace yourself, then save the connection. Steel snapshots the persistent profile on release. Passwords never enter this application's database.
5. Configure the test backend's `WORKSPACE_WORKER_URL` as described in [the team workflow](docs/TEAM_WORKFLOW.md#workspace-worker). Start a search. Selected marketplaces run as bounded durable jobs through **Steel + Playwright**, without marketplace search APIs. Convex receives validated listings progressively and publishes reactive state to the frontend.

Vercel supplies HTTPS for the shared app and branch previews. No tailnet membership is needed.

## What is implemented, and what is verified

**Current implementation:** responsive sidebar, History, Settings, Listings/Negotiations views, resumable discovery and detail jobs, scoped negotiation authorization, persisted messages/send attempts, account-batched monitoring, Check now, pause/resume, expiry, and uncertain-delivery reconciliation. Legacy exact-message approval endpoints remain available.

**Core verification:** 17 unit tests cover extraction, ranking, ownership, durable claims, authorization changes, controlled multi-round negotiation, manual takeover, uncertain delivery, and competing agreements. Typecheck, ESLint, and production build pass. See [the implementation plan](docs/WORKSPACE_NEGOTIATION_PLAN.md) for current deployment and smoke-test evidence.

**Real integration paths implemented:** Steel SDK `sessions.create`, Playwright CDP connections, embedded `debugUrl` live view, interactive login, persistent `profileId` / `persistProfile`, cleanup, independent Facebook/eBay/Kijiji DOM extraction, listing inspection, approved messaging, Clerk auth, Convex persistence/subscriptions, and AI SDK 7 structured and streamed calls.

**Claude verified:** a real `claude-sonnet-5` API call returned schema-validated structured product data. The provider reads `ANTHROPIC_API_KEY`; for existing installations, a Claude-format key in the old `OPENAI_API_KEY` field is also recognized. An actual OpenAI key is never sent to Anthropic. `.env.local` takes precedence over `.env` for model selection.

**Deployment scope:** workspace schema/functions are deployed to test `sensible-newt-347`. This PR does not promote them to production. The native browser harness has separate successful-path Steel/Vercel runtime evidence in [the proof report](docs/STEEL_HARNESS_PROOF.md).

**Not live-verified here:** authenticated marketplace scraping/sending and Steel profile reuse. These need signed-in marketplace sessions. Marketplace DOMs and account challenges vary; failures appear as actionable per-marketplace states, and a failed source does not erase results from the other source. A messaging failure is recorded as unconfirmed rather than automatically retried, preventing accidental duplicate offers.

### Deliberate demo behavior

- Without Steel, marketplace data, browser activity, accounts, inspection, and sending are explicitly simulated.
- Without an Anthropic key, demo image identification uses a labeled **sample product**, not actual visual recognition. Text searches select appropriate fixture scenarios; arbitrary product names generate illustrative sample listings.
- Demo state is stored in the current tab's `sessionStorage`, not Convex. Live state is persisted to Convex before execution and after each listing/event. Images are sent to identification but are not retained in stored search state.
- Saved hearts are local to the current app instance. Search results survive reload in the same tab.
- Demo images are representative product photography, not scraped seller photos. Demo “Browse marketplace” links open marketplace search/home pages, never fabricated seller listings.
- Facebook uses the connected account's marketplace location. Location and condition verification gaps are reported. Unknown shipping is displayed as unknown, not free. Kijiji prices are CAD; currency filtering and ranking keep CAD and USD separate. No automatic conversion is performed.
- Live discovery persists work claims and continuation cursors in Convex. Batches collect up to 30 new candidates, inspect details within a bounded runtime, and release browser sessions. **Find more** resumes work. Demo search remains a simulated stream.

## Project map

```text
app/                     Next.js App Router pages and typed HTTP endpoints
components/              Shopping UI, browser panel, listing/negotiation dialogs
components/ui/           shadcn-style Radix dialog and cva/Slot button primitives
lib/agents/              Bounded parallel orchestration and AI comparison tools
lib/ai/                  AI SDK structured multimodal identification
lib/steel/               Steel session lifecycle and Playwright CDP connections
lib/marketplaces/        Separate Facebook/eBay/Kijiji search, extraction, messaging
lib/scoring/             Deterministic deal scoring and deduplication
lib/schemas/             Zod input, listing, identification and approval contracts
lib/server/              Auth, Convex access, signed approval capability
lib/demo/                Explicitly fictional marketplace fixtures
convex/                  Schema, ownership-checked queries, server-guarded writes
tests/                   Behavioral unit tests and end-to-end browser QA
```

Deal score weights: 45% total price relative to the current result median, 25% relevance, 12% condition, 8% seller reputation, and 10% extraction confidence. Missing seller data receives a neutral baseline. Scores are estimates, recalculate as listings arrive, and have an expandable explanation.

**Start negotiation** creates a signed, user-bound, versioned authorization with a private maximum, currency/cost basis, permitted actions, and expiry of at most 24 hours. Each exact outgoing message is persisted and atomically claimed after rechecking current authorization and conversation state. Uncertain sends are reconciled rather than blindly retried. The first acceptable workspace deal reserves the agreement and pauses competitors. Payment, logistics, formal offers, bids, checkout, and purchases are excluded. Legacy approval tokens authorize only their original single message.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build

# With the app already running and an installed Playwright Chromium:
pnpm exec playwright install chromium
QA_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test tests/browser/shopping.spec.ts tests/browser/api.spec.ts

# Reuse an existing Chromium binary if needed:
CHROMIUM_PATH=/path/to/chromium QA_LIVE_AUTH=1 QA_BASE_URL=https://YOUR-PREVIEW-URL pnpm exec playwright test tests/browser/deployed.spec.ts
```

Browser tests capture the landing page, results, listing detail, approval dialog, and mobile views under `test-results/` (gitignored). TypeScript 6 and ESLint 9 are pinned to remain compatible with Next.js's current lint plugins; the app uses the installed stable Next.js 16, React 19, and AI SDK 7.

## Deploy to Vercel

Deploy this repository as a Next.js project using pnpm. Branch pushes deploy previews; see the team workflow for separate test/production configuration. The release owner promotes Convex changes to production when approved. Allow 300 seconds for `/api/workspace/worker`. Convex dispatches due work every minute, with a target five-minute monitoring cadence per active marketplace account. Node.js runs Playwright against Steel remotely. Preserve the physical pnpm tracing entries in `next.config.ts`, including the pinned recovery binary. After changing public environment variables, rebuild the frontend.

## Documentation consulted

- [Steel sessions, Playwright, cleanup](https://docs.steel.dev/llms.txt)
- [Steel headful WebRTC live embeds](https://docs.steel.dev/overview/sessions-api/embed-sessions/live-sessions)
- [Steel persistent profiles](https://docs.steel.dev/cookbook/profiles)
- [AI SDK structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [AI SDK typed tools and streaming](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Convex + Clerk](https://docs.convex.dev/auth/clerk)

## Image credits

Representative headphones and camera photographs: [Unsplash headphones source](https://images.unsplash.com/photo-1546435770-a3e426bf472b), [Unsplash camera source](https://images.unsplash.com/photo-1516035069371-29a1b244cc32). Aeron photograph: Brooklyn Museum, [Wikimedia Commons source and license](https://commons.wikimedia.org/wiki/File:Aeron_chair_Brooklyn_Museum.jpg). Demo photography is illustrative, not a claim about a particular seller's product.
