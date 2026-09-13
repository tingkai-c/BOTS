# Haggleface implementation plan

Full user-approved implementation specification, updated 2026-09-13.
This replaces the earlier condensed plan. Implementation branch:
`feat/steel-harness-proof`; [PR #7](https://github.com/tingkai-c/BOTS/pull/7)
remains unmerged. Production deployment and real seller-message testing require
separate explicit authorization.

## 1. Goal and current progress

Build a persistent shopping workflow:

**Search → collect and inspect listings → select products → configure autonomous negotiations → monitor seller replies and negotiate across multiple rounds.**

Keep the existing stack:

- **Next.js on Vercel:** application and bounded browser jobs
- **Clerk:** authentication and account management
- **Convex:** persistent state, subscriptions, scheduling, and atomic work claims
- **Steel SDK:** cloud-browser session creation, profiles, and cleanup
- **Playwright:** fast scripted browsing and extraction
- **`agent-browser`:** snapshots and reference-based actions for adaptive recovery
- **Claude through the AI SDK:** product interpretation and negotiation decisions

### Already completed

- Created branch `feat/steel-harness-proof` and opened PR #7.
- Pinned `agent-browser@0.37.1`.
- Added and ran reproducible local/cloud compatibility probes.
- **Verified direct agent-browser attachment to SDK-created Steel sessions.**
- Verified snapshots, reference-based fill/click, Playwright handoff, concurrent session isolation, and successful session release.
- **Verified the same successful-path operations in an actual Vercel preview function:** Linux x64, HTTP 200, `passed: true`, two isolated sessions, 5044ms total.
- Fixed Turbopack rewriting `require.resolve` into a numeric module ID by resolving the explicitly traced physical pnpm package path.
- User explicitly approved replacing the instruction-level exact-message-only contract with scoped, time-limited negotiation authorization. Legacy approvals remain single-message grants.

**Remaining infrastructure verification:** timeout and forced-termination behavior, daemon cleanup under failure, and bundle-size measurement. Successful-path hosting is proven; marketplace integration is not.

The temporary probe endpoint, scripts, test-only authorization variables, and probe-specific test have been removed. The pinned dependency and packaging knowledge are retained for the actual integration. See [runtime proof evidence](STEEL_HARNESS_PROOF.md).

We are keeping **SDK-owned sessions**. The Steel CLI’s unsupported attachment flag is no longer a dependency.

## 2. Navigation and application layout

Keep the **current search page as the default landing page at `/`**.

Add a shared global left sidebar using the existing **shadcn New York/Radix** setup.

| Route | Purpose |
|---|---|
| `/` | Current search landing page |
| `/history` | Saved searches |
| `/search/[id]` | One search workspace |
| `/settings` | Account details and marketplace connections |

### Sidebar

- Haggleface branding
- **Search**
- **History**
- Bottom-anchored **Account settings**
- Avatar, name, email, account-management menu, and sign-out

Reuse Clerk’s profile/security UI.

### Responsive and accessibility behavior

- Desktop: expanded sidebar, collapsible to icons, active-route highlighting and tooltips.
- Mobile: drawer navigation that closes after selecting a destination.
- Preserve existing colors and typography.
- Use shadcn’s dialog, dropdown, keyboard, and focus patterns.
- Keep sign-in/sign-up pages focused.
- Preserve explicitly labeled demo and signed-out states.

## 3. Persistent search workspaces

Every submitted search creates a saved workspace.

### Workspace data

- Owner
- Original query
- Creation time
- Product identification and search criteria
- Marketplace discovery runs
- Listings and inspection progress
- Negotiations and conversation histories
- Monitoring settings

The **original query is the History title**. Image-only searches need a clearly labeled fallback title because there is no initial text query.

### History

- User-owned, paginated list
- Newest first
- Query title, date, and concise progress summary
- Loading, empty, and error states
- Clicking a row reopens that workspace

### Workspace views

1. **Listings:** current grid, filters, sorting, product dialogs, and discovery progress.
2. **Negotiations:** conversations, agent progress, agreement outcomes, and monitoring controls.

Discovery and negotiation can overlap. Starting a negotiation must not prevent browsing or collecting other listings.

## 4. Script-first discovery and detail collection

Support **Facebook Marketplace, Kijiji, and eBay**.

Kijiji adapters have already landed on `main`; inspect and extend that implementation rather than recreate it. Its presence in the code does not establish that live search or messaging works.

### A. Discover candidates

For each selected marketplace:

1. Create a Steel session through the SDK.
2. Reuse the user’s connected profile where available.
3. Publish the live-view URL.
4. Navigate to search using Playwright.
5. Apply and verify supported search criteria.
6. Read result cards in batches.
7. Collect listing URLs and basic fields.
8. Deduplicate and reject obvious mismatches.
9. Persist candidates progressively.

Fix known defects directly, especially eBay’s optional shipping-field waits.

**Missing optional information returns unknown immediately; it must not cause a 30-second wait per card.**

### B. Inspect relevant product pages

Search cards are discovery data, not complete product details.

For each relevant candidate, scripts:

1. Navigate directly to the collected product URL.
2. Wait for a recognized page-ready condition with a bounded timeout.
3. Expand truncated descriptions when a known control is present.
4. Read available fields in a batch:
   - Title, price, currency
   - Description
   - Condition and product attributes
   - Photo URLs
   - Displayed location
   - Seller name/profile and visible reputation
   - Pickup/shipping information
   - Availability
5. Validate the extracted information.
6. Update the existing listing.

No AI call is needed merely to open a known URL or read a recognized layout.

Missing information remains unknown. Detail-inspection failure must not erase a usable basic listing.

### C. Progressive, resumable work

- Show cards as they are discovered.
- Enrich them as detail inspections complete.
- Prioritize a listing when the user opens it.
- Persist unfinished work and continuation state.
- Resume after navigation, reload, or interrupted jobs.
- Provide **Find more** without discarding existing results.

Start with one detail worker per marketplace session. Tune parallelism after measuring browser behavior and throughput.

### Initial discovery limits

Proposed tuning defaults:

- Up to **30 relevant candidates per marketplace per batch**
- Limited equivalent query variants
- Stop after repeated loading attempts produce no new listings
- Bounded wall-clock time with cleanup reserved

These are adjustable limits, not a promise to exhaust every marketplace.

### D. Clear outcomes

Track:

- Running
- Complete
- No matches
- Partial
- Needs sign-in
- Failed

Preserve results from successful sources when another source fails.

### Currency and location

- Support CAD and USD explicitly.
- Do not silently compare different currencies as equivalent.
- Verify the effective marketplace location.
- Identify requested filters that cannot be applied or verified.
- Keep shipping unknown when it is unknown.

## 5. Adaptive browser recovery

Use **direct `agent-browser` attached to the SDK-created Steel session**.

### When the agent gets involved

- An unexpected dialog obstructs the page.
- A known extraction layout stops working.
- Essential fields are ambiguous.
- Navigation lands somewhere unfamiliar.
- A scripted action fails and a fresh observation may resolve it.

Recognized sold listings, missing optional fields, and known login pages can be handled deterministically.

### Recovery loop

1. Capture the current URL and snapshot.
2. Give Claude the intended operation and concrete failure.
3. Let it select from a small typed tool set.
4. Execute reference-based actions.
5. Observe and verify the result.
6. Resume scripts or report a specific blocker.

Use fuller page text or screenshots when an interactive-only snapshot is insufficient.

### Integration rules

- Playwright and the harness never act simultaneously on the same page.
- Refresh references after substantial page changes.
- Bound recovery actions, model calls, and execution time.
- Treat marketplace content as untrusted data.
- Enforce supported navigation in application tools.
- Do not expose unrestricted shell execution or model-generated executable code.
- Record concise actions/errors and session references.
- Clean up harness processes and release Steel sessions.

The selected agent-browser version documents restrictions on its built-in domain allowlist when attaching to existing CDP sessions, so we must not assume that flag supplies our navigation controls.

## 6. Product details and negotiation entry

Preserve the current interaction:

**Click product card → detail dialog → Set up negotiation → setup dialog**

### Product-detail dialog

Display available product and seller information, inspection progress, and the original listing link.

- Prominent **Set up negotiation** CTA
- **View negotiation** after one has started
- Clear unknown/loading/error states
- Prioritized detail inspection when needed

Before sending an opening offer, verify current availability and essential details.

### Negotiation setup

Collect:

- Opening offer
- Hard maximum price
- Currency and cost basis
- Tone
- Additional instructions
- Expiry, defaulting to 24 hours

**Start negotiation** authorizes an ongoing conversation. Closing the dialog before confirmation sends nothing.

Persist settings and authorization before scheduling work.

## 7. Autonomous multi-round negotiation

Each negotiation stores its seller conversation, settings, authorization, message history, current offer, and lifecycle.

### Each round

1. Read newly received seller messages.
2. Load the full conversation history and current settings.
3. Ask Claude for a structured decision:
   - Reply
   - Counteroffer
   - Wait
   - Confirm an acceptable price
   - Request user input
   - End negotiation
4. Validate monetary terms and permitted actions.
5. Save the exact proposed outgoing text.
6. Atomically claim the send attempt.
7. Recheck authorization, pause, expiry, and conversation version.
8. Navigate and send through the marketplace adapter.
9. Verify delivery in the correct conversation.
10. Persist the outcome.

### Price and agreement rules

- Maximum price stays private.
- Pickup ceiling covers the item price.
- Shipping ceiling covers item plus shipping.
- Unknown mandatory costs must be clarified before agreement.
- No automatic currency conversion in the first version.
- The agent can confirm an acceptable price.
- Payment and logistics are handed to the user.
- **Price agreed** is not **Purchase complete**.
- Formal eBay offers, bids, checkout, and purchases are outside this release.

### One purchase per workspace

- Negotiate with multiple sellers.
- Atomically reserve the **first acceptable negotiation** before confirming agreement.
- Pause competing negotiations.
- If confirmation is uncertain, retain the reservation until reconciled.

This prevents independent agents from confirming several competing deals.

### Manual takeover

If an outgoing message appears that Haggleface did not send:

- Pause that conversation.
- Show **You took over**.
- Resume only with refreshed conversation history.

Detection must be verified per marketplace. Refresh the conversation immediately before sending to reduce conflicts with manual activity.

### Editable settings

Changing limits, tone, or instructions:

- Creates a new authorization version
- Invalidates unsent drafts
- Forces reconsideration of the next response

Previously sent offers remain in the history.

### Needs attention

Present the reason and relevant actions:

- Reconnect account
- Answer the seller’s question
- Update limits/instructions
- Review uncertain delivery
- Resume
- Stop

No new seller message means no automatic follow-up solely because another polling interval occurred.

### Authorization contract — explicitly approved

The user approved reconciling the previous exact-message-only repository requirement with **scoped, time-limited negotiation authorization**. `AGENTS.md` reflects this decision. The bounded worker and controlled conversation tests now implement this contract; real marketplace delivery remains unverified.

Explicit **Start negotiation** grants permission only for that negotiation’s seller conversation, within the persisted monetary limits, currency/cost basis, permitted actions, authorization version, and expiry. Preserve signed authorization and atomic per-message send claims. Recheck current authorization and conversation state immediately before each send.

Legacy one-message approvals must not silently become ongoing permissions. Closing setup grants no permission. Changed settings invalidate unsent drafts. Payment, logistics, formal offers, bids, checkout, and purchases remain outside the authorization.

### Uncertain delivery

If a crash or timeout happens after Send:

- Record an uncertain outcome.
- Re-read the conversation.
- Reconcile against the saved exact message.
- Never blindly retry.
- Request user input when ambiguity remains.

Atomic claims prevent our workers from competing; they do not guarantee exactly-once delivery through a marketplace website.

## 8. Five-minute reply monitoring

Monitor **only negotiations initiated from a workspace**.

### Infrastructure flow

```text
Convex minute dispatcher
    → finds due marketplace accounts
    → atomically claims a check
    → schedules an internal dispatch action
    → calls authenticated Vercel worker
    → worker checks conversations using Steel
    → saves results and replies
    → releases browser and claim
```

Vercel Hobby cron cannot supply the required five-minute schedule, so **Convex is the scheduler**.

### Account batching

Group work by **user and marketplace account**, across all their workspaces.

For example, five Facebook negotiations across two workspaces use one bounded Facebook check session, rather than five separate sessions.

- Exclude paused, expired, and terminal negotiations.
- Do not ingest unrelated inbox conversations.
- Save each conversation’s progress independently.
- Continue oversized batches in later bounded jobs.

### Cadence

- Target a check every **5 minutes** per active marketplace account.
- A lightweight Convex dispatcher runs every minute.
- Actual reply detection includes dispatch and processing time.
- Skip missed intervals rather than accumulate obsolete checks.
- No due work means no browser session.

### Controls

- **Check now:** joins an active check or schedules immediate work.
- **Pause monitoring:** workspace-level; pauses its checks and automatic replies.
- **Resume**
- **Stop negotiation**
- **Extend expiry**

Other workspaces continue when one is paused. Pausing cannot retract an already submitted message.

### Runtime limits

Proposed initial worker budget:

- Stop starting new work around **180 seconds**.
- Reserve time for saving and cleanup below Vercel’s 300-second ceiling.
- Persist continuation cursors.
- Use bounded browser/model operations.

Convex actions await the worker response; the worker awaits its work. No untracked promises after returning and no reliance on a daemon surviving between invocations.

### Concurrency and recovery

- One active monitoring batch per user/marketplace account
- Expiring work claims and stale-worker checks
- Per-conversation message deduplication
- Versioned send attempts
- Coordination between initial sends, monitoring, and Check now
- Read recovery separated from uncertain-send reconciliation

### UI feedback

Show conversations, current offer, agent state, last checked, and next scheduled check.

No notifications in this release.

## 9. Persistence and data model

Extend the existing Convex records with typed structures.

| Record | Responsibility |
|---|---|
| Workspace | Owner, original query, criteria, monitoring settings |
| Marketplace run | Discovery/inspection progress, continuation, outcome |
| Listing | Basic/detail fields, source identity, availability |
| Negotiation | Workspace/listing association, settings, authorization, lifecycle |
| Conversation message | Sender, content, source identity/order, observed time |
| Send attempt | Exact text, claim, delivery verification, uncertain outcome |
| Account monitoring state | Next due time, active claim, batch progress |

Add indexes for user-owned History, workspace negotiations, due monitoring work, and stable conversation/message lookup.

Preserve existing saved searches and negotiation records. Existing uncertain sends remain uncertain.

## 10. Deployment and runtime verification

### Completed proof

Local, SDK-owned Steel-cloud, and actual Vercel-preview successful-path probes passed with direct agent-browser attachment.

The Vercel probe verified:

- Native binary is included and executable
- Correct runtime architecture (Linux x64)
- Temporary file/socket paths are usable on the successful path
- Subprocess startup and successful cleanup commands
- Script/harness handoff
- Concurrent-session isolation
- Existing Playwright tracing compatibility

Preview evidence: https://haggleface-rl551kw6c-tingkaic.vercel.app,
HTTP 200, two PASSED results (2778ms and 3714ms), 5044ms overall.
The test token was private, deployment-specific, and time-limited.

### Remaining runtime verification

- Timeout and forced-termination behavior
- Failure-path subprocess/daemon cleanup
- Bundle-size measurement

A local Next.js build does not prove these. Successful-path compatibility does not prove live marketplace selectors or seller-message delivery.

### Environment separation

- Production Convex invokes production Vercel.
- Test Convex invokes one explicitly selected test/preview deployment.
- Shared test scheduling must not independently target every branch.
- Backend changes go to the test Convex deployment first.

If Vercel cannot reliably host the harness, present the measured failure and a minimal hosting alternative before adding infrastructure.

## 11. Delivery sequence

| Milestone | Completion evidence |
|---|---|
| **1. Harness/runtime proof** | Local, Steel cloud, and Vercel successful-path proof passed; failure-path cleanup and bundle measurement remain |
| **2. Workspace foundation** | Implemented and test-backend deployed, including typed threads, messages, send attempts, and account monitoring; legacy records preserved. |
| **3. Navigation and UI** | Implemented responsive sidebar, History, Settings, Listings/Negotiations views, detail/setup, monitoring controls, and labeled demo conversations. |
| **4. Discovery pipeline** | Implemented synchronous card reads, detail enrichment, leased batches/cursors, separate CAD/USD handling, source outcomes, and bounded native recovery. Real marketplace layouts remain unverified. |
| **5. Negotiation engine** | Implemented signed/versioned limits, exact-message claims, first-deal reservation, uncertainty reconciliation, and manual takeover; controlled multi-round tests pass. |
| **6. Monitoring** | Implemented minute dispatcher, account-batched bounded workers, five-minute target, Check now, pause/resume, expiry, and continuations. |
| **7. Preview handoff** | Core checks, three local demo browser/API tests, and two signed-out deployment tests pass. Final test backend deployed; selected Vercel preview ready and test worker configured. |

### Workspace foundation checkpoint — 2026-09-13

- Existing `searches` records remain the workspace identity, preserving old URLs and saved payloads. New writes validate snapshots with Zod and persist typed summary metadata; legacy summaries are derived on read without a migration.
- `store:history` paginates by owner and creation order. `store:workspace` returns the owned summary and state; existing `store:watch` remains compatible.
- Original query/title is retained through subsequent saves; new image-only workspaces identify the fallback title explicitly. Pause settings survive concurrent search saves.
- Existing listing rows now update when details arrive instead of ignoring enrichment after the first insert.
- `workspaceJobs` provides discovery/inspection enqueue, join, lease claim, checkpoint, continuation cursor, explicit resume, and expired-claim recovery. Generation and lease checks reject stale completion writes. These jobs do not send messages; browser dispatch is not yet connected.
- Deployed additive schema/functions to **test `sensible-newt-347`**, using `pnpm exec convex run --deployment sensible-newt-347 --push work:due '{}'`. Deployment succeeded; no jobs were due. An owner-scoped History query succeeded, and the existing saved search remained present.
- Three regression tests passed for legacy/ownership/pagination, original-query/pause/enrichment persistence, and competing/expired/stale work claims. Typecheck, lint, and build passed. Full suite: **9/10 pass**, with the same existing scoring fixture-count failure.

This historical foundation checkpoint is superseded by the implementation status above. Keep PR #7 unmerged until the user explicitly authorizes merging.

### Implementation handoff

- Core checks: **17/17 unit tests**, TypeScript, ESLint, and Next.js production build passed. The earlier fixture-count assertion is fixed; Kijiji fixtures carry CAD.
- **3/3 demo browser/API tests passed** against the local production build: search/filter/save/detail, controlled negotiation to price agreement, reload persistence, mobile layout/agent panel, image identification, connections, and invalid input/forged approval handling. Updated obsolete currency/negotiation assertions and fixed the missing favicon reference.
- Final additive schema/functions deployed successfully to test **`sensible-newt-347`**; `work:due` returned no queued jobs. Production remains untouched.
- Verified implementation commit **`d3e3ff6`** on preview **https://haggleface-m3z0mhj0t-tingkaic.vercel.app**. Both signed-out deployment browser/API tests passed; GitHub verification and Vercel deployment checks passed.
- Test Convex `WORKSPACE_WORKER_URL` is pinned to **https://haggleface-m3z0mhj0t-tingkaic.vercel.app/api/workspace/worker**. The worker returned 401 without authorization. With the test secret, a deliberately invalid `{}` payload reached application validation and returned the expected structured 500 error; this verifies auth/runtime loading, not a successful browser job. `dispatcher:tick` ran successfully with no discovery work due. No Steel session or seller message was triggered by these checks.
- Live messaging fails closed when conversation identity, complete history, availability, currency, or authorization cannot be verified. Conversation adapters require a stable listing association and message identity/direction metadata. They have not been validated against signed-in Facebook/eBay/Kijiji DOMs, and real seller messages were not sent.
- Remaining validation: signed-in source extraction/profile reuse, real marketplace conversation selectors, forced-termination cleanup, and native bundle-size measurement. Verification is intentionally lightweight for the hackathon, as requested; controlled tests do not prove live seller delivery.

## 12. Acceptance tests and verification

### Discovery

Test:

- Missing optional shipping without long waits
- Product-page detail enrichment
- Partner labels versus actual titles
- Deduplication across scrolls and resumed jobs
- Sold/unavailable listings
- Currency/location uncertainty
- Partial source failures
- Resuming interrupted discovery and inspection

### Negotiation

Use controlled conversations to verify:

> Opening offer → seller counteroffer → AI counteroffer → seller question → AI answer → acceptance → price agreed.

Also test:

- Price ceilings and attempts by seller content to override instructions
- Multiple seller messages between checks
- Duplicate polling and overlapping Check now
- Pause, expiry, or settings changes during a round
- Crash before/after Send
- Manual takeover
- Competing sellers
- Duplicate selection across workspaces
- Login loss and ambiguous conversation identity

### UI and ownership

- History and conversations survive reload.
- Data remains user-owned.
- Desktop/mobile sidebar and dialogs work with keyboard navigation.
- Demo activity remains visibly simulated.
- Legacy searches remain readable.

### Required checks

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Also run desktop/mobile browser tests, deploy backend changes to the selected test Convex deployment, and verify the Vercel preview runtime.

Baseline before probes: typecheck, ESLint, and build pass; **6/7 unit tests pass**. With the temporary probe access-control test, **7/8 pass**. The existing scoring test expects eight fixtures, while the merged Kijiji fixtures produce ten. Resolve that assertion as part of the discovery test updates.

Automated negotiation QA uses controlled conversations. Real seller-message tests and production deployment require separate explicit authorization.

---

**Final architecture:** preserve SDK-owned Steel sessions and fast Playwright scraping; use direct agent-browser snapshots for recovery; store work durably in Convex; run autonomous negotiations through bounded Vercel jobs with account-batched monitoring.
