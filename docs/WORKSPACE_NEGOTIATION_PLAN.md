# Approved workspace and negotiation plan

Captured from the planning conversation on 2026-09-13. Implementation begins at
`f5f6129` on `feat/steel-harness-proof`. This document records product decisions;
it does not override AGENTS.md's exact-message approval requirement.

## Milestones and current state

1. **Harness compatibility:** direct agent-browser local, Steel-cloud, and Vercel runtime proofs passed after
   user-approved retention of SDK-owned sessions. Steel CLI external attachment
   is unsupported in the tested release. Hard-kill cleanup and marketplace integration remain pending.
   See [proof evidence](STEEL_HARNESS_PROOF.md) before selecting deployment wiring.
2. **Workspace persistence:** pending. Typed records, ownership, scheduling
   primitives, compatibility with existing saved searches and negotiations.
3. **Navigation:** pending. Shared shadcn sidebar, History, Settings, workspace
   Listings/Negotiations surfaces, existing detail/setup dialog interaction.
4. **Discovery:** pending. Scripted search and detail extraction, finite waits,
   resumable bounded jobs, partial results, agent recovery, CAD/USD support.
5. **Negotiation:** pending. Controlled multi-round conversation, scoped
   authorization, per-message claims, confirmation and uncertain-send recovery.
6. **Monitoring:** pending. Account-batched five-minute checks, Check now,
   pause/resume, expiry, closed-tab operation, no notifications.
7. **Preview handoff:** pending. Test Convex deployment, desktop/mobile checks,
   actual Vercel runtime proof. Deployments and real seller tests need explicit
   authorization. No commits/pushes/production changes implied by this plan.

## Navigation and user interaction

- `/` retains the current landing/search experience.
- `/history` lists user-owned searches newest first, paginated, titled by the
  original query. Image-only searches need a clearly identified fallback title.
- `/search/[id]` contains Listings and Negotiations, plus monitoring controls.
- `/settings` shows account details and connected marketplaces. Clerk handles
  profile/security settings.
- Global shadcn New York/Radix left sidebar: Search, History; footer with account
  settings and avatar/name/email/menu/sign-out. Icon collapse on desktop, drawer
  on mobile. Keep sign-in/up focused and demo/signed-out states explicit.
- Keep the listing grid, filters and sorting. No swiping.
- Card -> detail dialog -> Set up negotiation -> setup dialog. Once started,
  CTA becomes View negotiation. Closing setup before confirmation sends nothing.
- Detail dialog shows available photos, description, condition, price/currency,
  shipping, seller, location, original link, and pending/error inspection state.
- Preserve accessible focus, Escape, keyboard navigation, reduced motion and
  mobile behavior through the existing component patterns.

## Discovery contract

- Facebook, Kijiji, eBay. Kijiji adapters already landed in `5f5b58d`; inspect and
  extend those rather than recreating them. Search support does not prove sends.
- Scripts apply/verify filters, collect cards/URLs, discard obvious mismatches,
  deduplicate, visit relevant product URLs and extract detail fields in batches.
- Missing optional fields return unknown without waiting. Fix the eBay shipping
  timeout directly. Preserve good results if another card/source fails.
- Persist basic candidates immediately and enrich from product pages. Opening a
  pending card prioritizes inspection. Save continuation state for later jobs.
- Use direct agent-browser snapshots/reference actions on SDK-owned Steel
  sessions only for unexpected pages or ambiguous
  extraction. Refresh refs after changes. Scripts and harness never act at once.
- Bound recovery steps, model calls and wall time; supported URLs only; page
  content is data, never executable code or instructions. No invented facts.
- Outcomes: running, complete, no matches, partial, needs sign-in, failed.
- Initial tuning: 30 candidates per source/batch, limited equivalent queries,
  stop after repeated no-progress loads; Find more retains existing results.
- Explicit CAD/USD; no implicit conversion or mixed-currency ranking. Verify
  effective location and identify filters that cannot be verified/applied.

## Negotiation contract

- Setup: opening offer, hard maximum, currency/cost basis, tone, instructions,
  24-hour expiry with deliberate extension; explicit Start negotiation.
- Autonomous multi-round replies based on full conversation and new messages.
  Decisions: reply, counteroffer, wait, confirm price, request input, end.
- Maximum is private. Pickup ceiling covers item; shipping ceiling covers item
  plus shipping. Unknown mandatory costs block agreement until clarified.
- Buy one per workspace. Atomically reserve the first acceptable negotiation
  before confirming price; pause competing negotiations. Uncertain confirmation
  retains reservation until reconciled. Price agreed is not purchase complete.
- Seller messaging only. Payment, logistics, formal offers, bids, checkout are
  outside autonomous scope; user handles those after agreement.
- No new seller message means no automatic follow-up merely because polling ran.
- Detected non-agent outgoing message pauses conversation as You took over;
  resume uses refreshed history. Detection must be verified per marketplace.
- Editable settings create a new authorization version and invalidate unsent
  drafts; sent offers remain history. Check current authorization/pause/expiry
  and conversation version immediately before sending.
- Store exact outgoing text, atomically claim send, verify delivery. A crash or
  timeout after Send means reconcile, never blindly retry. No exactly-once
  delivery claim for external website interactions.
- Needs attention provides specific actions: reconnect, answer, update limits,
  review uncertain delivery, resume, stop.
- Reconcile current AGENTS.md approval contract before autonomous sends. Preserve
  signed authorization and atomic claims; legacy one-message approval grants
  must not become ongoing permissions. Do not mutate production records.

## Monitoring and execution

- Monitor only conversations initiated from a workspace, across all workspaces
  of one user, grouped by marketplace account. No broad inbox ingestion.
- Convex minute dispatcher queries indexed due accounts, atomically claims work,
  schedules an internal action to invoke a server-authenticated bounded Vercel
  endpoint with a check ID. Load authoritative work from Convex, not request data.
- Internal action awaits HTTP; handler awaits browser work. No untracked promises
  after returning, no dependency on local daemon/process surviving invocations.
- Five-minute target cadence plus dispatch/processing time, not instant delivery.
  No due work means no browser. Batch tracked conversations, save new messages,
  process replies, release browser and claim, record last/next check.
- Proposed budget: stop starting browser work around 180s, reserve cleanup time
  below 300s Vercel limit, persist cursor and continue oversized batches.
- Check now joins active runner or schedules immediate work; no duplicate batch.
- Workspace pause stops its checks and replies; other workspaces continue. Pause
  cannot retract submitted messages. Default 24h expiry, Extend, Resume and Stop.
- Expiring account claims and per-conversation processing markers prevent stale
  workers/duplicate observations from sending twice. Refresh before each send.
- Recover abandoned reads; uncertain sends require reconciliation.
- UI shows latest messages, agent state, current offer, last/next check. No
  notifications. Browser sessions close between checks; Convex holds continuity.
- Production Convex invokes production; shared test Convex targets one selected
  preview. Never independently dispatch every branch to the shared test backend.
- Measure usage: up to 288 checks per active account/day at five-minute cadence.

## Verification and stop conditions

Controlled fixtures first: open/fill/click/observe by ref, session isolation,
script handoff, timeout/cleanup. Then a controlled multi-round conversation with
counteroffers, seller questions, and acceptance. No automated real seller sends.

Regression coverage: missing optional shipping, partner labels, detail-page
enrichment, deduplication, sold items, currencies, partial source failure,
continuation, ownership, duplicate polling, overlapping Check now, pause/expiry
mid-round, crash around Send, manual takeover, price ceilings, seller prompt
injection, competing sellers, multiple messages between polls, login loss.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, desktop/mobile
browser checks, and selected test Convex deployment. A local build cannot prove
Vercel binary packaging, live selectors, profile reuse, or message delivery.

Baseline on this branch: 6/7 unit tests pass. `tests/scoring.test.ts:6` expects
8 fixtures, but `5f5b58d` added Kijiji fixtures yielding 10. That test and fixture
file are unchanged by the harness preflight. Resolve during discovery coverage.

Stop rather than guess if harness hosting/attachment is unsupported, conversation
identity or delivery is ambiguous, or authorization instructions remain in conflict.
